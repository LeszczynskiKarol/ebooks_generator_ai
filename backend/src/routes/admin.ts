import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middleware/auth";

export async function adminRoutes(app: FastifyInstance) {
  app.addHook("preHandler", async (request, reply) => {
    const queryToken = (request.query as any)?.token;
    if (queryToken && !request.headers.authorization) {
      request.headers.authorization = `Bearer ${queryToken}`;
    }
    await authenticate(request, reply);

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
          hasResearch: !!p.researchData,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
        })),
      },
    });
  });

  // ━━━ GET /api/admin/projects/:id ━━━ Full project detail
  app.get("/api/admin/projects/:id", async (request, reply) => {
    const { id } = request.params as any;

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, email: true, name: true } },
        structure: true,
        chapters: { orderBy: { chapterNumber: "asc" } },
        images: true,
      },
    });

    if (!project) return reply.status(404).send({ error: "Project not found" });

    // Parse research summary (don't send full source texts here — too heavy)
    let researchSummary = null;
    if (project.researchData) {
      try {
        const rd = JSON.parse(project.researchData);
        researchSummary = {
          googleQuery: rd.googleQuery,
          searchResultsCount: rd.searchResults?.length || 0,
          scrapedCount: rd.allScraped?.length || 0,
          scrapedSuccessCount:
            rd.allScraped?.filter((s: any) => s.status === "success").length ||
            0,
          selectedSourcesCount: rd.selectedSources?.length || 0,
          totalSourcesLength: rd.totalSourcesLength || 0,
          researchedAt: rd.researchedAt,
        };
      } catch {}
    }

    return reply.send({
      success: true,
      data: {
        ...project,
        researchData: undefined, // Don't send raw blob in overview
        researchSummary,
        priceFormatted: project.priceUsdCents
          ? `$${(project.priceUsdCents / 100).toFixed(2)}`
          : null,
      },
    });
  });

  // ━━━ GET /api/admin/projects/:id/research ━━━ Full research pipeline data
  app.get("/api/admin/projects/:id/research", async (request, reply) => {
    const { id } = request.params as any;

    const project = await prisma.project.findUnique({
      where: { id },
      select: { researchData: true, topic: true, language: true },
    });

    if (!project) return reply.status(404).send({ error: "Project not found" });

    if (!project.researchData) {
      return reply.send({
        success: true,
        data: null,
        message: "No research conducted yet",
      });
    }

    try {
      const research = JSON.parse(project.researchData);
      return reply.send({
        success: true,
        data: {
          googleQuery: research.googleQuery,
          englishQuery: research.englishQuery || null,
          researchedAt: research.researchedAt,
          selectionReasoning: research.selectionReasoning || null,

          // Google search results (target language)
          searchResults: research.searchResults || [],

          // English search results (if supplement was run)
          englishSearchResults: research.englishSearchResults || [],

          // Scraping results (metadata only)
          scrapingResults: (research.allScraped || []).map((s: any) => ({
            url: s.url,
            status: s.status,
            length: s.length,
          })),

          // Selected sources (with preview + lang tag)
          selectedSources: (research.selectedSources || []).map(
            (s: any, i: number) => ({
              index: i + 1,
              url: s.url,
              lang: s.lang || "?",
              length: s.length,
              textPreview: s.text?.substring(0, 2000) || "",
              fullTextLength: s.text?.length || 0,
            }),
          ),

          // Stats
          stats: {
            totalSearchResults:
              (research.searchResults?.length || 0) +
              (research.englishSearchResults?.length || 0),
            totalScraped: research.allScraped?.length || 0,
            successfulScrapes:
              research.allScraped?.filter((s: any) => s.status === "success")
                .length || 0,
            failedScrapes:
              research.allScraped?.filter((s: any) => s.status !== "success")
                .length || 0,
            selectedCount: research.selectedSources?.length || 0,
            nativeSources:
              research.selectedSources?.filter((s: any) => s.lang !== "en")
                .length || 0,
            englishSources:
              research.selectedSources?.filter((s: any) => s.lang === "en")
                .length || 0,
            totalSourceChars: research.totalSourcesLength || 0,
          },
        },
      });
    } catch (error) {
      return reply.status(500).send({ error: "Failed to parse research data" });
    }
  });

  // ━━━ GET /api/admin/projects/:id/research/source/:num ━━━ Full text of a single source
  app.get(
    "/api/admin/projects/:id/research/source/:num",
    async (request, reply) => {
      const { id, num } = request.params as any;
      const sourceIndex = parseInt(num) - 1;

      const project = await prisma.project.findUnique({
        where: { id },
        select: { researchData: true },
      });

      if (!project?.researchData)
        return reply.status(404).send({ error: "No research data" });

      try {
        const research = JSON.parse(project.researchData);
        const source = research.selectedSources?.[sourceIndex];
        if (!source)
          return reply.status(404).send({ error: `Source ${num} not found` });

        return reply.send({
          success: true,
          data: {
            index: sourceIndex + 1,
            url: source.url,
            length: source.length,
            text: source.text,
          },
        });
      } catch {
        return reply
          .status(500)
          .send({ error: "Failed to parse research data" });
      }
    },
  );

  // ━━━ POST /api/admin/projects/:id/re-research ━━━ Re-run research pipeline
  app.post("/api/admin/projects/:id/re-research", async (request, reply) => {
    const { id } = request.params as any;
    const { conductResearch } = await import("../services/researchService");
    conductResearch(id).catch(console.error);
    return reply.send({ success: true, message: "Research pipeline started" });
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

    if (!project) return reply.status(404).send({ error: "Project not found" });

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

  // ━━━ POST /api/admin/projects/:id/recompile ━━━
  app.post("/api/admin/projects/:id/recompile", async (request, reply) => {
    const { id } = request.params as any;
    const { compileBook } = await import("../services/bookCompiler");
    compileBook(id).catch(console.error);
    return reply.send({ success: true, message: "Recompilation started" });
  });

  // ━━━ POST /api/admin/projects/:id/regenerate ━━━
  app.post("/api/admin/projects/:id/regenerate", async (request, reply) => {
    const { id } = request.params as any;
    const { generateContent } = await import("../services/contentGenerator");
    generateContent(id).catch(console.error);
    return reply.send({ success: true, message: "Regeneration started" });
  });

  // ━━━ POST /api/admin/projects/:id/regenerate-structure ━━━
  app.post(
    "/api/admin/projects/:id/regenerate-structure",
    async (request, reply) => {
      const { id } = request.params as any;
      const { generateStructure } =
        await import("../services/structureGenerator");
      generateStructure(id).catch(console.error);
      return reply.send({
        success: true,
        message: "Structure regeneration started",
      });
    },
  );

  // ━━━ DELETE /api/admin/projects/:id ━━━ Admin force-delete (even paid)
  app.delete("/api/admin/projects/:id", async (request, reply) => {
    const { id } = request.params as any;

    const project = await prisma.project.findUnique({
      where: { id },
      select: { id: true, title: true, topic: true, paymentStatus: true },
    });
    if (!project) return reply.status(404).send({ error: "Project not found" });

    // Cascade deletes handle chapters, structure, images, placements
    await prisma.project.delete({ where: { id } });

    console.log(
      `🗑️ Admin deleted project ${id} (${project.title || project.topic})`,
    );
    return reply.send({ success: true, message: "Project deleted" });
  });

  // ━━━ GET /api/admin/projects/:id/download/pdf ━━━ Admin download (any project)
  app.get("/api/admin/projects/:id/download/pdf", async (request, reply) => {
    const { id } = request.params as any;

    const project = await prisma.project.findUnique({
      where: { id },
      include: { structure: true },
    });

    if (!project) return reply.status(404).send({ error: "Project not found" });

    const structureData = project.structure
      ? JSON.parse(project.structure.structureJson)
      : null;
    const bookTitle =
      structureData?.suggestedTitle || project.title || project.topic;
    const filename = sanitizeFilename(bookTitle) + ".pdf";

    // Try S3
    if (
      project.outputPdfKey &&
      process.env.AWS_ACCESS_KEY_ID &&
      process.env.S3_BUCKET
    ) {
      try {
        const { S3Client, GetObjectCommand } =
          await import("@aws-sdk/client-s3");
        const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");

        const s3 = new S3Client({
          region: process.env.AWS_REGION || "eu-north-1",
          credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
          },
        });

        const url = await getSignedUrl(
          s3,
          new GetObjectCommand({
            Bucket: process.env.S3_BUCKET,
            Key: project.outputPdfKey,
            ResponseContentDisposition: `attachment; filename="${filename}"`,
          }),
          { expiresIn: 3600 },
        );

        return reply.redirect(url);
      } catch (err: any) {
        console.error("Admin S3 download failed:", err.message);
      }
    }

    // Fallback: local
    const path = await import("path");
    const fs = await import("fs");
    const localPdf = path.join(process.cwd(), "tmp", "builds", id, "book.pdf");
    if (!fs.existsSync(localPdf)) {
      return reply.status(404).send({ error: "PDF not found" });
    }

    const pdfBuffer = fs.readFileSync(localPdf);
    return reply
      .header("Content-Type", "application/pdf")
      .header("Content-Disposition", `attachment; filename="${filename}"`)
      .header("Content-Length", pdfBuffer.length)
      .send(pdfBuffer);
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

function sanitizeFilename(name: string): string {
  const diacriticMap: Record<string, string> = {
    ą: "a",
    ć: "c",
    ę: "e",
    ł: "l",
    ń: "n",
    ó: "o",
    ś: "s",
    ź: "z",
    ż: "z",
    Ą: "A",
    Ć: "C",
    Ę: "E",
    Ł: "L",
    Ń: "N",
    Ó: "O",
    Ś: "S",
    Ź: "Z",
    Ż: "Z",
    ä: "a",
    ö: "o",
    ü: "u",
    ß: "ss",
    Ä: "A",
    Ö: "O",
    Ü: "U",
    é: "e",
    è: "e",
    ê: "e",
    à: "a",
    â: "a",
    î: "i",
    ô: "o",
    û: "u",
    ç: "c",
    ñ: "n",
    á: "a",
    í: "i",
    ú: "u",
  };
  return name
    .split("")
    .map((ch) => diacriticMap[ch] || ch)
    .join("")
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .substring(0, 80);
}
