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
          // Mark that user has edited this
          status: "LATEX_READY",
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

    // Set stage to COMPILING so frontend shows progress
    await prisma.project.update({
      where: { id },
      data: {
        currentStage: "COMPILING",
        generationStatus: "COMPILING_LATEX",
      },
    });

    // Fire and forget — recompile in background
    const { compileBook } = await import("../services/bookCompiler");
    compileBook(id).catch(async (err) => {
      console.error(`❌ Recompile failed for ${id}:`, err);
      // Revert to COMPLETED even on failure so user can try again
      await prisma.project
        .update({
          where: { id },
          data: {
            currentStage: "COMPLETED",
            generationStatus: "COMPLETED",
          },
        })
        .catch(console.error);
    });

    return reply.send({ success: true, message: "Recompilation started" });
  });
}
