import { FastifyInstance } from "fastify";
import Stripe from "stripe";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middleware/auth";
import {
  calculatePrice,
  getPageSizeTier,
  MIN_PAGES,
  MAX_PAGES,
} from "../lib/types";

export async function projectRoutes(app: FastifyInstance) {
  // All routes need auth
  app.addHook("preHandler", authenticate);

  // ━━━ POST /api/projects ━━━
  app.post("/api/projects", async (request, reply) => {
    const {
      topic,
      title,
      targetPages,
      language,
      guidelines,
      stylePreset,
      bookFormat,
      customColors,
      authorName,
      subtitle,
    } = request.body as any;

    if (!topic || topic.length < 5) {
      return reply
        .status(400)
        .send({ success: false, error: "Topic must be at least 5 characters" });
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      return reply
        .status(500)
        .send({ success: false, error: "Stripe not configured" });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    // Snap to nearest tier
    const rawPages = Math.max(
      MIN_PAGES,
      Math.min(MAX_PAGES, parseInt(targetPages) || 60),
    );
    const tier = getPageSizeTier(rawPages);
    const pages = tier.targetPages;
    const pricing = calculatePrice(pages);

    // Validate & serialize custom colors (max 3 hex)
    let serializedColors: string | null = null;
    if (Array.isArray(customColors) && customColors.length > 0) {
      const validColors = customColors
        .slice(0, 3)
        .filter(
          (c: any) => typeof c === "string" && /^#[0-9A-Fa-f]{6}$/.test(c),
        );
      if (validColors.length > 0) {
        serializedColors = JSON.stringify(validColors);
      }
    }

    // ── Create project ──
    const project = await prisma.project.create({
      data: {
        userId: request.user.userId,
        topic,
        title: title || null,
        targetPages: pages,
        language: language || "en",
        guidelines: guidelines || null,
        stylePreset: stylePreset || "modern",
        bookFormat: bookFormat || "a5",
        priceUsdCents: pricing.priceUsdCents,
        currentStage: "PAYMENT",
        authorName: authorName || null,
        subtitle: subtitle || null,
        customColors: serializedColors,
      },
    });

    // ── Create Stripe session immediately ──
    const user = await prisma.user.findUnique({
      where: { id: request.user.userId },
    });
    let customerId = user?.stripeCustomerId;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user!.email,
        name: user!.name || undefined,
        metadata: { userId: user!.id },
      });
      customerId = customer.id;
      await prisma.user.update({
        where: { id: user!.id },
        data: { stripeCustomerId: customerId },
      });
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: pricing.priceUsdCents,
            product_data: {
              name: `eBook: ${title || topic}`,
              description: `${pages}-page professional eBook`,
            },
          },
          quantity: 1,
        },
      ],
      metadata: { projectId: project.id, userId: request.user.userId },
      success_url: `${process.env.FRONTEND_URL}/projects/${project.id}?payment=success`,
      cancel_url: `${process.env.FRONTEND_URL}/projects/${project.id}?payment=cancelled`,
    });

    await prisma.project.update({
      where: { id: project.id },
      data: { stripeSessionId: session.id },
    });

    return reply.status(201).send({
      success: true,
      data: {
        project: formatProject(project),
        pricing: { ...pricing, tierLabel: pricing.tier.label },
        sessionUrl: session.url, // ← frontend uses this to redirect
      },
    });
  });

  // ━━━ GET /api/projects ━━━
  app.get("/api/projects", async (request, reply) => {
    const projects = await prisma.project.findMany({
      where: { userId: request.user.userId },
      orderBy: { updatedAt: "desc" },
    });
    return reply.send({ success: true, data: projects.map(formatProject) });
  });

  // ━━━ GET /api/projects/:id ━━━
  app.get("/api/projects/:id", async (request, reply) => {
    const { id } = request.params as any;
    const project = await prisma.project.findFirst({
      where: { id, userId: request.user.userId },
      include: {
        structure: {
          select: {
            id: true,
            structureJson: true,
            version: true,
            isUserEdited: true,
            approvedAt: true,
          },
        },
        chapters: {
          select: {
            id: true,
            chapterNumber: true,
            title: true,
            targetPages: true,
            status: true,
          },
          orderBy: { chapterNumber: "asc" },
        },
        images: {
          select: {
            id: true,
            source: true,
            originalName: true,
            s3Url: true,
            description: true,
          },
        },
      },
    });
    if (!project)
      return reply
        .status(404)
        .send({ success: false, error: "Project not found" });
    return reply.send({ success: true, data: formatProject(project) });
  });

  // ━━━ PATCH /api/projects/:id/brief ━━━
  app.patch("/api/projects/:id/brief", async (request, reply) => {
    const { id } = request.params as any;
    const project = await prisma.project.findFirst({
      where: { id, userId: request.user.userId },
    });
    if (!project)
      return reply.status(404).send({ success: false, error: "Not found" });
    if (project.paymentStatus === "PAID") {
      return reply
        .status(403)
        .send({ success: false, error: "Cannot edit after payment" });
    }

    const body = request.body as any;
    const data: any = {};
    if (body.topic) data.topic = body.topic;
    if (body.title !== undefined) data.title = body.title;
    if (body.language) data.language = body.language;
    if (body.guidelines !== undefined) data.guidelines = body.guidelines;
    if (body.authorName !== undefined)
      data.authorName = body.authorName || null;
    if (body.subtitle !== undefined) data.subtitle = body.subtitle || null;
    if (body.stylePreset) data.stylePreset = body.stylePreset;
    if (body.bookFormat) data.bookFormat = body.bookFormat;
    if (body.targetPages) {
      const rawPages = Math.max(
        MIN_PAGES,
        Math.min(MAX_PAGES, parseInt(body.targetPages)),
      );
      const tier = getPageSizeTier(rawPages);
      data.targetPages = tier.targetPages;
      data.priceUsdCents = calculatePrice(data.targetPages).priceUsdCents;
    }
    // Custom colors update
    if (body.customColors !== undefined) {
      if (Array.isArray(body.customColors) && body.customColors.length > 0) {
        const validColors = body.customColors
          .slice(0, 3)
          .filter(
            (c: any) => typeof c === "string" && /^#[0-9A-Fa-f]{6}$/.test(c),
          );
        data.customColors =
          validColors.length > 0 ? JSON.stringify(validColors) : null;
      } else {
        data.customColors = null;
      }
    }

    const updated = await prisma.project.update({ where: { id }, data });
    return reply.send({ success: true, data: formatProject(updated) });
  });

  // ━━━ POST /api/projects/:id/checkout ━━━
  app.post("/api/projects/:id/checkout", async (request, reply) => {
    if (!process.env.STRIPE_SECRET_KEY) {
      return reply
        .status(500)
        .send({ success: false, error: "Stripe not configured" });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const { id } = request.params as any;
    const project = await prisma.project.findFirst({
      where: { id, userId: request.user.userId },
    });

    if (!project)
      return reply.status(404).send({ success: false, error: "Not found" });
    if (project.paymentStatus === "PAID")
      return reply.status(400).send({ success: false, error: "Already paid" });
    if (!project.priceUsdCents)
      return reply.status(400).send({ success: false, error: "Price not set" });

    const user = await prisma.user.findUnique({
      where: { id: request.user.userId },
    });
    let customerId = user?.stripeCustomerId;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user!.email,
        name: user!.name || undefined,
        metadata: { userId: user!.id },
      });
      customerId = customer.id;
      await prisma.user.update({
        where: { id: user!.id },
        data: { stripeCustomerId: customerId },
      });
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: project.priceUsdCents,
            product_data: {
              name: `eBook: ${project.title || project.topic}`,
              description: `${project.targetPages}-page professional eBook`,
            },
          },
          quantity: 1,
        },
      ],
      metadata: { projectId: project.id, userId: request.user.userId },
      success_url: `${process.env.FRONTEND_URL}/projects/${project.id}?payment=success`,
      cancel_url: `${process.env.FRONTEND_URL}/projects/${project.id}?payment=cancelled`,
    });

    await prisma.project.update({
      where: { id },
      data: { stripeSessionId: session.id, currentStage: "PAYMENT" },
    });
    return reply.send({
      success: true,
      data: { sessionUrl: session.url, sessionId: session.id },
    });
  });

  // ━━━ PUT /api/projects/:id/structure ━━━
  app.put("/api/projects/:id/structure", async (request, reply) => {
    const { id } = request.params as any;
    const project = await prisma.project.findFirst({
      where: { id, userId: request.user.userId },
      include: { structure: true },
    });
    if (!project?.structure)
      return reply
        .status(404)
        .send({ success: false, error: "Structure not found" });

    const { chapters } = request.body as any;
    await prisma.projectStructure.update({
      where: { id: project.structure.id },
      data: {
        structureJson: JSON.stringify({ chapters }),
        isUserEdited: true,
        version: { increment: 1 },
      },
    });
    return reply.send({ success: true, message: "Structure updated" });
  });

  // ━━━ POST /api/projects/:id/structure/approve ━━━
  app.post("/api/projects/:id/structure/approve", async (request, reply) => {
    const { id } = request.params as any;
    const project = await prisma.project.findFirst({
      where: { id, userId: request.user.userId },
      include: { structure: true },
    });
    if (!project?.structure)
      return reply
        .status(404)
        .send({ success: false, error: "Structure not found" });

    await prisma.projectStructure.update({
      where: { id: project.structure.id },
      data: { approvedAt: new Date() },
    });
    await prisma.project.update({
      where: { id },
      data: { currentStage: "IMAGES" },
    });
    return reply.send({ success: true, message: "Structure approved" });
  });

  app.patch("/api/projects/:id/title-page", async (request, reply) => {
    const { id } = request.params as any;
    const project = await prisma.project.findFirst({
      where: { id, userId: request.user.userId },
    });
    if (!project)
      return reply.status(404).send({ success: false, error: "Not found" });

    const body = request.body as any;
    const data: any = {};

    if (body.title !== undefined) data.title = body.title || null;
    if (body.authorName !== undefined)
      data.authorName = body.authorName || null;
    if (body.subtitle !== undefined) data.subtitle = body.subtitle || null;
    // Colophon fields
    if (body.colophonText !== undefined)
      data.colophonText = body.colophonText || null;
    if (body.colophonFontSize !== undefined) {
      const size = parseInt(body.colophonFontSize);
      if ([8, 9, 10, 11, 12, 14].includes(size)) data.colophonFontSize = size;
    }
    if (body.colophonEnabled !== undefined)
      data.colophonEnabled = !!body.colophonEnabled;
    const updated = await prisma.project.update({ where: { id }, data });
    console.log("[TITLE-PAGE PATCH] Updated fields:", {
      title: updated.title,
      authorName: updated.authorName,
      subtitle: updated.subtitle,
    });

    return reply.send({ success: true, data: formatProject(updated) });
  });

  // ━━━ POST /api/projects/:id/structure/redo ━━━
  app.post("/api/projects/:id/structure/redo", async (request, reply) => {
    const { id } = request.params as any;
    const { feedback } = request.body as any;
    const project = await prisma.project.findFirst({
      where: { id, userId: request.user.userId },
    });
    if (!project)
      return reply.status(404).send({ success: false, error: "Not found" });
    if (project.structureRedoUsed) {
      return reply.status(403).send({
        success: false,
        error: "Redo already used. Edit manually instead.",
      });
    }

    await prisma.project.update({
      where: { id },
      data: { structureRedoUsed: true, currentStage: "STRUCTURE" },
    });

    const { generateStructure } =
      await import("../services/structureGenerator");
    generateStructure(id).catch((err) => {
      console.error(`❌ Structure redo failed for ${id}:`, err);
    });

    return reply.send({ success: true, message: "Regeneration started" });
  });

  // ━━━ POST /api/projects/:id/generate ━━━
  app.post("/api/projects/:id/generate", async (request, reply) => {
    const { id } = request.params as any;
    const project = await prisma.project.findFirst({
      where: { id, userId: request.user.userId },
      include: { structure: true },
    });
    if (!project)
      return reply.status(404).send({ success: false, error: "Not found" });
    if (project.paymentStatus !== "PAID")
      return reply
        .status(403)
        .send({ success: false, error: "Payment required" });
    if (!project.structure?.approvedAt)
      return reply
        .status(400)
        .send({ success: false, error: "Approve structure first" });

    await prisma.project.update({
      where: { id },
      data: {
        generationStatus: "GENERATING_CONTENT",
        currentStage: "GENERATING",
        generationProgress: 0,
      },
    });

    const { generateContent } = await import("../services/contentGenerator");
    generateContent(id).catch((err) => {
      console.error(`❌ Content generation failed for ${id}:`, err);
      prisma.project
        .update({
          where: { id },
          data: { currentStage: "ERROR", generationStatus: "ERROR" },
        })
        .catch(console.error);
    });

    return reply.send({ success: true, message: "Generation started" });
  });

  // ━━━ GET /api/projects/:id/generation/status ━━━
  app.get("/api/projects/:id/generation/status", async (request, reply) => {
    const { id } = request.params as any;
    const project = await prisma.project.findFirst({
      where: { id, userId: request.user.userId },
      include: {
        chapters: {
          select: { chapterNumber: true, title: true, status: true },
          orderBy: { chapterNumber: "asc" },
        },
      },
    });
    if (!project)
      return reply.status(404).send({ success: false, error: "Not found" });

    return reply.send({
      success: true,
      data: {
        status: project.generationStatus,
        progress: project.generationProgress,
        chapters: project.chapters,
      },
    });
  });

  // ━━━ DELETE /api/projects/:id ━━━
  app.delete("/api/projects/:id", async (request, reply) => {
    const { id } = request.params as any;
    const project = await prisma.project.findFirst({
      where: { id, userId: request.user.userId },
    });
    if (!project)
      return reply.status(404).send({ success: false, error: "Not found" });
    if (project.paymentStatus === "PAID") {
      return reply
        .status(403)
        .send({ success: false, error: "Cannot delete paid project" });
    }
    await prisma.project.delete({ where: { id } });
    return reply.send({ success: true, message: "Deleted" });
  });
}

function formatProject(p: any) {
  return {
    ...p,
    priceUsdFormatted: p.priceUsdCents
      ? `$${(p.priceUsdCents / 100).toFixed(2)}`
      : null,
    // Parse customColors back to array for frontend
    customColors: p.customColors ? JSON.parse(p.customColors) : null,
  };
}
