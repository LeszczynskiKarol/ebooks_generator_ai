import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middleware/auth";

export async function adminRoutes(app: FastifyInstance) {
  // Simple admin check — in production use proper role-based auth
  // For now: first registered user = admin, or check ADMIN_EMAIL env
  app.addHook("preHandler", async (request, reply) => {
    // Allow query param auth for convenience
    const queryToken = (request.query as any)?.token;
    if (queryToken && !request.headers.authorization) {
      request.headers.authorization = `Bearer ${queryToken}`;
    }
    await authenticate(request, reply);

    // Check admin
    const adminEmail = process.env.ADMIN_EMAIL;
    if (adminEmail && request.user.email !== adminEmail) {
      return reply.status(403).send({ error: "Not admin" });
    }
  });

  // ━━━ GET /api/admin/dashboard ━━━
  app.get("/api/admin/dashboard", async (request, reply) => {
    const [projectCount, userCount, paidCount, completedCount] =
      await Promise.all([
        prisma.project.count(),
        prisma.user.count(),
        prisma.project.count({ where: { paymentStatus: "PAID" } }),
        prisma.project.count({ where: { currentStage: "COMPLETED" } }),
      ]);

    const recentProjects = await prisma.project.findMany({
      take: 20,
      orderBy: { updatedAt: "desc" },
      include: {
        user: { select: { email: true, name: true } },
        _count: { select: { chapters: true } },
      },
    });

    const totalRevenue = await prisma.project.aggregate({
      where: { paymentStatus: "PAID" },
      _sum: { priceUsdCents: true, totalTokensUsed: true, totalCostUsd: true },
    });

    return reply.send({
      success: true,
      data: {
        stats: {
          projects: projectCount,
          users: userCount,
          paid: paidCount,
          completed: completedCount,
          revenue: (totalRevenue._sum.priceUsdCents || 0) / 100,
          totalTokens: totalRevenue._sum.totalTokensUsed || 0,
          totalCost: totalRevenue._sum.totalCostUsd || 0,
        },
        recentProjects: recentProjects.map((p) => ({
          id: p.id,
          title: p.title,
          topic: p.topic,
          stage: p.currentStage,
          paymentStatus: p.paymentStatus,
          generationStatus: p.generationStatus,
          progress: p.generationProgress,
          targetPages: p.targetPages,
          price: p.priceUsdCents ? (p.priceUsdCents / 100).toFixed(2) : null,
          tokens: p.totalTokensUsed,
          cost: p.totalCostUsd?.toFixed(4),
          user: p.user.email,
          chapters: p._count.chapters,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
        })),
      },
    });
  });

  // ━━━ GET /api/admin/projects/:id ━━━ Full project detail with ALL data
  app.get("/api/admin/projects/:id", async (request, reply) => {
    const { id } = request.params as any;

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, email: true, name: true } },
        structure: true,
        chapters: {
          orderBy: { chapterNumber: "asc" },
        },
        images: true,
      },
    });

    if (!project)
      return reply.status(404).send({ error: "Project not found" });

    return reply.send({
      success: true,
      data: {
        ...project,
        priceFormatted: project.priceUsdCents
          ? `$${(project.priceUsdCents / 100).toFixed(2)}`
          : null,
      },
    });
  });

  // ━━━ GET /api/admin/projects/:id/prompts ━━━ All prompts & responses
  app.get("/api/admin/projects/:id/prompts", async (request, reply) => {
    const { id } = request.params as any;

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        structure: {
          select: {
            generationPrompt: true,
            generationResponse: true,
            version: true,
            isUserEdited: true,
          },
        },
        chapters: {
          orderBy: { chapterNumber: "asc" },
          select: {
            id: true,
            chapterNumber: true,
            title: true,
            status: true,
            targetWords: true,
            actualWords: true,
            writerPrompts: true,
            writerResponses: true,
            latexContent: true,
          },
        },
      },
    });

    if (!project)
      return reply.status(404).send({ error: "Project not found" });

    // Parse chapter prompts/responses (stored as JSON arrays)
    const chapters = project.chapters.map((ch) => ({
      id: ch.id,
      number: ch.chapterNumber,
      title: ch.title,
      status: ch.status,
      targetWords: ch.targetWords,
      actualWords: ch.actualWords,
      latexContentLength: ch.latexContent?.length || 0,
      latexPreview: ch.latexContent?.slice(0, 500) || null,
      prompts: ch.writerPrompts ? JSON.parse(ch.writerPrompts) : [],
      responses: ch.writerResponses ? JSON.parse(ch.writerResponses) : [],
    }));

    return reply.send({
      success: true,
      data: {
        structure: project.structure
          ? {
              prompt: project.structure.generationPrompt,
              response: project.structure.generationResponse,
              version: project.structure.version,
              isUserEdited: project.structure.isUserEdited,
            }
          : null,
        chapters,
      },
    });
  });

  // ━━━ GET /api/admin/projects/:id/chapters/:num/latex ━━━ Full LaTeX
  app.get(
    "/api/admin/projects/:id/chapters/:num/latex",
    async (request, reply) => {
      const { id, num } = request.params as any;

      const chapter = await prisma.chapter.findUnique({
        where: {
          projectId_chapterNumber: {
            projectId: id,
            chapterNumber: parseInt(num),
          },
        },
      });

      if (!chapter)
        return reply.status(404).send({ error: "Chapter not found" });

      return reply.send({
        success: true,
        data: {
          chapterNumber: chapter.chapterNumber,
          title: chapter.title,
          status: chapter.status,
          latexContent: chapter.latexContent,
          targetWords: chapter.targetWords,
          actualWords: chapter.actualWords,
        },
      });
    },
  );

  // ━━━ POST /api/admin/projects/:id/recompile ━━━ Re-run pdflatex
  app.post("/api/admin/projects/:id/recompile", async (request, reply) => {
    const { id } = request.params as any;
    const { compileBook } = await import("../services/bookCompiler");
    compileBook(id).catch(console.error);
    return reply.send({ success: true, message: "Recompilation started" });
  });

  // ━━━ POST /api/admin/projects/:id/regenerate ━━━ Re-run full generation
  app.post("/api/admin/projects/:id/regenerate", async (request, reply) => {
    const { id } = request.params as any;
    const { generateContent } = await import("../services/contentGenerator");
    generateContent(id).catch(console.error);
    return reply.send({ success: true, message: "Regeneration started" });
  });

  // ━━━ GET /api/admin/users ━━━
  app.get("/api/admin/users", async (request, reply) => {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        _count: { select: { projects: true } },
      },
    });
    return reply.send({ success: true, data: users });
  });
}
