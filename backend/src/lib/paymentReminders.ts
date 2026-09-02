// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Abandoned-checkout recovery.
//
// A filled-in order that stalls at the Stripe page is the closest thing this
// funnel has to money on the table: the person named their book, picked a
// size and reached payment. The sweep sends at most two reminders per order:
//   #1 ~2h after the order was created — the intent is still hot, and the
//      email lands the same evening the person was shopping;
//   #2 ~26h after — the next day, at a slightly later hour than #1, with the
//      free sample books as proof of what they will get.
// Then silence, and #2 says so. No fake urgency, no discounts — the subject
// line carries the title of THEIR book, which is the one thing in this email
// the reader actually cares about.
//
// Driven purely by DB state and claimed atomically (updateMany guarded by the
// previous counter value), so the sweep is idempotent and safe to run from
// more than one process.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
import { prisma } from "./prisma";
import { sendPaymentReminderEmail } from "./email";

const APP_URL = process.env.PUBLIC_APP_URL || "https://app.inkmagnet.com";

const REMINDER_1_AFTER_MS = 2 * 60 * 60 * 1000; // 2h
const REMINDER_2_AFTER_MS = 26 * 60 * 60 * 1000; // 26h
// Orders older than this never get a first reminder — prevents a deploy from
// resurrecting months-old rows, and caps how stale a "hot" order can be.
const MAX_ORDER_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** "56,02 zł" / "$14.99" — the amount exactly as checkout charges it. */
function priceLabel(p: {
  priceUsdCents: number | null;
  currency: string;
  exchangeRate: number | null;
}): string {
  const cents = p.priceUsdCents ?? 0;
  if (p.currency === "pln" && p.exchangeRate) {
    const zl = Math.round(cents * p.exchangeRate) / 100;
    return `${zl.toFixed(2).replace(".", ",")} zł`;
  }
  return `$${(cents / 100).toFixed(2)}`;
}

/** The book's name for a subject line: title, else the topic's first line,
 *  trimmed to fit a subject without tearing a word in half. */
function subjectTitle(title: string | null, topic: string): string {
  const raw = (title || topic).split(/\r?\n/)[0].trim();
  if (raw.length <= 60) return raw;
  const cut = raw.slice(0, 60);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 30 ? cut.slice(0, lastSpace) : cut) + "…";
}

export async function sweepPaymentReminders(): Promise<void> {
  const now = Date.now();
  const adminEmail = process.env.ADMIN_EMAIL || "";

  const candidates = await prisma.project.findMany({
    where: {
      paymentStatus: "PENDING",
      currentStage: "PAYMENT",
      autoPilot: false,
      paymentRemindersSent: { lt: 2 },
      createdAt: { gte: new Date(now - MAX_ORDER_AGE_MS) },
    },
    select: {
      id: true,
      title: true,
      topic: true,
      language: true,
      targetPages: true,
      priceUsdCents: true,
      currency: true,
      exchangeRate: true,
      createdAt: true,
      paymentRemindersSent: true,
      lastPaymentReminderAt: true,
      userId: true,
      user: { select: { email: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // One email per user per sweep, for their newest pending order — a person
  // with two abandoned drafts should not get two nags in one minute.
  const seenUsers = new Set<string>();

  for (const p of candidates) {
    if (!p.user?.email || p.user.email === adminEmail) continue;
    if (seenUsers.has(p.userId)) continue;

    const age = now - p.createdAt.getTime();
    let kind: 1 | 2 | null = null;
    if (p.paymentRemindersSent === 0 && age >= REMINDER_1_AFTER_MS) kind = 1;
    else if (
      p.paymentRemindersSent === 1 &&
      age >= REMINDER_2_AFTER_MS &&
      p.lastPaymentReminderAt &&
      now - p.lastPaymentReminderAt.getTime() >= REMINDER_2_AFTER_MS - REMINDER_1_AFTER_MS
    )
      kind = 2;
    if (!kind) continue;

    // Atomic claim: only the process that flips the counter sends the email.
    const claimed = await prisma.project.updateMany({
      where: {
        id: p.id,
        paymentStatus: "PENDING",
        paymentRemindersSent: kind - 1,
      },
      data: {
        paymentRemindersSent: kind,
        lastPaymentReminderAt: new Date(),
      },
    });
    if (claimed.count !== 1) continue;

    seenUsers.add(p.userId);
    const res = await sendPaymentReminderEmail({
      to: p.user.email,
      bookTitle: subjectTitle(p.title, p.topic),
      pages: p.targetPages,
      priceLabel: priceLabel(p),
      link: `${APP_URL}/projects/${p.id}`,
      lang: p.language === "pl" ? "pl" : "en",
      kind,
    });
    if (!res.ok) {
      // Sending failed — release the claim so the next sweep retries.
      await prisma.project.updateMany({
        where: { id: p.id, paymentRemindersSent: kind },
        data: {
          paymentRemindersSent: kind - 1,
          lastPaymentReminderAt: kind === 2 ? p.lastPaymentReminderAt : null,
        },
      });
    }
  }
}

/** Start the recurring sweep. Runs one pass shortly after boot (catches
 *  anything that ripened while the process was down), then every 15 minutes. */
export function startPaymentReminderSweep(): void {
  const run = () =>
    sweepPaymentReminders().catch((err) =>
      console.error(`💤 payment-reminder sweep failed: ${err.message}`),
    );
  setTimeout(run, 60 * 1000);
  setInterval(run, 15 * 60 * 1000);
  console.log("💤 Payment-reminder sweep scheduled (every 15 min)");
}
