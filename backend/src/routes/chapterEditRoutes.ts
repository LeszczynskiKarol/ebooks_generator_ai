import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middleware/auth";

export async function chapterEditRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);

  // ━━━ GET /api/projects/:id/chapters ━━━
  // Return all chapters with full LaTeX content for editing
  app.get("/api/projects/:id/chapters", async (request, reply) => {
    const { id } = request.params as any;

    const project = await prisma.project.findFirst({
      where: { id, userId: request.user.userId },
      include: {
        chapters: {
          where: { status: "LATEX_READY" },
          select: {
            id: true,
            chapterNumber: true,
            title: true,
            latexContent: true,
            targetPages: true,
            actualWords: true,
            actualPages: true,
          },
          orderBy: { chapterNumber: "asc" },
        },
      },
    });

    if (!project) {
      return reply
        .status(404)
        .send({ success: false, error: "Project not found" });
    }

    return reply.send({
      success: true,
      data: project.chapters.map((ch) => ({
        id: ch.id,
        chapterNumber: ch.chapterNumber,
        title: ch.title,
        latexContent: ch.latexContent || "",
        targetPages: ch.targetPages,
        actualWords: ch.actualWords,
        actualPages: ch.actualPages,
      })),
    });
  });

  // ━━━ PUT /api/projects/:id/chapters/:chapterNumber ━━━
  // Update a single chapter's LaTeX content
  app.put(
    "/api/projects/:id/chapters/:chapterNumber",
    async (request, reply) => {
      const { id, chapterNumber } = request.params as any;
      const { latexContent } = request.body as any;

      if (typeof latexContent !== "string") {
        return reply
          .status(400)
          .send({ success: false, error: "latexContent required" });
      }

      // Verify ownership
      const project = await prisma.project.findFirst({
        where: { id, userId: request.user.userId },
      });
      if (!project) {
        return reply
          .status(404)
          .send({ success: false, error: "Project not found" });
      }
      if (
        project.currentStage !== "COMPLETED" &&
        project.currentStage !== "COMPILING"
      ) {
        return reply
          .status(400)
          .send({
            success: false,
            error: "Book must be completed before editing",
          });
      }

      const num = parseInt(chapterNumber);
      if (isNaN(num)) {
        return reply
          .status(400)
          .send({ success: false, error: "Invalid chapter number" });
      }

      // Update chapter content + recalculate word count
      const wordCount = latexContent
        .replace(/\\[a-zA-Z]+(\{[^}]*\})?/g, "")
        .split(/\s+/)
        .filter(Boolean).length;

      const chapter = await prisma.chapter.findUnique({
        where: {
          projectId_chapterNumber: { projectId: id, chapterNumber: num },
        },
      });
      if (!chapter) {
        return reply
          .status(404)
          .send({ success: false, error: "Chapter not found" });
      }

      await prisma.chapter.update({
        where: { id: chapter.id },
        data: {
          latexContent,
          actualWords: wordCount,
          status: "LATEX_READY",
          // Protects this chapter from being overwritten by regeneration/review
          userEditedAt: new Date(),
        },
      });

      return reply.send({
        success: true,
        data: { chapterNumber: num, actualWords: wordCount },
      });
    },
  );

  // ━━━ POST /api/projects/:id/recompile ━━━
  // Recompile the book from current chapter content → new PDF → overwrite S3
  app.post("/api/projects/:id/recompile", async (request, reply) => {
    const { id } = request.params as any;

    const project = await prisma.project.findFirst({
      where: { id, userId: request.user.userId },
    });
    if (!project) {
      return reply
        .status(404)
        .send({ success: false, error: "Project not found" });
    }
    if (project.currentStage !== "COMPLETED") {
      return reply
        .status(400)
        .send({
          success: false,
          error: "Book must be completed before recompiling",
        });
    }

    const { enqueueGeneration } = await import("../lib/jobQueue");
    const result = await enqueueGeneration("compile", id);
    if (!result.enqueued) {
      return reply.status(409).send({
        success: false,
        error: "Compilation already in progress",
      });
    }

    // Set stage to COMPILING so frontend shows progress
    // (worker reverts to COMPLETED if compilation fails)
    await prisma.project.update({
      where: { id },
      data: {
        currentStage: "COMPILING",
        generationStatus: "COMPILING_LATEX",
      },
    });

    return reply.send({ success: true, message: "Recompilation started" });
  });
}
