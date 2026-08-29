import { FastifyInstance, FastifyRequest } from "fastify";
import Stripe from "stripe";
import { prisma } from "../lib/prisma";
import { resolveNumbering, isNumberingMode } from "../lib/numbering";
import { authenticate } from "../middleware/auth";
import {
  calculatePrice,
  getPageSizeTier,
  MIN_PAGES,
  MAX_PAGES,
} from "../lib/types";
import { getUsdPlnRate } from "../services/exchangeRateService";

/** Build a Stripe price_data line in the project's currency (USD base, or PLN
 *  converted at the given rate). PLN minor unit is grosze. */
function priceLine(
  currency: string,
  priceUsdCents: number,
  rate: number | null,
  name: string,
  description: string,
) {
  const pln = currency === "pln" && rate;
  return {
    price_data: {
      currency: pln ? "pln" : "usd",
      unit_amount: pln ? Math.round(priceUsdCents * rate) : priceUsdCents,
      product_data: { name, description },
    },
    quantity: 1,
  };
}

function isAdmin(email: string): boolean {
  return !!process.env.ADMIN_EMAIL && email === process.env.ADMIN_EMAIL;
}

interface StripeConfig {
  stripe: Stripe;
  webhookSecret: string;
  testMode: boolean;
}

/** Pick the live or test Stripe keys based on whether the current user is the
 *  admin. Returns null if the required env vars are missing. */
function getStripeConfig(request: FastifyRequest): StripeConfig | null {
  const testMode = isAdmin(request.user.email);
  const secretKey = testMode
    ? process.env.STRIPE_SECRET_KEY_TEST
    : process.env.STRIPE_SECRET_KEY;
  const webhookSecret = testMode
    ? process.env.STRIPE_WEBHOOK_SECRET_TEST
    : process.env.STRIPE_WEBHOOK_SECRET;

  if (!secretKey || !webhookSecret) return null;

  return {
    stripe: new Stripe(secretKey),
    webhookSecret,
    testMode,
  };
}

/**
 * Return a Stripe customer id valid for the CURRENT Stripe mode. If the stored
 * id is missing or stale (e.g. a test-mode id used under a live key after
 * switching to production), recreate the customer and persist the new id.
 */
