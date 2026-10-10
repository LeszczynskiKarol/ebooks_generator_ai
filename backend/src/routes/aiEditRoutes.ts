// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// AI edit of a finished book — API (services/aiEditService.ts).
//
// The customer gets a few targeted instructions per book ("shorten section
// 2", "explain this more simply"). Each one ends in a PREVIEW to accept or
// reject; the chapter does not change until they accept, and an accepted edit
// can be reverted. One edit is in flight at a time.
//
// Every route checks that the book belongs to the caller.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middleware/auth";
import {
  ACTIVE_STATUSES,
  AI_EDIT_HOURLY,
  AI_EDIT_LIMIT,
  AI_EDIT_MAX_FAILED,
  AI_EDIT_MAX_FRAGMENT,
  COUNTED_STATUSES,
  chapterSections,
  diffParagraphs,
  failStaleJobs,
  latexParagraphs,
  runEditJob,
  scopeRange,
} from "../services/aiEditService";

async function ownBook(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as any;
  const project = await prisma.project.findFirst({
    where: { id, userId: request.user.userId },
    select: { id: true, userId: true, language: true, currentStage: true },
  });
  if (!project) {
    reply.status(404).send({ success: false, error: "Not found" });
    return null;
  }
  return project;
}

const wordCount = (latex: string) =>
  latex
    .replace(/\\[a-zA-Z]+(\[.*?\])?(\{.*?\})?/g, " ")
    .replace(/[{}\\%$&_^~#]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1).length;

async function editState(project: { id: string; language: string; currentStage: string }) {
  await failStaleJobs(project.id);
  const [jobs, chapters] = await Promise.all([
    prisma.editJob.findMany({ where: { projectId: project.id }, orderBy: { createdAt: "desc" }, take: 30 }),
    prisma.chapter.findMany({
      where: { projectId: project.id, latexContent: { not: null } },
      select: { chapterNumber: true, title: true, latexContent: true },
      orderBy: { chapterNumber: "asc" },
    }),
  ]);
  const used = jobs.filter((j) => COUNTED_STATUSES.includes(j.status)).length;
  // too many refused/broken attempts close the feature for this book
  const failedOut = jobs.filter((j) => j.status === "failed").length >= AI_EDIT_MAX_FAILED;
  const active = jobs.find((j) => ACTIVE_STATUSES.includes(j.status)) ?? null;
  // The newest accepted edit can be undone while the chapter still holds it.
  const lastAccepted = jobs.find((j) => j.status === "accepted") ?? null;

  const preview =
    active && active.status === "preview" && active.contentBefore != null && active.contentAfter != null
      ? {
          diff: diffParagraphs(
            latexParagraphs(active.contentBefore, project.language),
            latexParagraphs(active.contentAfter, project.language),
          ),
          gate: active.gateResult,
        }
      : null;

  const brief = (j: (typeof jobs)[number]) => ({
    id: j.id,
    chapterNumber: j.chapterNumber,
    sectionIndex: j.sectionIndex,
    scopeLabel: j.scopeLabel,
    prompt: j.prompt,
    status: j.status,
    error: j.error,
    createdAt: j.createdAt,
  });

  return {
    limit: AI_EDIT_LIMIT,
    used,
    remaining: failedOut ? 0 : Math.max(0, AI_EDIT_LIMIT - used),
    maxFragment: AI_EDIT_MAX_FRAGMENT,
    available: project.currentStage === "COMPLETED",
    active: active ? { ...brief(active), preview } : null,
    revertableId: lastAccepted?.id ?? null,
    history: jobs.map(brief),
    scopes: chapters.map((c) => ({
      chapterNumber: c.chapterNumber,
      title: c.title,
      chars: c.latexContent!.length,
      sections: chapterSections(c.latexContent!).map((s) => ({ index: s.index, title: s.title, chars: s.chars })),
    })),
  };
}

export async function aiEditRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);

  // ━━━ GET /api/projects/:id/ai-edit ━━━ limits, scopes, the active edit
  app.get("/api/projects/:id/ai-edit", async (request, reply) => {
    const project = await ownBook(request, reply);
    if (!project) return;
    return reply.send({ success: true, data: await editState(project) });
  });

  // ━━━ POST /api/projects/:id/ai-edit ━━━ start one edit (async)
  app.post("/api/projects/:id/ai-edit", async (request, reply) => {
    const project = await ownBook(request, reply);
    if (!project) return;
    if (project.currentStage !== "COMPLETED")
      return reply.status(409).send({ success: false, code: "NOT_READY", error: "The book is not ready for edits right now" });

    const b = (request.body ?? {}) as any;
    const prompt = typeof b.prompt === "string" ? b.prompt.trim() : "";
    if (prompt.length < 5)
      return reply.status(400).send({ success: false, code: "PROMPT_TOO_SHORT", error: "Describe what to change" });
    const chapterNumber = Number(b.chapterNumber);
    const sectionIndex = b.sectionIndex == null || b.sectionIndex === "" ? null : Number(b.sectionIndex);
    if (!Number.isInteger(chapterNumber) || (sectionIndex != null && !Number.isInteger(sectionIndex)))
      return reply.status(400).send({ success: false, error: "Unknown scope" });

    const chapter = await prisma.chapter.findUnique({
      where: { projectId_chapterNumber: { projectId: project.id, chapterNumber } },
      select: { title: true, latexContent: true },
    });
    const range = chapter?.latexContent ? scopeRange(chapter.latexContent, sectionIndex) : null;
    if (!chapter?.latexContent || !range)
      return reply.status(400).send({ success: false, error: "Unknown scope" });
    const fragment = chapter.latexContent.slice(range.start, range.end);
    if (fragment.length > AI_EDIT_MAX_FRAGMENT)
      return reply.status(413).send({
        success: false,
        code: "SCOPE_TOO_LARGE",
        error: "This part is too long for one edit — pick a single section",
      });

    await failStaleJobs(project.id);
    const jobs = await prisma.editJob.findMany({ where: { projectId: project.id }, select: { status: true } });
    if (jobs.some((j) => ACTIVE_STATUSES.includes(j.status)))
      return reply.status(409).send({ success: false, code: "EDIT_ACTIVE", error: "Decide on the current edit first" });
    if (
      jobs.filter((j) => COUNTED_STATUSES.includes(j.status)).length >= AI_EDIT_LIMIT ||
      jobs.filter((j) => j.status === "failed").length >= AI_EDIT_MAX_FAILED
    )
      return reply.status(409).send({ success: false, code: "EDIT_LIMIT", error: "No AI edits left for this book" });
    const lastHour = await prisma.editJob.count({
      where: { userId: project.userId, createdAt: { gt: new Date(Date.now() - 3600_000) } },
    });
    if (lastHour >= AI_EDIT_HOURLY)
      return reply.status(429).send({ success: false, code: "EDIT_RATE", error: "Too many edits in a short time — try again later" });

    const sectionTitle = sectionIndex != null ? chapterSections(chapter.latexContent)[sectionIndex]?.title : null;
    const job = await prisma.editJob.create({
      data: {
        projectId: project.id,
        userId: project.userId,
        chapterNumber,
        sectionIndex,
        scopeLabel: sectionTitle ? `${chapterNumber}. ${chapter.title} › ${sectionTitle}` : `${chapterNumber}. ${chapter.title}`,
        prompt: prompt.slice(0, 2000),
        contentBefore: fragment,
      },
    });
    // Runs past the request: a chapter takes 1–3 minutes, longer than the
    // 60 s origin timeout. The client polls GET.
    void runEditJob(job.id);
    return reply.status(202).send({ success: true, data: await editState(project) });
  });

  // ━━━ POST /api/projects/:id/ai-edit/:jobId/accept ━━━ apply + recompile
  app.post("/api/projects/:id/ai-edit/:jobId/accept", async (request, reply) => {
    const project = await ownBook(request, reply);
    if (!project) return;
    const { jobId } = request.params as any;
    const job = await prisma.editJob.findFirst({ where: { id: jobId, projectId: project.id } });
    if (!job || job.status !== "preview" || job.contentBefore == null || job.contentAfter == null)
      return reply.status(409).send({ success: false, error: "Nothing to accept" });
    if (project.currentStage !== "COMPLETED")
      return reply.status(409).send({ success: false, code: "NOT_READY", error: "The book is being compiled — try again in a moment" });

    const applied = await applyFragment(project.id, job.chapterNumber, job.sectionIndex, job.contentBefore, job.contentAfter);
    if (!applied) {
      // The chapter was edited by hand since the preview was made. The edit
      // was made and shown, so it counts like a rejected one.
      await prisma.editJob.update({ where: { id: job.id }, data: { status: "rejected", error: "chapter_changed", decidedAt: new Date() } });
      return reply.status(409).send({
        success: false,
        code: "CHAPTER_CHANGED",
        error: "This part of the book changed since the preview was made — the edit no longer applies",
      });
    }
    await prisma.editJob.update({ where: { id: job.id }, data: { status: "accepted", decidedAt: new Date() } });
    const recompiling = await startRecompile(project.id);
    return reply.send({ success: true, data: { ...(await editState({ ...project, currentStage: recompiling ? "COMPILING" : project.currentStage })), recompiling } });
  });

  // ━━━ POST /api/projects/:id/ai-edit/:jobId/reject ━━━
  app.post("/api/projects/:id/ai-edit/:jobId/reject", async (request, reply) => {
    const project = await ownBook(request, reply);
    if (!project) return;
    const { jobId } = request.params as any;
    const done = await prisma.editJob.updateMany({
      where: { id: jobId, projectId: project.id, status: "preview" },
      data: { status: "rejected", decidedAt: new Date() },
    });
    if (done.count !== 1) return reply.status(409).send({ success: false, error: "Nothing to reject" });
    return reply.send({ success: true, data: await editState(project) });
  });

  // ━━━ POST /api/projects/:id/ai-edit/:jobId/revert ━━━ undo an accepted edit
  app.post("/api/projects/:id/ai-edit/:jobId/revert", async (request, reply) => {
    const project = await ownBook(request, reply);
    if (!project) return;
    const { jobId } = request.params as any;
    const job = await prisma.editJob.findFirst({ where: { id: jobId, projectId: project.id } });
    if (!job || job.status !== "accepted" || job.contentBefore == null || job.contentAfter == null)
      return reply.status(409).send({ success: false, error: "Nothing to revert" });
    if (project.currentStage !== "COMPLETED")
      return reply.status(409).send({ success: false, code: "NOT_READY", error: "The book is being compiled — try again in a moment" });

    // swap back: what is in the chapter now must still be the edited text
    const applied = await applyFragment(project.id, job.chapterNumber, null, job.contentAfter, job.contentBefore, true);
    if (!applied)
      return reply.status(409).send({
        success: false,
        code: "CHAPTER_CHANGED",
        error: "This part of the book changed after the edit — it can no longer be reverted automatically",
      });
    await prisma.editJob.update({ where: { id: job.id }, data: { status: "reverted", decidedAt: new Date() } });
    const recompiling = await startRecompile(project.id);
    return reply.send({ success: true, data: { ...(await editState({ ...project, currentStage: recompiling ? "COMPILING" : project.currentStage })), recompiling } });
  });

  /**
   * Replace `from` with `to` in the chapter. For an accept the fragment must
   * still sit exactly where the scope points; for a revert (`anywhere`) the
   * edited text is looked up in the chapter, since section offsets may have
   * moved. Returns false when the chapter no longer contains `from`.
   */
  async function applyFragment(
    projectId: string,
    chapterNumber: number,
    sectionIndex: number | null,
    from: string,
    to: string,
    anywhere = false,
  ): Promise<boolean> {
    const chapter = await prisma.chapter.findUnique({
      where: { projectId_chapterNumber: { projectId, chapterNumber } },
      select: { id: true, latexContent: true },
    });
    const content = chapter?.latexContent;
    if (!chapter || content == null) return false;

    let next: string | null = null;
    if (anywhere) {
      const at = content.indexOf(from);
      if (at !== -1 && content.indexOf(from, at + 1) === -1) next = content.slice(0, at) + to + content.slice(at + from.length);
    } else {
      const range = scopeRange(content, sectionIndex);
      if (range && content.slice(range.start, range.end) === from)
        next = content.slice(0, range.start) + to + content.slice(range.end);
    }
    if (next == null) return false;
    // keep the blank line between a replaced section and the next heading
    await prisma.chapter.update({
      where: { id: chapter.id },
      data: { latexContent: next, actualWords: wordCount(next), userEditedAt: new Date() },
    });
    return true;
  }

  /** Same as POST /recompile: queue the compile and show progress. */
  async function startRecompile(projectId: string): Promise<boolean> {
    try {
      const { enqueueGeneration } = await import("../lib/jobQueue");
      const result = await enqueueGeneration("compile", projectId);
      if (!result.enqueued) return false;
      await prisma.project.update({
        where: { id: projectId },
        data: { currentStage: "COMPILING", generationStatus: "COMPILING_LATEX" },
      });
      return true;
    } catch {
      return false;
    }
  }
}
