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
import { Prisma } from "@prisma/client";
import { attachMaterials } from "./materialRoutes";
import { rebalancePages, carryStoredPages } from "../lib/pageBudget";
import { resolveAutoDesign } from "../services/designPicker";
import {
  generatePreview,
  previewInputHash,
  checkPreviewLimits,
  acquirePreviewSlot,
  releasePreviewSlot,
  normalizePreview,
} from "../services/previewGenerator";
import { BOOK_LANGUAGES, normBookLanguage } from "../lib/languages";

/** Withdrawal-right waiver checkbox (consumer law: digital content started
 *  before the 14-day period ends). Every Stripe checkout needs it. */
const CONSENT_REQUIRED = {
  success: false,
  code: "WITHDRAWAL_CONSENT_REQUIRED",
  error: "Confirm the withdrawal-right checkbox before paying",
};

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

/**
 * The web order form has ONE description field (topic + guidelines merged,
 * 2026-10-06 — customers pasted long briefs into "topic" anyway). The first
 * sentence or line becomes the topic (what research and titles key on), the
 * rest the guidelines. Older clients still send topic/guidelines separately.
 */
export function splitDescription(text: string): { topic: string; guidelines: string } {
  const t = text.trim();
  const firstLine = t.split(/\r?\n/)[0].trim();
  const sentence = (firstLine.match(/^[\s\S]{20,}?[.!?…](?=\s|$)/)?.[0] ?? firstLine).trim();
  if (sentence.length <= 300) {
    return {
      topic: sentence.replace(/\.$/, ""),
      guidelines: t.slice(sentence.length).trim(),
    };
  }
  // A first sentence this long is the brief itself: short topic, keep it all.
  return { topic: sentence.slice(0, 300).replace(/\s+\S*$/, "") + "…", guidelines: t };
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
      deferCheckout,
      draftProjectId,
      description,
      withdrawalConsent,
    } = request.body as any;

    // A book needs a subject, but the user may express it either way: as a
    // topic ("30-day bodyweight plan for beginners") or straight as a title
    // ("The 12-Week Weight Loss Blueprint"). Either one alone is enough —
    // a title-only order becomes its own topic, so research and structure
    // downstream always have something to work from.
    const fromDescription =
      typeof description === "string" && description.trim()
        ? splitDescription(description.slice(0, 15000))
        : null;
    const topicInput = fromDescription
      ? fromDescription.topic
      : typeof topic === "string"
        ? topic.trim()
        : "";
    const guidelinesInput = fromDescription
      ? fromDescription.guidelines || null
      : guidelines || null;
    const titleInput = typeof title === "string" ? title.trim() : "";
    const effectiveTopic = topicInput || titleInput;
    if (effectiveTopic.length < 5) {
      return reply.status(400).send({
        success: false,
        error: "Provide a topic or a title (at least 5 characters)",
      });
    }
    const bookLanguage = language ? normBookLanguage(language) : "en";
    if (!bookLanguage) {
      return reply.status(400).send({
        success: false,
        error: `Unsupported language — use one of: ${BOOK_LANGUAGES.join(", ")}`,
      });
    }

    // Mobile app pays through Google Play (POST /api/play/verify) — no Stripe
    // session is created; the app gets the SKU to buy instead.
    const viaPlay = paymentProvider === "play";
    // Web order form: create the order first, show the free preview, and
    // only then open Stripe via POST /:id/checkout.
    const deferred = !viaPlay && deferCheckout === true;
    if (!viaPlay && !deferred && withdrawalConsent !== true)
      return reply.status(400).send(CONSENT_REQUIRED);
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

    // Editing the order after seeing its preview updates the same unpaid
    // order instead of leaving an orphan behind.
    const draft =
      typeof draftProjectId === "string" && draftProjectId
        ? await prisma.project.findFirst({
            where: {
              id: draftProjectId,
              userId: request.user.userId,
              paymentStatus: { not: "PAID" },
            },
          })
        : null;

    // ── Create (or update the draft) project ──
    const orderData = {
        topic: effectiveTopic,
        title: titleInput || null,
        targetPages: pages,
        language: bookLanguage,
        guidelines: guidelinesInput,
        // "auto" (or nothing chosen): the model picks the look for the topic.
        stylePreset:
          stylePreset && stylePreset !== "auto" ? stylePreset : "modern",
        autoStyle: !stylePreset || stylePreset === "auto",
        autoColors: !serializedColors,
        designResolvedAt: null,
        bookFormat: bookFormat || "a5",
        priceUsdCents: pricing.priceUsdCents,
        currency: usePln ? "pln" : "usd",
        exchangeRate: fxRate,
        currentStage: "PAYMENT" as const,
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
    };
    // Re-sending an unchanged description with the look still on auto keeps
    // the look already picked for it (no reset, no second pick).
    if (
      draft &&
      draft.designResolvedAt &&
      orderData.autoStyle === draft.autoStyle &&
      orderData.autoColors === draft.autoColors &&
      orderData.topic === draft.topic &&
      (orderData.guidelines ?? null) === (draft.guidelines ?? null)
    ) {
      const keep = orderData as Record<string, unknown>;
      if (draft.autoStyle) delete keep.stylePreset;
      if (draft.autoColors) delete keep.customColors;
      delete keep.designResolvedAt;
    }
    const project = draft
      ? await prisma.project.update({ where: { id: draft.id }, data: orderData })
      : await prisma.project.create({
          data: { userId: request.user.userId, ...orderData },
        });

    // Files attached in the order form (uploaded before the project existed).
    await attachMaterials(
      request.user.userId,
      project.id,
      (request.body as any).materialIds,
    );

    if (deferred) {
      return reply.status(201).send({
        success: true,
        data: {
          project: formatProject(project),
          pricing: { ...pricing, tierLabel: pricing.tier.label },
        },
      });
    }

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
      // Promo codes are validated by Stripe itself (single-use, expiry, % off);
      // the webhook records the code and the discount on the project.
      allow_promotion_codes: true,
      metadata: { projectId: project.id, userId: request.user.userId, withdrawalConsent: "1" },
      success_url: `${process.env.FRONTEND_URL}/projects/${project.id}?payment=success`,
      cancel_url: `${process.env.FRONTEND_URL}/projects/${project.id}?payment=cancelled`,
    });

    await prisma.project.update({
      where: { id: project.id },
      data: {
        stripeSessionId: session.id,
        withdrawalConsentAt: new Date(),
        withdrawalConsentIp: request.ip || null,
      },
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
            altStructureJson: true,
            activeVersion: true,
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
    if (body.language) {
      const l = normBookLanguage(body.language);
      if (!l)
        return reply.status(400).send({
          success: false,
          error: `Unsupported language — use one of: ${BOOK_LANGUAGES.join(", ")}`,
        });
      data.language = l;
    }
    if (body.guidelines !== undefined) data.guidelines = body.guidelines;
    if (body.authorName !== undefined)
      data.authorName = body.authorName || null;
    if (body.subtitle !== undefined) data.subtitle = body.subtitle || null;
    if (body.stylePreset && body.stylePreset !== "auto") {
      data.stylePreset = body.stylePreset;
      data.autoStyle = false; // an explicit choice ends the auto look
    }
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

  // ━━━ POST /api/projects/:id/preview ━━━
  // Free title + table of contents before payment. Same inputs return the
  // stored preview (no LLM call); `regenerate: true` asks for a new version.
  app.post("/api/projects/:id/preview", async (request, reply) => {
    const { id } = request.params as any;
    const regenerate = (request.body as any)?.regenerate === true;
    const feedback =
      typeof (request.body as any)?.feedback === "string"
        ? (request.body as any).feedback.slice(0, 2000)
        : "";
    const userId = request.user.userId;
    const project = await prisma.project.findFirst({ where: { id, userId } });
    if (!project)
      return reply.status(404).send({ success: false, error: "Not found" });
    if (project.paymentStatus === "PAID")
      return reply.status(400).send({ success: false, error: "Already paid" });

    const input = {
      topic: project.topic,
      title: project.title,
      guidelines: project.guidelines,
      language: project.language,
      targetPages: project.targetPages,
      stylePreset: project.stylePreset,
    };
    const hash = previewInputHash(input);
    const remaining = project.previewRedoUsed ? 0 : 1;

    if (project.preview && project.previewHash === hash && !regenerate) {
      // An edited order (draftProjectId) resets the auto look even when the
      // description is unchanged — pick it again without the customer waiting.
      void resolveAutoDesign(project.id);
      return reply.send({
        success: true,
        data: {
          preview: normalizePreview(project.preview),
          cached: true,
          remaining,
        },
      });
    }

    const admin = isAdmin(request.user.email);
    if (regenerate && project.previewRedoUsed && !admin) {
      return reply.status(429).send({
        success: false,
        code: "PREVIEW_PROJECT_LIMIT",
        error: "The AI redo for this order was already used",
        data: { preview: normalizePreview(project.preview) },
      });
    }
    const limit = await checkPreviewLimits({
      userId,
      ip: request.ip || null,
      isAdmin: admin,
    });
    if (limit) {
      return reply.status(429).send({
        success: false,
        code: limit,
        error: "Preview limit reached",
        // The customer can always still order without a (new) preview.
        data: { preview: normalizePreview(project.preview) },
      });
    }
    if (!acquirePreviewSlot(userId)) {
      return reply
        .status(409)
        .send({ success: false, code: "PREVIEW_IN_PROGRESS", error: "Busy" });
    }

    try {
      const previous = regenerate ? normalizePreview(project.preview) : null;
      // The auto look is picked alongside — no extra wait for the customer.
      const [result] = await Promise.all([
        generatePreview(
          input,
          undefined,
          previous && !previous.rejected ? { feedback, previous } : undefined,
        ),
        resolveAutoDesign(project.id),
      ]);
      await prisma.previewLog.create({
        data: {
          userId,
          projectId: project.id,
          ip: request.ip || null,
          model: result.model,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          costUsd: result.costUsd,
          ok: !result.preview.rejected,
        },
      });
      const updated = await prisma.project.update({
        where: { id: project.id },
        data: {
          preview: result.preview as any,
          previewHash: hash,
          // The redo keeps the first version to choose from; a fresh preview
          // (new description) starts over.
          previewAlt:
            regenerate && project.preview
              ? (project.preview as any)
              : Prisma.DbNull,
          previewActiveVersion: regenerate ? 2 : 1,
          previewCount: { increment: 1 },
          ...(regenerate ? { previewRedoUsed: true } : {}),
        },
      });
      request.log.info(
        `preview ${project.id} ${result.model} in=${result.inputTokens} out=${result.outputTokens} $${result.costUsd.toFixed(4)}`,
      );
      return reply.send({
        success: true,
        data: {
          preview: result.preview,
          cached: false,
          remaining: updated.previewRedoUsed ? 0 : 1,
          hasAlt: !!updated.previewAlt,
          activeVersion: updated.previewActiveVersion,
        },
      });
    } catch (err: any) {
      request.log.error(`preview ${project.id} failed: ${err?.message}`);
      await prisma.previewLog
        .create({
          data: {
            userId,
            projectId: project.id,
            ip: request.ip || null,
            model: "error",
            ok: false,
          },
        })
        .catch(() => {});
      return reply.status(502).send({
        success: false,
        code: "PREVIEW_FAILED",
        error: "Preview generation failed",
      });
    } finally {
      releasePreviewSlot(userId);
    }
  });

  // ━━━ PUT /api/projects/:id/preview ━━━
  // The customer's own edits in the StructureEditor (titles, descriptions,
  // pages, added/removed chapters and sections). No LLM call, no limit.
  app.put("/api/projects/:id/preview", async (request, reply) => {
    const { id } = request.params as any;
    const project = await prisma.project.findFirst({
      where: { id, userId: request.user.userId },
    });
    if (!project)
      return reply.status(404).send({ success: false, error: "Not found" });
    if (project.paymentStatus === "PAID")
      return reply.status(400).send({ success: false, error: "Already paid" });
    const current = normalizePreview(project.preview);
    if (!current || current.rejected)
      return reply.status(400).send({ success: false, error: "No preview" });

    const body = request.body as any;
    // Page budgets: weights from the stored version, ordered total — never
    // what the request says.
    const chapters = Array.isArray(body?.chapters)
      ? rebalancePages(
          carryStoredPages(body.chapters, current.chapters),
          project.targetPages,
        )
      : [];
    const edited = normalizePreview({
      suggestedTitle: body?.suggestedTitle ?? current.suggestedTitle,
      subtitle: current.subtitle,
      promise: current.promise,
      chapters,
    });
    if (!edited || edited.chapters.length === 0)
      return reply
        .status(400)
        .send({ success: false, error: "The book needs at least one chapter" });

    const saved = { ...edited, editedByCustomer: true };
    // A retitled book is retitled everywhere (cover, structure prompt); the
    // input hash follows so the edited preview still counts as current.
    const titleChanged =
      edited.suggestedTitle && edited.suggestedTitle !== current.suggestedTitle;
    const title = titleChanged ? edited.suggestedTitle : project.title;
    await prisma.project.update({
      where: { id },
      data: {
        preview: saved as any,
        ...(titleChanged
          ? {
              title,
              previewHash: previewInputHash({
                topic: project.topic,
                title,
                guidelines: project.guidelines,
                language: project.language,
                targetPages: project.targetPages,
                stylePreset: project.stylePreset,
              }),
            }
          : {}),
      },
    });
    return reply.send({ success: true, data: { preview: saved } });
  });

  // ━━━ POST /api/projects/:id/preview/switch ━━━
  // Two versions after the AI redo: make the other one the chosen one.
  app.post("/api/projects/:id/preview/switch", async (request, reply) => {
    const { id } = request.params as any;
    const project = await prisma.project.findFirst({
      where: { id, userId: request.user.userId },
    });
    if (!project)
      return reply.status(404).send({ success: false, error: "Not found" });
    if (project.paymentStatus === "PAID" || !project.previewAlt || !project.preview)
      return reply.status(400).send({ success: false, error: "Nothing to switch" });
    const updated = await prisma.project.update({
      where: { id },
      data: {
        preview: project.previewAlt as any,
        previewAlt: project.preview as any,
        previewActiveVersion: project.previewActiveVersion === 2 ? 1 : 2,
      },
    });
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
    if ((request.body as any)?.withdrawalConsent !== true)
      return reply.status(400).send(CONSENT_REQUIRED);

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
      // Promo codes are validated by Stripe itself (single-use, expiry, % off);
      // the webhook records the code and the discount on the project.
      allow_promotion_codes: true,
      metadata: { projectId: project.id, userId: request.user.userId, withdrawalConsent: "1" },
      success_url: `${process.env.FRONTEND_URL}/projects/${project.id}?payment=success`,
      cancel_url: `${process.env.FRONTEND_URL}/projects/${project.id}?payment=cancelled`,
    });

    await prisma.project.update({
      where: { id },
      data: {
        stripeSessionId: session.id,
        currentStage: "PAYMENT",
        ...(usePln && project.exchangeRate == null ? { exchangeRate: fxRate } : {}),
        withdrawalConsentAt: new Date(),
        withdrawalConsentIp: request.ip || null,
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

    const { chapters, suggestedTitle } = request.body as any;
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
    let prevTitle: string | undefined;
    let prevChapters: any[] = [];
    try {
      const prev = JSON.parse(project.structure.structureJson);
      prevTitle = prev.suggestedTitle;
      prevChapters = Array.isArray(prev.chapters) ? prev.chapters : [];
    } catch {
      prevTitle = undefined;
    }
    const title =
      typeof suggestedTitle === "string" && suggestedTitle.trim()
        ? suggestedTitle.trim().slice(0, 300)
        : prevTitle;
    await prisma.projectStructure.update({
      where: { id: project.structure.id },
      data: {
        structureJson: JSON.stringify({
          ...(title ? { suggestedTitle: title } : {}),
          // Pages are ours to allocate: redistribute the ordered page count.
          chapters: rebalancePages(
            carryStoredPages(validation.data as any[], prevChapters),
            project.targetPages,
          ),
        }),
        isUserEdited: true,
        version: { increment: 1 },
      },
    });
    if (title && title !== prevTitle) {
      await prisma.project.update({ where: { id }, data: { title } });
    }
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
      include: { structure: true },
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

    // Keep the current version so the customer can go back to it, and pass
    // their notes to the generator.
    if (project.structure) {
      await prisma.projectStructure.update({
        where: { id: project.structure.id },
        data: {
          altStructureJson: project.structure.structureJson,
          activeVersion: 2,
        },
      });
    }
    await prisma.project.update({
      where: { id },
      data: {
        structureRedoUsed: true,
        currentStage: "STRUCTURE",
        structureRedoFeedback:
          typeof feedback === "string" && feedback.trim()
            ? feedback.trim().slice(0, 2000)
            : null,
      },
    });

    return reply.send({ success: true, message: "Regeneration started" });
  });

  // ━━━ POST /api/projects/:id/structure/switch ━━━
  // After the one AI redo: make the other version the one that gets written.
  app.post("/api/projects/:id/structure/switch", async (request, reply) => {
    const { id } = request.params as any;
    const project = await prisma.project.findFirst({
      where: { id, userId: request.user.userId },
      include: { structure: true },
    });
    const st = project?.structure;
    if (!project || !st)
      return reply.status(404).send({ success: false, error: "Not found" });
    if (
      !st.altStructureJson ||
      st.approvedAt ||
      project.currentStage !== "STRUCTURE_REVIEW"
    )
      return reply.status(400).send({ success: false, error: "Nothing to switch" });
    await prisma.projectStructure.update({
      where: { id: st.id },
      data: {
        structureJson: st.altStructureJson,
        altStructureJson: st.structureJson,
        activeVersion: st.activeVersion === 2 ? 1 : 2,
        version: { increment: 1 },
      },
    });
    return reply.send({ success: true });
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
    previewRemaining: p.previewRedoUsed ? 0 : 1,
    // Always in the editor's shape (older previews had bare-string sections).
    preview: p.preview
      ? {
          ...normalizePreview(p.preview),
          editedByCustomer: !!(p.preview as any)?.editedByCustomer,
        }
      : null,
    previewAlt: p.previewAlt ? normalizePreview(p.previewAlt) : null,
  };
}