async function ensureStripeCustomer(
  stripe: Stripe,
  userId: string,
  testMode: boolean,
): Promise<string> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");

  const storedId = testMode ? user.stripeCustomerIdTest : user.stripeCustomerId;

  if (storedId) {
    try {
      const c = await stripe.customers.retrieve(storedId);
      if (!(c as any).deleted) return storedId;
    } catch {
      // stale id (wrong Stripe mode / deleted) — fall through and recreate
    }
  }
  const customer = await stripe.customers.create({
    email: user.email,
    name: user.name || undefined,
    metadata: { userId: user.id, testMode: String(testMode) },
  });
  await prisma.user.update({
    where: { id: user.id },
    data: testMode
      ? { stripeCustomerIdTest: customer.id }
      : { stripeCustomerId: customer.id },
  });
  return customer.id;
}

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
      coverOption,
      currency: reqCurrency,
      paymentProvider,
    } = request.body as any;

    if (!topic || topic.length < 5) {
      return reply
        .status(400)
        .send({ success: false, error: "Topic must be at least 5 characters" });
    }

    // Mobile app pays through Google Play (POST /api/play/verify) — no Stripe
    // session is created; the app gets the SKU to buy instead.
    const viaPlay = paymentProvider === "play";
    const stripeConfig = viaPlay ? null : getStripeConfig(request);
    if (!viaPlay && !stripeConfig) {
      return reply
        .status(500)
        .send({ success: false, error: "Stripe not configured" });
    }

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

    // ── Currency: USD base, PLN converted at the live NBP rate ──
    const usePln = reqCurrency === "pln";
    const fxRate = usePln ? (await getUsdPlnRate()).rate : null;

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
        currency: usePln ? "pln" : "usd",
        exchangeRate: fxRate,
        currentStage: "PAYMENT",
        authorName: authorName || null,
        subtitle: subtitle || null,
        customColors: serializedColors,
        autoCoverRequested: coverOption === "generate",
        useAiImages: (request.body as any).useAiImages === true,
        imageGuidelines:
          typeof (request.body as any).imageGuidelines === "string"
            ? (request.body as any).imageGuidelines.slice(0, 1000) || null
            : null,
        imageDensity: ["standard", "rich"].includes(
          (request.body as any).imageDensity,
        )
          ? (request.body as any).imageDensity
          : "standard",
        footnoteMode: ["auto", "always", "never"].includes(
          (request.body as any).footnoteMode,
        )
          ? (request.body as any).footnoteMode
          : "auto",
      },
    });

    if (viaPlay) {
      const { skuForPages } = await import("../lib/playBilling");
      return reply.status(201).send({
        success: true,
        data: {
          project: formatProject(project),
          pricing: { ...pricing, tierLabel: pricing.tier.label },
          playSku: skuForPages(pages),
        },
      });
    }

    // ── Create Stripe session immediately ──
    const { stripe, testMode } = stripeConfig!;
    const customerId = await ensureStripeCustomer(
      stripe,
      request.user.userId,
      testMode,
    );

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "payment",
      payment_method_types: usePln ? ["card", "blik"] : ["card"],
      line_items: [
        priceLine(
          usePln ? "pln" : "usd",
          pricing.priceUsdCents,
          fxRate,
          `eBook: ${title || topic}`,
          usePln
            ? `Profesjonalny eBook (${pages} stron)`
            : `${pages}-page professional eBook`,
        ),
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
        versions: {
          select: { createdAt: true },
          orderBy: { version: "desc" },
          take: 1,
        },
      },
    });
    if (!project)
      return reply
        .status(404)
        .send({ success: false, error: "Project not found" });

    // Cover changed after the newest compiled version → downloads need a
    // recompile. A cover baked in during generation does NOT set this.
    const newestBuildAt = project.versions[0]?.createdAt ?? null;
    const coverPendingRecompile =
      project.coverType !== "NONE" &&
      !!project.coverUpdatedAt &&
      (!newestBuildAt || project.coverUpdatedAt > newestBuildAt);

    // researchData is a multi-hundred-KB blob polled every 3s during
    // generation — replace it with a light phase flag for the UI.
    const {
      versions: _versions,
      researchData,
      ...projectData
    } = project as any;
    return reply.send({
      success: true,
      data: {
        ...formatProject(projectData),
        coverPendingRecompile,
        researchDone: !!researchData,
      },
    });
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
    const stripeConfig = getStripeConfig(request);
    if (!stripeConfig) {
      return reply
        .status(500)
        .send({ success: false, error: "Stripe not configured" });
    }
    const { stripe, testMode } = stripeConfig;

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

    const customerId = await ensureStripeCustomer(
      stripe,
      request.user.userId,
      testMode,
    );

    // Charge in the project's currency; back-fill the rate for legacy PLN rows.
    const usePln = project.currency === "pln";
    const fxRate = usePln
      ? project.exchangeRate ?? (await getUsdPlnRate()).rate
      : null;

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "payment",
      payment_method_types: usePln ? ["card", "blik"] : ["card"],
      line_items: [
        priceLine(
          usePln ? "pln" : "usd",
          project.priceUsdCents,
          fxRate,
          `eBook: ${project.title || project.topic}`,
          usePln
            ? `Profesjonalny eBook (${project.targetPages} stron)`
            : `${project.targetPages}-page professional eBook`,
        ),
      ],
      metadata: { projectId: project.id, userId: request.user.userId },
      success_url: `${process.env.FRONTEND_URL}/projects/${project.id}?payment=success`,
      cancel_url: `${process.env.FRONTEND_URL}/projects/${project.id}?payment=cancelled`,
    });

    await prisma.project.update({
      where: { id },
      data: {
        stripeSessionId: session.id,
        currentStage: "PAYMENT",
        ...(usePln && project.exchangeRate == null ? { exchangeRate: fxRate } : {}),
      },
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
    const { z } = await import("zod");
    const { StructureChapterSchema } = await import("../lib/llmJson");
    const validation = z
      .array(StructureChapterSchema)
      .min(1)
      .safeParse(chapters);
    if (!validation.success) {
      return reply.status(400).send({
        success: false,
        error: `Invalid structure: ${validation.error.issues[0]?.message || "bad chapters"}`,
      });
    }
    await prisma.projectStructure.update({
      where: { id: project.structure.id },
      data: {
        structureJson: JSON.stringify({ chapters: validation.data }),
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

    // The old flow parked the project in an unused IMAGES stage and waited
    // for another click — approval now starts content generation directly.
    const { enqueueGeneration } = await import("../lib/jobQueue");
    const result = await enqueueGeneration("content", id);
    await prisma.project.update({
      where: { id },
      data: {
        currentStage: "GENERATING",
        generationStatus: "GENERATING_CONTENT",
      },
    });

    return reply.send({
      success: true,
      message: result.enqueued
        ? "Structure approved — generation started"
        : "Structure approved — generation already running",
    });
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
    // Heading numbering override (null/"" = back to the brief's decision)
    if (body.numberingMode !== undefined) {
      data.numberingMode = isNumberingMode(body.numberingMode)
        ? body.numberingMode
        : null;
    }
    if (body.numberingLabel !== undefined) {
      const label = String(body.numberingLabel || "").trim().slice(0, 40);
      data.numberingLabel = label || null;
    }
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

    const { enqueueGeneration } = await import("../lib/jobQueue");
    const result = await enqueueGeneration("structure", id);
    if (!result.enqueued) {
      return reply.status(409).send({
        success: false,
        error: "Structure generation already in progress",
      });
    }

    await prisma.project.update({
      where: { id },
      data: { structureRedoUsed: true, currentStage: "STRUCTURE" },
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

    // Allowed: first run (IMAGES), retry/resume after crash (GENERATING/ERROR).
    // A finished book is edited + recompiled instead of regenerated.
    const allowedStages = ["IMAGES", "GENERATING", "ERROR"];
    if (!allowedStages.includes(project.currentStage)) {
      return reply.status(400).send({
        success: false,
        error: `Cannot start generation from stage ${project.currentStage}`,
      });
    }

    const { enqueueGeneration } = await import("../lib/jobQueue");
    const result = await enqueueGeneration("content", id);
    if (!result.enqueued) {
      return reply.status(409).send({
        success: false,
        error: "Generation already in progress",
      });
    }

    await prisma.project.update({
      where: { id },
      data: {
        generationStatus: "GENERATING_CONTENT",
        currentStage: "GENERATING",
      },
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
  const usd = p.priceUsdCents;
  const priceUsdFormatted = usd ? `$${(usd / 100).toFixed(2)}` : null;
  // Display in the charged currency. PLN reconstructs the exact charged amount
  // from the rate stored at checkout (deterministic), using the "zł" symbol.
  let priceFormatted = priceUsdFormatted;
  if (usd && p.currency === "pln" && p.exchangeRate) {
    const zl = Math.round(usd * p.exchangeRate) / 100;
    priceFormatted = `${zl.toLocaleString("pl-PL", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} zł`;
  }
  return {
    ...p,
    priceUsdFormatted,
    priceFormatted,
    // Effective heading numbering (brief decision + owner override) so the
    // editor can show the same numbers the PDF will print.
    numbering: resolveNumbering(p),
    // Parse customColors back to array for frontend
    customColors: p.customColors ? JSON.parse(p.customColors) : null,
  };
}
