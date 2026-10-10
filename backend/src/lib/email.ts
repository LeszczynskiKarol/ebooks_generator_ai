// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// InkMagnet transactional email — AWS SES v2.
// NOTE: SES lives in us-east-1 (Karol's production SES region), which is
// DIFFERENT from the S3 region — hence a dedicated SES_REGION env.
// All sends are fail-soft: an email failure must never 500 an auth flow.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";

const SES_REGION = process.env.SES_REGION || "us-east-1";
const FROM =
  process.env.SES_FROM_EMAIL || "InkMagnet <contact@inkmagnet.com>";
const REPLY_TO = process.env.SES_REPLY_TO || "contact@inkmagnet.com";

let _client: SESv2Client | null = null;
function ses(): SESv2Client {
  if (!_client) {
    _client = new SESv2Client({
      region: SES_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
  }
  return _client;
}

interface SendArgs {
  to: string;
  subject: string;
  html: string;
  text: string;
  tag: string;
  /** where a reply should go (contact form: the sender); default: our address */
  replyTo?: string;
}

export async function sendEmail({
  to,
  subject,
  html,
  text,
  tag,
  replyTo,
}: SendArgs): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  try {
    const res = await ses().send(
      new SendEmailCommand({
        FromEmailAddress: FROM,
        ReplyToAddresses: [replyTo || REPLY_TO],
        Destination: { ToAddresses: [to] },
        Content: {
          Simple: {
            Subject: { Data: subject, Charset: "UTF-8" },
            Body: {
              Html: { Data: html, Charset: "UTF-8" },
              Text: { Data: text, Charset: "UTF-8" },
            },
          },
        },
        EmailTags: [{ Name: "type", Value: tag }],
      }),
    );
    console.log(`📧 Email sent (${tag}) → ${to} [${res.MessageId}]`);
    return { ok: true, messageId: res.MessageId };
  } catch (err: any) {
    console.error(`📧 Email FAILED (${tag}) → ${to}: ${err.message}`);
    return { ok: false, error: err.message };
  }
}

// ── Shared shell ──
export function shell(content: string): string {
  return `<!doctype html><html><body style="margin:0;padding:24px;background:#f4f4f7;font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#1f2937">
<div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:14px;padding:32px;border:1px solid #e5e7eb">
<p style="font-size:18px;font-weight:700;margin:0 0 20px;color:#4f46e5">InkMagnet</p>
${content}
<p style="font-size:12px;color:#9ca3af;margin-top:28px;border-top:1px solid #f3f4f6;padding-top:14px">
InkMagnet · inkmagnet.com</p>
</div></body></html>`;
}

type Lang = "pl" | "de" | string;

/** The text for the e-mail's language: Polish, German, otherwise English. */
function tr<T>(lang: Lang, pl: T, en: T, de: T): T {
  return lang === "pl" ? pl : lang === "de" ? de : en;
}

// ── Verification code ──
export function sendVerificationCodeEmail(
  to: string,
  code: string,
  lang: Lang,
) {
  const pl = lang === "pl";
  const subject = tr(lang, `Twój kod: ${code}`, `Your code: ${code}`, `Ihr Code: ${code}`);
  const intro = tr(
    lang,
    "Potwierdź swój adres e-mail. Twój kod weryfikacyjny:",
    "Confirm your email address. Your verification code:",
    "Bitte bestätigen Sie Ihre E-Mail-Adresse. Ihr Bestätigungscode:",
  );
  const ttl = tr(lang, "Kod wygasa po 15 minutach.", "The code expires in 15 minutes.", "Der Code ist 15 Minuten gültig.");
  const html = shell(`
<p style="font-size:15px;margin:0 0 16px">${intro}</p>
<p style="font-size:34px;font-weight:800;letter-spacing:8px;text-align:center;
   background:#eef2ff;border:2px dashed #6366f1;border-radius:10px;padding:18px;margin:0 0 16px;color:#312e81">${code}</p>
<p style="font-size:13px;color:#6b7280;margin:0">${ttl}</p>`);
  const text = `${intro}\n\n${code}\n\n${ttl}`;
  return sendEmail({ to, subject, html, text, tag: "verify_code" });
}

// ── Password reset ──
export function sendPasswordResetEmail(to: string, link: string, lang: Lang) {
  const pl = lang === "pl";
  const subject = tr(lang, "Reset hasła | InkMagnet", "Password reset | InkMagnet", "Passwort zurücksetzen | InkMagnet");
  const intro = tr(
    lang,
    "Otrzymaliśmy prośbę o reset hasła. Kliknij przycisk, aby ustawić nowe:",
    "We received a password reset request. Click the button to set a new one:",
    "Wir haben eine Anfrage zum Zurücksetzen Ihres Passworts erhalten. Klicken Sie auf die Schaltfläche, um ein neues festzulegen:",
  );
  const cta = tr(lang, "Ustaw nowe hasło", "Set a new password", "Neues Passwort festlegen");
  const ttl = tr(
    lang,
    "Link wygasa po 30 minutach. Jeśli to nie Ty, zignoruj tę wiadomość.",
    "The link expires in 30 minutes. If this wasn't you, ignore this email.",
    "Der Link ist 30 Minuten gültig. Wenn Sie das nicht waren, ignorieren Sie diese E-Mail.",
  );
  const html = shell(`
<p style="font-size:15px;margin:0 0 20px">${intro}</p>
<p style="text-align:center;margin:0 0 20px">
<a href="${link}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;
   font-weight:700;padding:13px 28px;border-radius:10px">${cta}</a></p>
<p style="font-size:13px;color:#6b7280;margin:0">${ttl}</p>`);
  const text = `${intro}\n\n${link}\n\n${ttl}`;
  return sendEmail({ to, subject, html, text, tag: "password_reset" });
}

// ── Welcome (optional) ──
export function sendWelcomeEmail(to: string, name: string | null, lang: Lang) {
  const pl = lang === "pl";
  const subject = tr(lang, "Witaj w InkMagnet!", "Welcome to InkMagnet!", "Willkommen bei InkMagnet!");
  const hello = name
    ? tr(lang, `Cześć ${name}!`, `Hi ${name}!`, `Guten Tag, ${name}!`)
    : tr(lang, "Cześć!", "Hi!", "Guten Tag!");
  const body = tr(
    lang,
    "Twoje konto jest gotowe. Stwórz swojego pierwszego e-booka w kilkanaście minut.",
    "Your account is ready. Create your first ebook in minutes.",
    "Ihr Konto ist eingerichtet. Erstellen Sie Ihr erstes E-Book in wenigen Minuten.",
  );
  const html = shell(`<p style="font-size:15px;margin:0 0 8px;font-weight:700">${hello}</p>
<p style="font-size:15px;margin:0">${body}</p>`);
  return sendEmail({ to, subject, html, text: `${hello}\n${body}`, tag: "welcome" });
}

// ── Structure ready for review ──
export function sendStructureReadyEmail(
  to: string,
  bookTitle: string,
  link: string,
  lang: Lang,
) {
  const pl = lang === "pl";
  const subject = tr(
    lang,
    `Plan książki gotowy: ${bookTitle}`,
    `Book plan ready: ${bookTitle}`,
    `Gliederung fertig: ${bookTitle}`,
  );
  const intro = tr(
    lang,
    `Plan Twojej książki <strong>„${bookTitle}"</strong> jest gotowy. Przejrzyj rozdziały i sekcje (możesz je edytować), a potem zatwierdź plan, aby ruszyło pisanie treści.`,
    `The plan for your book <strong>"${bookTitle}"</strong> is ready. Review the chapters and sections (you can edit them), then approve the plan to start the writing.`,
    `Die Gliederung Ihres Buches <strong>„${bookTitle}“</strong> ist fertig. Prüfen Sie Kapitel und Abschnitte (Sie können sie bearbeiten) und geben Sie die Gliederung frei, damit das Schreiben beginnt.`,
  );
  const cta = tr(lang, "Przejrzyj i zatwierdź plan", "Review and approve the plan", "Gliederung prüfen und freigeben");
  const note = tr(
    lang,
    "Pisanie ruszy dopiero po Twoim zatwierdzeniu.",
    "Writing starts only after your approval.",
    "Das Schreiben beginnt erst nach Ihrer Freigabe.",
  );
  const html = shell(`
<p style="font-size:15px;margin:0 0 20px">${intro}</p>
<p style="text-align:center;margin:0 0 20px">
<a href="${link}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;
   font-weight:700;padding:13px 28px;border-radius:10px">${cta}</a></p>
<p style="font-size:13px;color:#6b7280;margin:0">${note}</p>`);
  const text = `${intro.replace(/<[^>]+>/g, "")}

${link}

${note}`;
  return sendEmail({ to, subject, html, text, tag: "structure_ready" });
}

// ── Book completed ──
export function sendBookCompletedEmail(
  to: string,
  bookTitle: string,
  link: string,
  lang: Lang,
) {
  const pl = lang === "pl";
  const subject = tr(
    lang,
    `Twoja książka „${bookTitle}" jest gotowa`,
    `Your book "${bookTitle}" is ready`,
    `Ihr Buch „${bookTitle}“ ist fertig`,
  );
  const intro = tr(
    lang,
    `Gotowe! <strong>„${bookTitle}"</strong> jest napisana, złożona i czeka na Ciebie: PDF do druku i EPUB na czytniki.`,
    `Done! <strong>"${bookTitle}"</strong> is written, typeset and waiting for you: a print-ready PDF and an EPUB for e-readers.`,
    `Fertig! <strong>„${bookTitle}“</strong> ist geschrieben, gesetzt und wartet auf Sie: ein druckfertiges PDF und ein EPUB für E-Reader.`,
  );
  const cta = tr(lang, "Pobierz książkę", "Download your book", "Buch herunterladen");
  const note = tr(
    lang,
    "Plik znajdziesz też w każdej chwili na swoim koncie.",
    "You can also find the files in your account at any time.",
    "Die Dateien finden Sie außerdem jederzeit in Ihrem Konto.",
  );
  const html = shell(`
<p style="font-size:15px;margin:0 0 20px">${intro}</p>
<p style="text-align:center;margin:0 0 20px">
<a href="${link}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;
   font-weight:700;padding:13px 28px;border-radius:10px">${cta}</a></p>
<p style="font-size:13px;color:#6b7280;margin:0">${note}</p>`);
  const text = `${intro.replace(/<[^>]+>/g, "")}

${link}

${note}`;
  return sendEmail({ to, subject, html, text, tag: "book_completed" });
}

// ── Abandoned checkout reminders ──
// kind 1 fires while the intent is still hot (~2h after the order was set up),
// kind 2 the next day. The book's own title carries the subject line — the
// order is THEIR book, not our product, and that is the whole pitch.
export function sendPaymentReminderEmail(args: {
  to: string;
  bookTitle: string;
  pages: number;
  priceLabel: string;
  link: string;
  lang: Lang;
  kind: 1 | 2;
}) {
  const { to, bookTitle, pages, priceLabel, link, lang, kind } = args;
  const pl = lang === "pl";

  const subject =
    kind === 1
      ? tr(
          lang,
          `Twoja książka „${bookTitle}" czeka na finalizację`,
          `Your book "${bookTitle}" is waiting for you`,
          `Ihr Buch „${bookTitle}“ wartet auf Sie`,
        )
      : tr(
          lang,
          `Dokończ zamówienie: „${bookTitle}"`,
          `Finish your order: "${bookTitle}"`,
          `Bestellung abschließen: „${bookTitle}“`,
        );

  const intro =
    kind === 1
      ? tr(
          lang,
          `Twoje zamówienie jest w całości wypełnione: <strong>„${bookTitle}"</strong>, ok. ${pages} stron, ${priceLabel}. Brakuje tylko płatności. Po niej od razu przygotujemy plan książki do Twojej akceptacji, a po akceptacji dostaniesz gotowy PDF z okładką.`,
          `Your order is fully set up: <strong>"${bookTitle}"</strong>, ~${pages} pages, ${priceLabel}. Only the payment is missing. Right after it we prepare the book plan for your approval, and once you approve it you get the finished PDF with a cover.`,
          `Ihre Bestellung ist vollständig angelegt: <strong>„${bookTitle}“</strong>, ca. ${pages} Seiten, ${priceLabel}. Es fehlt nur noch die Zahlung. Direkt danach erstellen wir die Gliederung zu Ihrer Freigabe, und nach der Freigabe erhalten Sie das fertige PDF mit Cover.`,
        )
      : tr(
          lang,
          `Twoje zamówienie na <strong>„${bookTitle}"</strong> (ok. ${pages} stron, ${priceLabel}) wciąż czeka. Jeśli chcesz najpierw zobaczyć, jakie książki wychodzą z generatora, pobierz darmowe przykłady, a potem dokończ swoje zamówienie jednym kliknięciem.`,
          `Your order for <strong>"${bookTitle}"</strong> (~${pages} pages, ${priceLabel}) is still waiting. If you'd like to see what the generator produces first, download the free sample books, then finish your order in one click.`,
          `Ihre Bestellung für <strong>„${bookTitle}“</strong> (ca. ${pages} Seiten, ${priceLabel}) wartet noch. Wenn Sie zuerst sehen möchten, welche Bücher der Generator erstellt, laden Sie die kostenlosen Beispielbücher herunter und schließen Sie Ihre Bestellung danach mit einem Klick ab.`,
        );

  const cta = tr(lang, "Dokończ zamówienie", "Finish my order", "Bestellung abschließen");
  // no German examples page yet — the English one
  const samplesUrl = pl
    ? "https://inkmagnet.com/pl/przyklady/"
    : "https://inkmagnet.com/examples/";
  const samplesLabel = tr(
    lang,
    "Zobacz przykładowe książki (pełne PDF-y)",
    "See sample books (full PDFs)",
    "Beispielbücher ansehen (vollständige PDFs)",
  );
  const samples =
    kind === 2
      ? `<p style="text-align:center;margin:0 0 20px"><a href="${samplesUrl}" style="font-size:14px;color:#4f46e5">${samplesLabel}</a></p>`
      : "";
  const note =
    kind === 1
      ? tr(
          lang,
          "Nie chcesz dokończyć tego zamówienia? Zignoruj tę wiadomość, nic nie zostanie pobrane.",
          "Don't want to finish this order? Just ignore this email and nothing will be charged.",
          "Sie möchten diese Bestellung nicht abschließen? Ignorieren Sie diese E-Mail einfach, es wird nichts abgebucht.",
        )
      : tr(
          lang,
          "To ostatnie przypomnienie o tym zamówieniu. Jeśli nie chcesz go dokończyć, zignoruj tę wiadomość. Nic nie zostanie pobrane i nie napiszemy w tej sprawie ponownie.",
          "This is the last reminder about this order. If you don't want to finish it, ignore this email. Nothing will be charged and we won't write about it again.",
          "Dies ist die letzte Erinnerung an diese Bestellung. Wenn Sie sie nicht abschließen möchten, ignorieren Sie diese E-Mail. Es wird nichts abgebucht und wir schreiben Ihnen dazu nicht noch einmal.",
        );

  const html = shell(`
<p style="font-size:15px;margin:0 0 20px">${intro}</p>
<p style="text-align:center;margin:0 0 20px">
<a href="${link}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;
   font-weight:700;padding:13px 28px;border-radius:10px">${cta}</a></p>
${samples}
<p style="font-size:13px;color:#6b7280;margin:0">${note}</p>`);
  const text = `${intro.replace(/<[^>]+>/g, "")}

${link}

${note}`;
  return sendEmail({
    to,
    subject,
    html,
    text,
    tag: kind === 1 ? "payment_reminder_1" : "payment_reminder_2",
  });
}

// ── Order confirmation (after Stripe payment) ──
// Consumer law: the trader must confirm on a durable medium the consumer's
// request to start before the withdrawal period ends and their acknowledgement
// of losing the right. The statement is quoted VERBATIM as ticked in the app —
// keep these strings identical to "payment.consent" in
// frontend/src/lib/dict/payment.ts.
export const WITHDRAWAL_CONSENT_TEXT: Record<string, string> = {
  en: "I request that work on my book starts immediately, before the 14-day withdrawal period ends, and I acknowledge that I lose my right of withdrawal once generation of the book begins (Terms, §6).",
  pl: "Żądam rozpoczęcia pracy nad moją książką przed upływem 14-dniowego terminu na odstąpienie od umowy i przyjmuję do wiadomości, że z chwilą rozpoczęcia generowania książki tracę prawo do odstąpienia od umowy (Regulamin, §6).",
  de: "Ich verlange ausdrücklich, dass vor Ablauf der 14-tägigen Widerrufsfrist mit der Erstellung meines Buches begonnen wird, und bestätige meine Kenntnis davon, dass ich mit Beginn der Erstellung des Buches mein Widerrufsrecht verliere (AGB, §6).",
};

/** Language for e-mails and notifications about a book: the UI language of
 *  the order when we know it, otherwise the old rule (Polish book → pl). */
export function projectLang(p: { uiLang?: string | null; language?: string | null; currency?: string | null }): "pl" | "en" | "de" {
  if (p.uiLang) return orderLang(p.uiLang);
  return p.language === "pl" || p.currency === "pln" ? "pl" : "en";
}

/** The seller, as in the terms (§1) and the German Impressum — an order
 *  confirmation must name who the contract is with and where to complain. */
export const SELLER = {
  name: "ecopywriting.pl Karol Leszczyński",
  address: "Papowo Biskupie 119/18, 86-221 Papowo Biskupie",
  nip: "9562203948",
  email: "contact@inkmagnet.com",
};

const TERMS_URL = {
  pl: "https://inkmagnet.com/pl/regulamin/",
  en: "https://inkmagnet.com/terms/",
  de: "https://inkmagnet.com/de/agb/",
};
const WITHDRAWAL_ANCHOR = { pl: "#odstapienie", en: "#withdrawal", de: "#widerruf" };

/** pl | de | en — the languages the order texts exist in. */
export function orderLang(v: unknown): "pl" | "en" | "de" {
  return v === "pl" || v === "de" ? v : "en";
}

/**
 * Stripe payment description — printed on the receipt Stripe e-mails, so the
 * confirmation of the waiver reaches the customer on a second durable medium
 * besides our own order e-mail. Stripe's limit is 1000 characters.
 */
export function paymentDescriptionWithConsent(lang: unknown, bookTitle: string, at: Date): string {
  const l = orderLang(lang);
  const title = bookTitle.replace(/\s+/g, " ").trim().slice(0, 160);
  const when =
    at.toLocaleString(l === "pl" ? "pl-PL" : l === "de" ? "de-DE" : "en-GB", {
      timeZone: "Europe/Warsaw",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }) + " (Europe/Warsaw)";
  const text = {
    pl: `InkMagnet — e-book „${title}”. Potwierdzenie: Klient zażądał rozpoczęcia pracy nad książką przed upływem 14-dniowego terminu na odstąpienie od umowy i przyjął do wiadomości utratę prawa odstąpienia z chwilą rozpoczęcia generowania książki (zgoda wyrażona ${when}).`,
    en: `InkMagnet — ebook "${title}". Confirmation: the customer requested that work on the book start before the 14-day withdrawal period ended and acknowledged losing the right of withdrawal once generation of the book began (consent given ${when}).`,
    de: `InkMagnet — E-Book „${title}“. Bestätigung: Der Kunde hat ausdrücklich verlangt, dass vor Ablauf der 14-tägigen Widerrufsfrist mit der Erstellung des Buches begonnen wird, und seine Kenntnis vom Verlust des Widerrufsrechts mit Beginn der Erstellung bestätigt (Zustimmung erteilt ${when}).`,
  }[l];
  return text.slice(0, 1000);
}

export function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type OrderConfirmationArgs = {
  to: string;
  orderId: string;
  bookTitle: string;
  pages: number;
  amountLabel: string;
  paidAt: Date;
  /** null when the order predates the consent checkbox */
  consentAt: Date | null;
  link: string;
  lang: Lang;
};

export function sendOrderConfirmationEmail(args: OrderConfirmationArgs) {
  const { subject, html, text } = buildOrderConfirmationEmail(args);
  return sendEmail({ to: args.to, subject, html, text, tag: "order_confirmation" });
}

export function buildOrderConfirmationEmail(args: OrderConfirmationArgs) {
  const { orderId, pages, amountLabel, paidAt, consentAt, link, lang } = args;
  const l = orderLang(lang);
  const pl = l === "pl";
  const title = esc(args.bookTitle);
  const locale = pl ? "pl-PL" : l === "de" ? "de-DE" : "en-GB";
  const fmt = (d: Date) =>
    d.toLocaleString(locale, {
      timeZone: "Europe/Warsaw",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    });
  const consentText = WITHDRAWAL_CONSENT_TEXT[l];
  const termsUrl = TERMS_URL[l];
  const withdrawalUrl = termsUrl + WITHDRAWAL_ANCHOR[l];

  const subject = tr(
    l,
    `Potwierdzenie zamówienia: „${args.bookTitle}”`,
    `Order confirmation: "${args.bookTitle}"`,
    `Bestellbestätigung: „${args.bookTitle}“`,
  );
  const intro = tr(
    l,
    "Dziękujemy za zamówienie. Płatność dotarła, a my zaczynamy przygotowywać plan Twojej książki do akceptacji.",
    "Thank you for your order. Your payment has arrived and we are starting on your book's plan for your approval.",
    "Vielen Dank für Ihre Bestellung. Ihre Zahlung ist eingegangen, und wir beginnen mit der Gliederung Ihres Buches, die Sie anschließend freigeben.",
  );
  const rows: [string, string][] = tr<[string, string][]>(
    l,
    [
      ["Numer zamówienia", orderId],
      ["Książka", `„${title}”`],
      ["Objętość", `ok. ${pages} stron`],
      ["Zapłacono", esc(amountLabel)],
      ["Data płatności", fmt(paidAt)],
    ],
    [
      ["Order number", orderId],
      ["Book", `"${title}"`],
      ["Length", `~${pages} pages`],
      ["Paid", esc(amountLabel)],
      ["Payment date", fmt(paidAt)],
    ],
    [
      ["Bestellnummer", orderId],
      ["Buch", `„${title}“`],
      ["Umfang", `ca. ${pages} Seiten`],
      ["Bezahlt", esc(amountLabel)],
      ["Zahlungsdatum", fmt(paidAt)],
    ],
  );
  const table = rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:4px 12px 4px 0;color:#6b7280;white-space:nowrap;vertical-align:top">${k}</td><td style="padding:4px 0">${v}</td></tr>`,
    )
    .join("");

  const when = consentAt ? `, ${fmt(consentAt)}` : "";
  const consentHead = tr(
    l,
    `Oświadczenie złożone przy zamówieniu${when}:`,
    `Statement made when ordering${when}:`,
    `Bei der Bestellung abgegebene Erklärung${when}:`,
  );
  const consentNote = tr(
    l,
    "Generowanie książki (research i plan) rusza zaraz po płatności i z tą chwilą prawo do odstąpienia od umowy wygasa. Plan zobaczysz i zatwierdzisz przed pisaniem rozdziałów. Jeśli generowanie nie powiedzie się z przyczyn technicznych, zwrócimy płatność.",
    "Generation of your book (research and plan) starts right after payment, and from that moment the right of withdrawal expires. You review and approve the plan before the chapters are written. If generation fails for technical reasons, we refund your payment.",
    "Die Erstellung Ihres Buches (Recherche und Gliederung) beginnt unmittelbar nach der Zahlung; damit erlischt Ihr Widerrufsrecht. Sie sehen die Gliederung und geben sie frei, bevor die Kapitel geschrieben werden. Schlägt die Erstellung aus technischen Gründen fehl, erstatten wir Ihre Zahlung.",
  );
  const consentBlock = consentAt
    ? `<p style="font-size:14px;font-weight:600;margin:24px 0 8px">${consentHead}</p>
<blockquote style="margin:0 0 12px;padding:10px 14px;border-left:3px solid #4f46e5;background:#f9fafb;font-size:14px;color:#374151">${esc(consentText)}</blockquote>
<p style="font-size:13px;color:#6b7280;margin:0 0 20px">${consentNote}</p>`
    : "";
  const cta = tr(l, "Przejdź do zamówienia", "Go to your order", "Zur Bestellung");
  const terms = tr(l, "Regulamin", "Terms", "AGB");
  // who the contract is with, how to complain, where the withdrawal rules are
  const sellerLines = tr<string[]>(
    l,
    [
      `Sprzedawca: ${SELLER.name}, ${SELLER.address}, Polska, NIP ${SELLER.nip}.`,
      `Kontakt i reklamacje: ${SELLER.email} (odpowiadamy w ciągu 14 dni).`,
      `Prawo odstąpienia od umowy i jego utrata: Regulamin, §6 (${withdrawalUrl}).`,
    ],
    [
      `Seller: ${SELLER.name}, ${SELLER.address}, Poland, tax ID (NIP) ${SELLER.nip}.`,
      `Contact and complaints: ${SELLER.email} (we reply within 14 days).`,
      `Right of withdrawal and its loss: Terms, §6 (${withdrawalUrl}).`,
    ],
    [
      `Anbieter: ${SELLER.name}, ${SELLER.address}, Polen, Steuernummer (NIP) ${SELLER.nip}.`,
      `Kontakt und Beschwerden: ${SELLER.email} (wir antworten innerhalb von 14 Tagen).`,
      `Widerrufsrecht und sein Erlöschen: AGB, §6 (${withdrawalUrl}).`,
    ],
  );

  const html = shell(`
<p style="font-size:15px;margin:0 0 16px">${intro}</p>
<table style="font-size:14px;border-collapse:collapse;margin:0 0 8px">${table}</table>
${consentBlock}
<p style="text-align:center;margin:20px 0">
<a href="${link}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;
   font-weight:700;padding:13px 28px;border-radius:10px">${cta}</a></p>
<p style="font-size:12px;color:#6b7280;margin:0;line-height:1.6">${sellerLines.map(esc).join("<br>")}<br><a href="${termsUrl}" style="color:#4f46e5">${terms}</a></p>`);

  const text = [
    intro,
    "",
    ...rows.map(([k, v]) => `${k}: ${v.replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")}`),
    ...(consentAt
      ? ["", consentHead, tr(l, `„${consentText}”`, `"${consentText}"`, `„${consentText}“`), consentNote]
      : []),
    "",
    link,
    "",
    ...sellerLines,
    `${terms}: ${termsUrl}`,
  ].join("\n");
  return { subject, html, text };
}
