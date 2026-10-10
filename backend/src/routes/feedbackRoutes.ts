// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Finished-book feedback — two customer tools, no LLM anywhere:
//
//  1. RATING      1–5 stars, clickable reasons at 1–3, a comment, and (at
//                 4–5) consent to show the review on the public site.
//                 One per book; the customer can change or remove it.
//  2. CORRECTIONS "Check by a human": the customer describes what to fix;
//                 the request goes to the admin queue and the owner's inbox.
//                 Free, limited to one open request per book and
//                 MAX_CORRECTIONS in total. Closing it with a note e-mails
//                 the customer and drops an in-app notification.
//
// Same shape as smart-edu.ai (WorkFeedback / CorrectionRequest).
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middleware/auth";
import { sendEmail, shell, esc, projectLang } from "../lib/email";

const APP_URL = process.env.PUBLIC_APP_URL || "https://app.inkmagnet.com";

export const FEEDBACK_REASONS = [
  "too_short",
  "repetitive",
  "factual",
  "style",
  "sources",
  "layout",
  "cover",
  "images",
] as const;

export const MAX_CORRECTIONS = 3;
const CORRECTION_STATUSES = ["open", "in_progress", "done", "rejected"] as const;
const isOpen = (s: string) => s === "open" || s === "in_progress";

const bookName = (p: { title: string | null; topic: string }) => p.title || p.topic;


function notifyOwner(subject: string, rows: [string, string][], link: string, tag: string) {
  const to = process.env.ADMIN_EMAIL;
  if (!to) return;
  const table = rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:4px 12px 4px 0;color:#6b7280;white-space:nowrap;vertical-align:top">${esc(k)}</td><td style="padding:4px 0;white-space:pre-wrap">${esc(v)}</td></tr>`,
    )
    .join("");
  const html = shell(`
<table style="font-size:14px;border-collapse:collapse;margin:0 0 16px">${table}</table>
<p style="margin:0"><a href="${link}" style="color:#4f46e5;font-weight:600">Otwórz w panelu</a></p>`);
  const text = rows.map(([k, v]) => `${k}: ${v}`).join("\n") + `\n\n${link}`;
  // fire-and-forget: the customer's request must not fail on a mail hiccup
  void sendEmail({ to, subject, html, text, tag }).catch(() => {});
}

async function ownProject(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as any;
  const project = await prisma.project.findFirst({
    where: { id, userId: request.user.userId },
    select: {
      id: true,
      title: true,
      topic: true,
      currentStage: true,
      currency: true,
      userId: true,
      user: { select: { email: true } },
    },
  });
  if (!project) {
    reply.status(404).send({ success: false, error: "Not found" });
    return null;
  }
  return project;
}

