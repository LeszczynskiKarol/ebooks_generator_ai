// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Public contact form (inkmagnet.com/contact, /pl/kontakt, /de/kontakt) —
// the second fast contact channel next to e-mail (the German Impressum
// needs one) and a way in for people without an account.
//
// The balance: a real person's message must ALWAYS arrive; abuse must stay
// cheap for us.
//   - every accepted message is STORED first, then e-mailed to the owner with
//     Reply-To = the sender, so a mail hiccup never loses it (admin tab reads
//     the table);
//   - nothing is ever sent TO the address typed in the form (no auto-reply),
//     so the form cannot be used to mail third parties;
//   - bots: a hidden honeypot field — filled → answered "ok" and dropped;
//   - soft signals (sent within 3 s of opening the form, many links) do NOT
//     block: the message is delivered with a "[check]" mark;
//   - hard limits only on volume: per IP and per sender address per hour, and
//     a global daily cap that protects the mailbox;
//   - all text is length-capped and HTML-escaped; it goes to SES through the
//     API (no header injection possible).
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middleware/auth";
import { sendEmail, shell, esc } from "../lib/email";
import { emailLooksValid } from "../lib/emailGuards";

const APP_URL = process.env.PUBLIC_APP_URL || "https://app.inkmagnet.com";
const PER_IP_HOUR = Number(process.env.CONTACT_PER_IP_HOUR || 5);
const PER_EMAIL_HOUR = Number(process.env.CONTACT_PER_EMAIL_HOUR || 5);
const GLOBAL_DAY = Number(process.env.CONTACT_GLOBAL_DAY || 300);
const TOPICS = ["question", "order", "invoice", "problem", "privacy", "other"] as const;

const clip = (v: unknown, max: number): string =>
  typeof v === "string" ? v.replace(/\u0000/g, "").trim().slice(0, max) : "";

export async function contactRoutes(app: FastifyInstance) {
  // ━━━ POST /api/contact ━━━ public
  app.post("/api/contact", async (request, reply) => {
    const b = (request.body ?? {}) as any;

    // Honeypot: a field people never see. A bot that fills it gets a normal
    // "ok" (nothing to learn from) and the message goes nowhere.
    if (clip(b.website, 200)) return reply.send({ success: true });

    const email = clip(b.email, 200).toLowerCase();
    const message = clip(b.message, 5000);
    const name = clip(b.name, 100);
    const topic = (TOPICS as readonly string[]).includes(b.topic) ? (b.topic as string) : "other";
    const lang = b.lang === "pl" || b.lang === "de" ? b.lang : "en";

    if (!emailLooksValid(email))
      return reply.status(400).send({ success: false, code: "EMAIL", error: "Enter a valid e-mail address" });
    if (message.length < 10)
      return reply.status(400).send({ success: false, code: "MESSAGE", error: "The message is too short" });

    const ip = (request.ip || "").slice(0, 64) || null;
    const hourAgo = new Date(Date.now() - 3600_000);
    const dayAgo = new Date(Date.now() - 24 * 3600_000);
    const [byIp, byEmail, today] = await Promise.all([
      ip ? prisma.contactMessage.count({ where: { ip, createdAt: { gt: hourAgo } } }) : Promise.resolve(0),
      prisma.contactMessage.count({ where: { email, createdAt: { gt: hourAgo } } }),
      prisma.contactMessage.count({ where: { createdAt: { gt: dayAgo } } }),
    ]);
    if (byIp >= PER_IP_HOUR || byEmail >= PER_EMAIL_HOUR || today >= GLOBAL_DAY)
      return reply.status(429).send({
        success: false,
        code: "RATE",
        error: "Too many messages in a short time — please write to contact@inkmagnet.com",
      });

    // Soft signals — delivered anyway, only marked for the reader.
    const flags: string[] = [];
    const startedAt = Number(b.startedAt);
    if (Number.isFinite(startedAt) && startedAt > 0 && Date.now() - startedAt < 3000) flags.push("fast");
    if ((message.match(/https?:\/\//gi) || []).length > 3) flags.push("links");

    const row = await prisma.contactMessage.create({
      data: {
        name: name || null,
        email,
        topic,
        message,
        lang,
        ip,
        country: clip(request.headers["cloudfront-viewer-country"], 2).toUpperCase() || null,
        userAgent: clip(request.headers["user-agent"], 300) || null,
        flags,
      },
    });

    const to = process.env.CONTACT_INBOX || process.env.ADMIN_EMAIL;
    if (to) {
      const rows: [string, string][] = [
        ["Od", name ? `${name} <${email}>` : email],
        ["Temat", topic],
        ["Język", lang],
        ...(row.country ? ([["Kraj", row.country]] as [string, string][]) : []),
        ...(flags.length ? ([["Sygnały", flags.join(", ")]] as [string, string][]) : []),
      ];
      const table = rows
        .map(([k, v]) => `<tr><td style="padding:3px 12px 3px 0;color:#6b7280;white-space:nowrap">${esc(k)}</td><td style="padding:3px 0">${esc(v)}</td></tr>`)
        .join("");
      // fire-and-forget: the message is already stored
      void sendEmail({
        to,
        replyTo: email,
        subject: `${flags.length ? "[check] " : ""}Formularz kontaktowy (${topic}): ${name || email}`,
        html: shell(`
<table style="font-size:14px;border-collapse:collapse;margin:0 0 16px">${table}</table>
<div style="font-size:15px;white-space:pre-wrap;border-left:3px solid #4f46e5;padding:8px 14px;background:#f9fafb">${esc(message)}</div>
<p style="font-size:13px;color:#6b7280;margin:16px 0 0">Odpowiedz na tę wiadomość, a odpowiedź trafi do nadawcy. <a href="${APP_URL}/admin/feedback?tab=messages" style="color:#4f46e5">Wszystkie wiadomości</a></p>`),
        text: rows.map(([k, v]) => `${k}: ${v}`).join("\n") + `\n\n${message}`,
        tag: "contact_form",
      }).catch(() => {});
    }
    return reply.status(201).send({ success: true });
  });

  // ════════════════ ADMIN ════════════════
  const adminOnly = async (request: FastifyRequest, reply: FastifyReply) => {
    await authenticate(request, reply);
    if (reply.sent) return;
    const adminEmail = process.env.ADMIN_EMAIL;
    if (adminEmail && request.user.email !== adminEmail)
      return reply.status(403).send({ error: "Not admin" });
  };

  // ━━━ GET /api/admin/contact ━━━ newest first
  app.get("/api/admin/contact", { preHandler: adminOnly }, async (_request, reply) => {
    const rows = await prisma.contactMessage.findMany({ orderBy: { createdAt: "desc" }, take: 300 });
    return reply.send({ success: true, data: { rows, open: rows.filter((r) => !r.handled).length } });
  });

  // ━━━ PATCH /api/admin/contact/:id ━━━ mark handled / not handled
  app.patch("/api/admin/contact/:id", { preHandler: adminOnly }, async (request, reply) => {
    const { id } = request.params as any;
    const handled = (request.body as any)?.handled === true;
    const done = await prisma.contactMessage.updateMany({ where: { id }, data: { handled } });
    if (done.count !== 1) return reply.status(404).send({ success: false, error: "Not found" });
    return reply.send({ success: true });
  });
}
