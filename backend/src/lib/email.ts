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
}

export async function sendEmail({
  to,
  subject,
  html,
  text,
  tag,
}: SendArgs): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  try {
    const res = await ses().send(
      new SendEmailCommand({
        FromEmailAddress: FROM,
        ReplyToAddresses: [REPLY_TO],
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
function shell(content: string): string {
  return `<!doctype html><html><body style="margin:0;padding:24px;background:#f4f4f7;font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#1f2937">
<div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:14px;padding:32px;border:1px solid #e5e7eb">
<p style="font-size:18px;font-weight:700;margin:0 0 20px;color:#4f46e5">InkMagnet</p>
${content}
<p style="font-size:12px;color:#9ca3af;margin-top:28px;border-top:1px solid #f3f4f6;padding-top:14px">
InkMagnet · inkmagnet.com</p>
</div></body></html>`;
}

type Lang = "pl" | string;

// ── Verification code ──
export function sendVerificationCodeEmail(
  to: string,
  code: string,
  lang: Lang,
) {
  const pl = lang === "pl";
  const subject = pl ? `Twój kod: ${code}` : `Your code: ${code}`;
  const intro = pl
    ? "Potwierdź swój adres e-mail. Twój kod weryfikacyjny:"
    : "Confirm your email address. Your verification code:";
  const ttl = pl ? "Kod wygasa po 15 minutach." : "The code expires in 15 minutes.";
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
  const subject = pl ? "Reset hasła — InkMagnet" : "Password reset — InkMagnet";
  const intro = pl
    ? "Otrzymaliśmy prośbę o reset hasła. Kliknij przycisk, aby ustawić nowe:"
    : "We received a password reset request. Click the button to set a new one:";
  const cta = pl ? "Ustaw nowe hasło" : "Set a new password";
  const ttl = pl
    ? "Link wygasa po 30 minutach. Jeśli to nie Ty — zignoruj tę wiadomość."
    : "The link expires in 30 minutes. If this wasn't you, ignore this email.";
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
  const subject = pl ? "Witaj w InkMagnet!" : "Welcome to InkMagnet!";
  const hello = name ? (pl ? `Cześć ${name}!` : `Hi ${name}!`) : pl ? "Cześć!" : "Hi!";
  const body = pl
    ? "Twoje konto jest gotowe. Stwórz swojego pierwszego e-booka w kilkanaście minut."
    : "Your account is ready. Create your first ebook in minutes.";
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
  const subject = pl
    ? `Plan książki gotowy: ${bookTitle}`
    : `Book plan ready: ${bookTitle}`;
  const intro = pl
    ? `Plan Twojej książki <strong>„${bookTitle}"</strong> jest gotowy. Przejrzyj rozdziały i sekcje — możesz je edytować — a potem zatwierdź plan, aby ruszyło pisanie treści.`
    : `The plan for your book <strong>"${bookTitle}"</strong> is ready. Review the chapters and sections — you can edit them — then approve the plan to start the writing.`;
  const cta = pl ? "Przejrzyj i zatwierdź plan" : "Review and approve the plan";
  const note = pl
    ? "Pisanie ruszy dopiero po Twoim zatwierdzeniu."
    : "Writing starts only after your approval.";
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
  const subject = pl
    ? `Twoja książka „${bookTitle}" jest gotowa`
    : `Your book "${bookTitle}" is ready`;
  const intro = pl
    ? `Gotowe! <strong>„${bookTitle}"</strong> jest napisana, złożona i czeka na Ciebie — PDF do druku i EPUB na czytniki.`
    : `Done! <strong>"${bookTitle}"</strong> is written, typeset and waiting for you — a print-ready PDF and an EPUB for e-readers.`;
  const cta = pl ? "Pobierz książkę" : "Download your book";
  const note = pl
    ? "Plik znajdziesz też w każdej chwili na swoim koncie."
    : "You can also find the files in your account at any time.";
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
      ? pl
        ? `„${bookTitle}" — Twoja książka czeka na finalizację`
        : `"${bookTitle}" — your book is waiting for you`
      : pl
        ? `Dokończ zamówienie: „${bookTitle}"`
        : `Finish your order: "${bookTitle}"`;

  const intro =
    kind === 1
      ? pl
        ? `Twoje zamówienie jest w całości wypełnione — <strong>„${bookTitle}"</strong>, ok. ${pages} stron, ${priceLabel}. Brakuje tylko płatności. Po niej od razu przygotujemy plan książki do Twojej akceptacji, a po akceptacji dostaniesz gotowy PDF z okładką.`
        : `Your order is fully set up — <strong>"${bookTitle}"</strong>, ~${pages} pages, ${priceLabel}. Only the payment is missing. Right after it we prepare the book plan for your approval, and once you approve it you get the finished PDF with a cover.`
      : pl
        ? `Twoje zamówienie na <strong>„${bookTitle}"</strong> (ok. ${pages} stron, ${priceLabel}) wciąż czeka. Jeśli chcesz najpierw zobaczyć, jakie książki wychodzą z generatora, pobierz darmowe przykłady — a potem dokończ swoje zamówienie jednym kliknięciem.`
        : `Your order for <strong>"${bookTitle}"</strong> (~${pages} pages, ${priceLabel}) is still waiting. If you'd like to see what the generator produces first, download the free sample books — then finish your order in one click.`;

  const cta = pl ? "Dokończ zamówienie" : "Finish my order";
  const samplesUrl = pl
    ? "https://inkmagnet.com/pl/przyklady/"
    : "https://inkmagnet.com/examples/";
  const samples =
    kind === 2
      ? pl
        ? `<p style="text-align:center;margin:0 0 20px"><a href="${samplesUrl}" style="font-size:14px;color:#4f46e5">Zobacz przykładowe książki (pełne PDF-y)</a></p>`
        : `<p style="text-align:center;margin:0 0 20px"><a href="${samplesUrl}" style="font-size:14px;color:#4f46e5">See sample books (full PDFs)</a></p>`
      : "";
  const note =
    kind === 1
      ? pl
        ? "Nie chcesz dokończyć tego zamówienia? Zignoruj tę wiadomość — nic nie zostanie pobrane."
        : "Don't want to finish this order? Just ignore this email — nothing will be charged."
      : pl
        ? "To ostatnie przypomnienie o tym zamówieniu. Jeśli nie chcesz go dokończyć, zignoruj tę wiadomość — nic nie zostanie pobrane i nie napiszemy w tej sprawie ponownie."
        : "This is the last reminder about this order. If you don't want to finish it, ignore this email — nothing will be charged and we won't write about it again.";

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