async function projectFeedbackState(projectId: string) {
  const [feedback, corrections] = await Promise.all([
    prisma.bookFeedback.findUnique({ where: { projectId } }),
    prisma.correctionRequest.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  const open = corrections.filter((c) => isOpen(c.status)).length;
  return {
    feedback,
    corrections,
    correctionLimits: {
      max: MAX_CORRECTIONS,
      used: corrections.length,
      open,
      canRequest: open === 0 && corrections.length < MAX_CORRECTIONS,
    },
  };
}

export async function feedbackRoutes(app: FastifyInstance) {
  // ════════════════ CUSTOMER ════════════════

  // ━━━ GET /api/projects/:id/feedback ━━━ rating + correction requests
  app.get("/api/projects/:id/feedback", { preHandler: authenticate }, async (request, reply) => {
    const project = await ownProject(request, reply);
    if (!project) return;
    // chapter list for the "which part?" picker of the correction form
    const chapters = await prisma.chapter.findMany({
      where: { projectId: project.id },
      select: { chapterNumber: true, title: true },
      orderBy: { chapterNumber: "asc" },
    });
    return reply.send({
      success: true,
      data: { ...(await projectFeedbackState(project.id)), chapters },
    });
  });

  // ━━━ PUT /api/projects/:id/feedback ━━━ save / change the rating
  app.put("/api/projects/:id/feedback", { preHandler: authenticate }, async (request, reply) => {
    const project = await ownProject(request, reply);
    if (!project) return;
    if (project.currentStage !== "COMPLETED")
      return reply.status(400).send({ success: false, error: "The book is not finished yet" });

    const b = (request.body ?? {}) as any;
    const rating = Number(b.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5)
      return reply.status(400).send({ success: false, error: "Rating must be 1–5" });
    // reasons only explain a LOW rating; consent only makes sense for a HIGH one
    const reasons =
      rating <= 3 && Array.isArray(b.reasons)
        ? [...new Set(b.reasons as unknown[])]
            .filter((r): r is string => (FEEDBACK_REASONS as readonly string[]).includes(r as string))
        : [];
    const comment = typeof b.comment === "string" && b.comment.trim() ? b.comment.trim().slice(0, 4000) : null;
    const publishConsent = rating >= 4 && b.publishConsent === true;
    const publishName =
      publishConsent && typeof b.publishName === "string" && b.publishName.trim()
        ? b.publishName.trim().slice(0, 80)
        : null;

    const before = await prisma.bookFeedback.findUnique({ where: { projectId: project.id } });
    const data = { rating, reasons, comment, publishConsent, publishName };
    const feedback = await prisma.bookFeedback.upsert({
      where: { projectId: project.id },
      create: { projectId: project.id, userId: project.userId, ...data },
      update: data,
    });

    // Tell the owner about a new rating or a changed one (not every re-save).
    if (!before || before.rating !== rating || before.comment !== comment || before.publishConsent !== publishConsent) {
      notifyOwner(
        `Ocena ${"★".repeat(rating)}${"☆".repeat(5 - rating)}: ${bookName(project)}`,
        [
          ["Książka", bookName(project)],
          ["Klient", project.user.email],
          ["Ocena", `${rating}/5${before ? ` (wcześniej ${before.rating}/5)` : ""}`],
          ...(reasons.length ? ([["Powody", reasons.join(", ")]] as [string, string][]) : []),
          ...(comment ? ([["Komentarz", comment]] as [string, string][]) : []),
          ["Zgoda na publikację", publishConsent ? `tak${publishName ? ` (podpis: ${publishName})` : ""}` : "nie"],
        ],
        `${APP_URL}/admin/feedback`,
        "feedback_owner",
      );
    }
    return reply.send({ success: true, data: feedback });
  });

  // ━━━ DELETE /api/projects/:id/feedback ━━━
  app.delete("/api/projects/:id/feedback", { preHandler: authenticate }, async (request, reply) => {
    const project = await ownProject(request, reply);
    if (!project) return;
    await prisma.bookFeedback.deleteMany({ where: { projectId: project.id } });
    return reply.send({ success: true });
  });

  // ━━━ POST /api/projects/:id/corrections ━━━ "Check by a human"
  app.post("/api/projects/:id/corrections", { preHandler: authenticate }, async (request, reply) => {
    const project = await ownProject(request, reply);
    if (!project) return;
    if (project.currentStage !== "COMPLETED")
      return reply.status(400).send({ success: false, error: "The book is not finished yet" });

    const b = (request.body ?? {}) as any;
    const message = typeof b.message === "string" ? b.message.trim() : "";
    if (message.length < 10)
      return reply
        .status(400)
        .send({ success: false, code: "CORRECTION_TOO_SHORT", error: "Describe what to fix (at least 10 characters)" });

    let chapterNumber: number | null = null;
    let chapterTitle: string | null = null;
    if (b.chapterNumber != null && b.chapterNumber !== "") {
      const n = Number(b.chapterNumber);
      const ch = Number.isInteger(n)
        ? await prisma.chapter.findFirst({
            where: { projectId: project.id, chapterNumber: n },
            select: { chapterNumber: true, title: true },
          })
        : null;
      if (!ch) return reply.status(400).send({ success: false, error: "Unknown chapter" });
      chapterNumber = ch.chapterNumber;
      chapterTitle = ch.title;
    }

    const state = await projectFeedbackState(project.id);
    if (state.correctionLimits.open > 0)
      return reply.status(409).send({
        success: false,
        code: "CORRECTION_OPEN",
        error: "A request for this book is already being handled",
      });
    if (state.correctionLimits.used >= MAX_CORRECTIONS)
      return reply.status(409).send({
        success: false,
        code: "CORRECTION_LIMIT",
        error: `The limit of ${MAX_CORRECTIONS} requests for this book is used up`,
      });

    const created = await prisma.correctionRequest.create({
      data: {
        projectId: project.id,
        userId: project.userId,
        chapterNumber,
        message: message.slice(0, 6000),
      },
    });

    notifyOwner(
      `Zgłoszenie poprawek: ${bookName(project)}`,
      [
        ["Książka", bookName(project)],
        ["Klient", project.user.email],
        ["Zakres", chapterNumber ? `Rozdział ${chapterNumber}: ${chapterTitle}` : "Cała książka"],
        ["Zgłoszenie", `${state.correctionLimits.used + 1} z ${MAX_CORRECTIONS}`],
        ["Treść", created.message],
      ],
      `${APP_URL}/admin/feedback?tab=corrections`,
      "correction_owner",
    );
    return reply.status(201).send({ success: true, data: await projectFeedbackState(project.id) });
  });

  // ════════════════ ADMIN ════════════════
  const adminOnly = async (request: FastifyRequest, reply: FastifyReply) => {
    await authenticate(request, reply);
    if (reply.sent) return;
    const adminEmail = process.env.ADMIN_EMAIL;
    if (adminEmail && request.user.email !== adminEmail)
      return reply.status(403).send({ error: "Not admin" });
  };

  // ━━━ GET /api/admin/feedback ━━━ ratings, newest first + counters
  app.get("/api/admin/feedback", { preHandler: adminOnly }, async (_request, reply) => {
    const rows = await prisma.bookFeedback.findMany({
      orderBy: { createdAt: "desc" },
      take: 500,
      include: {
        project: {
          select: { id: true, title: true, topic: true, language: true, user: { select: { email: true, name: true } } },
        },
      },
    });
    const byRating: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    const byReason: Record<string, number> = {};
    for (const r of rows) {
      byRating[r.rating] = (byRating[r.rating] || 0) + 1;
      for (const reason of r.reasons) byReason[reason] = (byReason[reason] || 0) + 1;
    }
    const avg = rows.length ? rows.reduce((s, r) => s + r.rating, 0) / rows.length : null;
    return reply.send({
      success: true,
      data: {
        rows,
        stats: { count: rows.length, avg, byRating, byReason, publishable: rows.filter((r) => r.publishConsent).length },
      },
    });
  });

  // ━━━ GET /api/admin/corrections ━━━ the queue (open first)
  app.get("/api/admin/corrections", { preHandler: adminOnly }, async (_request, reply) => {
    const rows = await prisma.correctionRequest.findMany({
      orderBy: { createdAt: "desc" },
      take: 500,
      include: {
        project: {
          select: { id: true, title: true, topic: true, language: true, user: { select: { email: true, name: true } } },
        },
      },
    });
    const rank = (s: string) => (s === "open" ? 0 : s === "in_progress" ? 1 : 2);
    rows.sort((a, b) => rank(a.status) - rank(b.status) || +b.createdAt - +a.createdAt);
    const chapterKeys = rows.filter((r) => r.chapterNumber != null);
    const chapters = chapterKeys.length
      ? await prisma.chapter.findMany({
          where: { OR: chapterKeys.map((r) => ({ projectId: r.projectId, chapterNumber: r.chapterNumber! })) },
          select: { projectId: true, chapterNumber: true, title: true },
        })
      : [];
    const titleOf = new Map(chapters.map((c) => [`${c.projectId}:${c.chapterNumber}`, c.title]));
    return reply.send({
      success: true,
      data: {
        rows: rows.map((r) => ({
          ...r,
          chapterTitle: r.chapterNumber != null ? titleOf.get(`${r.projectId}:${r.chapterNumber}`) ?? null : null,
        })),
        open: rows.filter((r) => isOpen(r.status)).length,
      },
    });
  });

  // ━━━ PATCH /api/admin/corrections/:id ━━━ status + note; closing notifies
  app.patch("/api/admin/corrections/:id", { preHandler: adminOnly }, async (request, reply) => {
    const { id } = request.params as any;
    const b = (request.body ?? {}) as any;
    const current = await prisma.correctionRequest.findUnique({
      where: { id },
      include: {
        project: {
          select: { id: true, title: true, topic: true, currency: true, language: true, uiLang: true, user: { select: { id: true, email: true } } },
        },
      },
    });
    if (!current) return reply.status(404).send({ success: false, error: "Not found" });

    const status =
      typeof b.status === "string" && (CORRECTION_STATUSES as readonly string[]).includes(b.status)
        ? (b.status as string)
        : current.status;
    const adminNote =
      b.adminNote === undefined
        ? current.adminNote
        : typeof b.adminNote === "string" && b.adminNote.trim()
          ? b.adminNote.trim().slice(0, 6000)
          : null;
    const closing = !isOpen(status) && isOpen(current.status);

    const updated = await prisma.correctionRequest.update({
      where: { id },
      data: { status, adminNote, resolvedAt: isOpen(status) ? null : current.resolvedAt ?? new Date() },
    });

    if (closing) {
      const p = current.project;
      const lang = projectLang(p);
      const done = status === "done";
      const name = bookName(p);
      const link = `${APP_URL}/projects/${p.id}`;
      const title = done
        ? { pl: "Poprawki w Twojej książce są gotowe", en: "The corrections to your book are ready", de: "Die Korrekturen an Ihrem Buch sind fertig" }[lang]
        : { pl: "Odpowiedź na Twoje zgłoszenie", en: "A reply to your request", de: "Antwort auf Ihre Anfrage" }[lang];
      const intro = done
        ? {
            pl: `Sprawdziliśmy Twoje zgłoszenie do książki „${esc(name)}” i wprowadziliśmy poprawki. Nowa wersja czeka do pobrania.`,
            en: `We have reviewed your request for "${esc(name)}" and made the corrections. The new version is ready to download.`,
            de: `Wir haben Ihre Anfrage zum Buch „${esc(name)}“ geprüft und die Korrekturen vorgenommen. Die neue Version steht zum Download bereit.`,
          }[lang]
        : {
            pl: `Sprawdziliśmy Twoje zgłoszenie do książki „${esc(name)}”.`,
            en: `We have reviewed your request for "${esc(name)}".`,
            de: `Wir haben Ihre Anfrage zum Buch „${esc(name)}“ geprüft.`,
          }[lang];
      const noteHead = { pl: "Odpowiedź redaktora:", en: "Editor's reply:", de: "Antwort des Lektors:" }[lang];
      const cta = { pl: "Otwórz książkę", en: "Open the book", de: "Buch öffnen" }[lang];
      const noteBlock = adminNote
        ? `<p style="font-size:14px;font-weight:600;margin:20px 0 8px">${noteHead}</p>
<blockquote style="margin:0 0 12px;padding:10px 14px;border-left:3px solid #4f46e5;background:#f9fafb;font-size:14px;color:#374151;white-space:pre-wrap">${esc(adminNote)}</blockquote>`
        : "";
      try {
        await prisma.notification.create({
          data: {
            userId: p.user.id,
            type: done ? "correction_done" : "correction_closed",
            title,
            body: adminNote ? adminNote.slice(0, 300) : null,
            projectId: p.id,
          },
        });
      } catch {}
      void sendEmail({
        to: p.user.email,
        subject: `${title}: ${name}`,
        html: shell(`
<p style="font-size:15px;margin:0 0 16px">${intro}</p>
${noteBlock}
<p style="text-align:center;margin:20px 0 0">
<a href="${link}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;
   font-weight:700;padding:13px 28px;border-radius:10px">${cta}</a></p>`),
        text: [intro.replace(/&quot;/g, '"').replace(/&amp;/g, "&"), ...(adminNote ? ["", noteHead, adminNote] : []), "", link].join("\n"),
        tag: "correction_closed",
      }).catch(() => {});
    }
    return reply.send({ success: true, data: updated });
  });
}
