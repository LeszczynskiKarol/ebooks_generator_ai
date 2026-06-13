// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// InkMagnet transactional email — AWS SES v2.
// NOTE: SES lives in us-east-1 (Karol's production SES region), which is
// DIFFERENT from the S3 region — hence a dedicated SES_REGION env.
// All sends are fail-soft: an email failure must never 500 an auth flow.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";

const SES_REGION = process.env.SES_REGION || "us-east-1";
const FROM =
  process.env.SES_FROM_EMAIL || "InkMagnet <hello@inkmagnet.com>";
const REPLY_TO = process.env.SES_REPLY_TO || "hello@inkmagnet.com";

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
