// backend/src/routes/autopilotRoutes.ts
// ─────────────────────────────────────────────────────────────────────────────
// Admin "autopilot": create a project from a spec and run the FULL pipeline
// (research → structure → content → compile) unattended, with no payment and
// no human structure-approval step.
//
// This is deliberately 1:1 with the normal flow: it does not reimplement any
// generation logic — it just creates the project (skipping Stripe), marks it
// PAID, flags it `autoPilot`, and enqueues the SAME `structure` job the payment
// webhook would. `structureGenerator` then auto-approves and chains into the
// SAME `content` job, which auto-runs the SAME `compileBook`. Identical engine,
// different entry trigger.
//
// Auth: admin JWT (email === ADMIN_EMAIL) OR a service token in the
// Authorization header (INTERNAL_API_TOKEN) — the latter lets an unattended
// caller (e.g. a Claude/Anthropic routine) trigger a run without a session.
// ─────────────────────────────────────────────────────────────────────────────
import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middleware/auth";
import {
  getPageSizeTier,
  calculatePrice,
  MIN_PAGES,
  MAX_PAGES,
} from "../lib/types";

// Resolve the admin user (owner of autopilot projects) from ADMIN_EMAIL.
async function getAdminUserId(): Promise<string | null> {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) return null;
  const user = await prisma.user.findUnique({
    where: { email: adminEmail },
    select: { id: true },
  });
  return user?.id ?? null;
}

// Allow the call when EITHER a valid service token is presented OR the request
// carries an admin JWT. Returns true if authorized; otherwise sends 401/403.
async function authorize(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<boolean> {
  // INTERNAL_API_TOKEN_PREVIOUS: grace period przy rotacji — rutyna, która
  // pobrała stary token na starcie biegu, może jeszcze dokończyć ingest/revise.
  // Po zakończeniu biegu usunąć PREVIOUS z .env.
  const serviceTokens = [
    process.env.INTERNAL_API_TOKEN,
    process.env.INTERNAL_API_TOKEN_PREVIOUS,
  ].filter(Boolean);
  const header = request.headers.authorization;
  if (header && serviceTokens.some((t) => header === `Bearer ${t}`)) {
    return true; // unattended caller (routine) with the shared service token
  }

  // Fall back to the normal admin gate: valid JWT whose email is ADMIN_EMAIL.
  await authenticate(request, reply);
  if (reply.sent) return false;
  const adminEmail = process.env.ADMIN_EMAIL;
  if (adminEmail && (request as any).user?.email !== adminEmail) {
    reply.status(403).send({ success: false, error: "Not admin" });
    return false;
  }
  return true;
}

export async function autopilotRoutes(app: FastifyInstance) {
  // ━━━ POST /api/admin/books/generate ━━━
  // Body: { topic (required, ≥5 chars), title?, targetPages?, language?,
  //         guidelines?, stylePreset?, bookFormat?, customColors?[],
  //         authorName?, subtitle?, coverOption?, useAiImages?,
  //         imageGuidelines?, imageDensity?, footnoteMode? }
  app.post("/api/admin/books/generate", async (request, reply) => {
    if (!(await authorize(request, reply))) return;

    const adminUserId = await getAdminUserId();
    if (!adminUserId) {
      return reply.status(500).send({
        success: false,
        error: "ADMIN_EMAIL user not found — cannot own autopilot project",
      });
    }

    const b = (request.body ?? {}) as any;
    const topic = typeof b.topic === "string" ? b.topic.trim() : "";
    if (topic.length < 5) {
      return reply
        .status(400)
        .send({ success: false, error: "Topic must be at least 5 characters" });
    }

    // Snap pages to the nearest valid tier (same rule as the paid flow).
    const rawPages = Math.max(
      MIN_PAGES,
      Math.min(MAX_PAGES, parseInt(b.targetPages) || 60),
    );
    const tier = getPageSizeTier(rawPages);
    const pages = tier.targetPages;
    const pricing = calculatePrice(pages);

    // Validate & serialize custom colors (max 3 hex) — same as paid flow.
    let serializedColors: string | null = null;
    if (Array.isArray(b.customColors) && b.customColors.length > 0) {
      const valid = b.customColors
        .slice(0, 3)
        .filter((c: any) => typeof c === "string" && /^#[0-9A-Fa-f]{6}$/.test(c));
      if (valid.length > 0) serializedColors = JSON.stringify(valid);
    }

    const project = await prisma.project.create({
      data: {
        userId: adminUserId,
        topic,
        title: b.title || null,
        targetPages: pages,
        language: b.language || "en",
        guidelines: b.guidelines || null,
        stylePreset: b.stylePreset || "modern",
        bookFormat: b.bookFormat || "a5",
        // No charge for admin runs, but keep the computed price for reference.
        priceUsdCents: pricing.priceUsdCents,
        currency: "usd",
        authorName: b.authorName || null,
        subtitle: b.subtitle || null,
        customColors: serializedColors,
        autoCoverRequested: b.coverOption === "generate",
        useAiImages: b.useAiImages === true,
        imageGuidelines:
          typeof b.imageGuidelines === "string"
            ? b.imageGuidelines.slice(0, 1000) || null
            : null,
        imageDensity: ["standard", "rich"].includes(b.imageDensity)
          ? b.imageDensity
          : "standard",
        footnoteMode: ["auto", "always", "never"].includes(b.footnoteMode)
          ? b.footnoteMode
          : "auto",
        // Skip payment + skip the human structure-approval gate.
        paymentStatus: "PAID",
        paidAt: new Date(),
        currentStage: "STRUCTURE",
        autoPilot: true,
      },
    });

    // Enqueue the SAME structure job the payment webhook would. autoPilot makes
    // structureGenerator auto-approve and chain into content → compile.
    const { enqueueGeneration } = await import("../lib/jobQueue");
    await enqueueGeneration("structure", project.id);

    return reply.status(201).send({
      success: true,
      data: {
        projectId: project.id,
        topic: project.topic,
        targetPages: pages,
        statusUrl: `/api/projects/${project.id}/generation/status`,
        message: "Autopilot run started — structure → content → compile",
      },
    });
  });

  // ━━━ POST /api/admin/routine/run-book ━━━
  // The admin "⚡ Autopilot (Routines)" button calls THIS — which fires the
  // Anthropic Claude Code ROUTINE (its own endpoint + token), so generation runs
  // on the SUBSCRIPTION, not the API. The routine then authors the book and
  // POSTs it back to /ingest. Configure in backend .env:
  //   ROUTINE_RUN_URL    = the routine's run endpoint (from claude.ai/code/routines/<id>)
  //   ROUTINE_API_TOKEN  = the routine's API token (sk-ant-oat...)
  app.post("/api/admin/routine/run-book", async (request, reply) => {
    if (!(await authorize(request, reply))) return;
    const url = process.env.ROUTINE_RUN_URL;
    const token = process.env.ROUTINE_API_TOKEN;
    if (!url || !token) {
      return reply.status(503).send({
        success: false,
        error:
          "Routine not wired yet — set ROUTINE_RUN_URL and ROUTINE_API_TOKEN in backend .env",
      });
    }
    const b = (request.body ?? {}) as any;
    const topic = typeof b.topic === "string" ? b.topic.trim() : "";
    if (topic.length < 5) {
      return reply
        .status(400)
        .send({ success: false, error: "Topic must be at least 5 characters" });
    }
    // The routine reads its runtime input from the `text` param (JSON string).
    // Forward the FULL form — the routine (an agent) uses whatever is present;
    // dropping fields here silently loses what the admin typed (title,
    // guidelines, colors...), so pass everything the paid flow would.
    const text = JSON.stringify({
      topic,
      title: typeof b.title === "string" && b.title.trim() ? b.title.trim() : undefined,
      subtitle:
        typeof b.subtitle === "string" && b.subtitle.trim() ? b.subtitle.trim() : undefined,
      authorName:
        typeof b.authorName === "string" && b.authorName.trim()
          ? b.authorName.trim()
          : undefined,
      guidelines:
        typeof b.guidelines === "string" && b.guidelines.trim()
          ? b.guidelines.slice(0, 5000)
          : undefined,
      targetPages: parseInt(b.targetPages) || 60,
      language: b.language || "pl",
      stylePreset: b.stylePreset || "modern",
      bookFormat: b.bookFormat || "a5",
      withImages: b.withImages !== false,
      customColors:
        Array.isArray(b.customColors) && b.customColors.length > 0
          ? b.customColors
              .slice(0, 3)
              .filter(
                (c: any) => typeof c === "string" && /^#[0-9A-Fa-f]{6}$/.test(c),
              )
          : undefined,
      coverOption: typeof b.coverOption === "string" ? b.coverOption : undefined,
      imageDensity: ["standard", "rich"].includes(b.imageDensity)
        ? b.imageDensity
        : undefined,
      imageGuidelines:
        typeof b.imageGuidelines === "string" && b.imageGuidelines.trim()
          ? b.imageGuidelines.slice(0, 1000)
          : undefined,
      footnoteMode: ["auto", "always", "never"].includes(b.footnoteMode)
        ? b.footnoteMode
        : undefined,
    });
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({ text }),
      });
      const data: any = await r.json().catch(() => ({}));
      if (!r.ok) {
        return reply
          .status(502)
          .send({ success: false, error: `Routine API ${r.status}`, detail: data });
      }
      return reply.send({ success: true, data });
    } catch (e: any) {
      return reply
        .status(502)
        .send({ success: false, error: `Routine call failed: ${e.message}` });
    }
  });

  // ━━━ POST /api/admin/books/ingest ━━━
  // A Claude Code ROUTINE agent authored the whole book on the subscription and
  // POSTs the finished LaTeX here. The backend does NO LLM authoring — it stores
  // the chapters, generates FLUX images (if requested), compiles and stores the
  // book. The agent did its own visual QA, so the backend skips the API review
  // (contentSource = "routine").
  app.post("/api/admin/books/ingest", async (request, reply) => {
    if (!(await authorize(request, reply))) return;
    const adminUserId = await getAdminUserId();
    if (!adminUserId) {
      return reply.status(500).send({
        success: false,
        error: "ADMIN_EMAIL user not found",
      });
    }

    const b = (request.body ?? {}) as any;
    const topic = typeof b.topic === "string" ? b.topic.trim() : "";
    if (topic.length < 5) {
      return reply
        .status(400)
        .send({ success: false, error: "Topic must be at least 5 characters" });
    }
    const chapters = Array.isArray(b.chapters) ? b.chapters : [];
    if (
      !chapters.length ||
      !chapters.every(
        (c: any) => typeof c?.latex === "string" && c.latex.trim().length > 20,
      )
    ) {
      return reply.status(400).send({
        success: false,
        error: "chapters[] required — each with a non-empty `latex` string",
      });
    }

    const rawPages = Math.max(
      MIN_PAGES,
      Math.min(MAX_PAGES, parseInt(b.targetPages) || 60),
    );
    const tier = getPageSizeTier(rawPages);
    const pages = tier.targetPages;
    const pricing = calculatePrice(pages);

    let serializedColors: string | null = null;
    if (Array.isArray(b.customColors) && b.customColors.length > 0) {
      const valid = b.customColors
        .slice(0, 3)
        .filter((c: any) => typeof c === "string" && /^#[0-9A-Fa-f]{6}$/.test(c));
      if (valid.length > 0) serializedColors = JSON.stringify(valid);
    }

    const hasCover =
      typeof b.coverLatex === "string" && b.coverLatex.length > 50;
    const withImages = b.withImages === true;

    const project = await prisma.project.create({
      data: {
        userId: adminUserId,
        topic,
        title: b.title || null,
        targetPages: pages,
        language: b.language || "en",
        guidelines: b.guidelines || null,
        stylePreset: b.stylePreset || "modern",
        bookFormat: b.bookFormat || "a5",
        priceUsdCents: pricing.priceUsdCents,
        currency: "usd",
        authorName: b.authorName || null,
        subtitle: b.subtitle || null,
        customColors: serializedColors,
        coverType: hasCover ? "GENERATED" : "NONE",
        coverLatex: hasCover ? b.coverLatex : null,
        autoCoverRequested: hasCover,
        useAiImages: withImages,
        imageGuidelines:
          typeof b.imageGuidelines === "string"
            ? b.imageGuidelines.slice(0, 1000) || null
            : null,
        imageDensity: ["standard", "rich"].includes(b.imageDensity)
          ? b.imageDensity
          : "standard",
        footnoteMode: ["auto", "always", "never"].includes(b.footnoteMode)
          ? b.footnoteMode
          : "auto",
        paymentStatus: "PAID",
        paidAt: new Date(),
        currentStage: "GENERATING",
        generationStatus: "GENERATING_CONTENT",
        autoPilot: true,
        contentSource: "routine",
      },
    });

    const WPP = 260;
    for (let i = 0; i < chapters.length; i++) {
      const c = chapters[i];
      const tp =
        parseInt(c.targetPages) ||
        Math.max(1, Math.round(pages / chapters.length));
      await prisma.chapter.create({
        data: {
          projectId: project.id,
          chapterNumber: Number(c.number) || i + 1,
          title: typeof c.title === "string" ? c.title : `Rozdział ${i + 1}`,
          latexContent: c.latex,
          targetPages: tp,
          targetWords: tp * WPP,
          status: "LATEX_READY",
        },
      });
    }

    // Deterministic cover (no LLM, no FLUX) when the agent didn't supply one.
    if (!hasCover && b.coverOption !== "none") {
      try {
        const {
          generateCoverLatex,
          getDefaultCoverParams,
          derivePillarsFromChapters,
        } = await import("../services/coverGenerator");
        const params = getDefaultCoverParams(project);
        params.pillars = derivePillarsFromChapters(
          chapters.map((c: any, i: number) => ({
            title: typeof c.title === "string" ? c.title : `Rozdział ${i + 1}`,
            description:
              typeof c.description === "string" ? c.description : undefined,
          })),
        );
        const coverLatex = generateCoverLatex(
          params,
          project.bookFormat,
          project.language,
          project.stylePreset,
          project.customColors ? JSON.parse(project.customColors) : undefined,
        );
        await prisma.project.update({
          where: { id: project.id },
          data: { coverType: "GENERATED", coverLatex, autoCoverRequested: true },
        });
      } catch (e: any) {
        console.warn(`[INGEST] cover generation failed (non-fatal): ${e.message}`);
      }
    }

    const { enqueueGeneration } = await import("../lib/jobQueue");
    await enqueueGeneration("finalize", project.id, { withImages });

    return reply.status(201).send({
      success: true,
      data: {
        projectId: project.id,
        chapters: chapters.length,
        withImages,
        reviseUrl: `/api/admin/books/${project.id}/revise`,
        statusUrl: `/api/projects/${project.id}/generation/status`,
        message:
          "Ingested — generating images (if requested) and compiling. Poll status until COMPLETED.",
      },
    });
  });

  // ━━━ POST /api/admin/blog/hero ━━━
  // Autoblog routine: generate a blog hero image via FLUX (DESIGN-BOOK §4-6 —
  // the ROUTINE builds the prompt per the book's rules; backend only executes).
  // Returns base64 jpg (3:2, polished) the routine writes into the repo as
  // site/src/assets/blog/{slug}-hero.jpg before committing the post.
  app.post("/api/admin/blog/hero", async (request, reply) => {
    if (!(await authorize(request, reply))) return;
    const b = (request.body ?? {}) as any;
    const prompt = typeof b.prompt === "string" ? b.prompt.trim() : "";
    if (prompt.length < 20) {
      return reply
        .status(400)
        .send({ success: false, error: "prompt must be at least 20 characters" });
    }
    const { generateFluxImage } = await import("../services/illustrationService");
    const image = await generateFluxImage(prompt, false);
    if (!image) {
      return reply
        .status(502)
        .send({ success: false, error: "FLUX generation failed" });
    }
    return reply.send({
      success: true,
      data: {
        imageBase64: image.buffer.toString("base64"),
        bytes: image.buffer.length,
        seed: image.seed,
      },
    });
  });

  // ━━━ POST /api/admin/books/:id/revise ━━━
  // Agent's visual-QA fixes: surgical find/replace patches against chapter
  // LaTeX, then recompile (no re-illustration). Body: {patches:[{chapterNumber,
  // find, replace}]}.
  app.post("/api/admin/books/:id/revise", async (request, reply) => {
    if (!(await authorize(request, reply))) return;
    const { id } = request.params as any;
    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) {
      return reply.status(404).send({ success: false, error: "Not found" });
    }
    const patches = Array.isArray((request.body as any)?.patches)
      ? (request.body as any).patches
      : [];
    if (!patches.length) {
      return reply
        .status(400)
        .send({ success: false, error: "patches[] required" });
    }

    const chapters = await prisma.chapter.findMany({
      where: { projectId: id },
      orderBy: { chapterNumber: "asc" },
    });
    const updated = new Map<number, string>();
    let applied = 0;
    const skipped: any[] = [];
    for (const p of patches) {
      const ch = chapters.find((c) => c.chapterNumber === Number(p.chapterNumber));
      if (!ch || !ch.latexContent || typeof p.find !== "string" || !p.find) {
        skipped.push({ chapterNumber: p.chapterNumber, reason: "bad patch" });
        continue;
      }
      const current = updated.get(ch.chapterNumber) ?? ch.latexContent;
      const idx = current.indexOf(p.find);
      if (idx === -1) {
        skipped.push({ chapterNumber: p.chapterNumber, reason: "find not located" });
        continue;
      }
      updated.set(
        ch.chapterNumber,
        current.slice(0, idx) + (p.replace ?? "") + current.slice(idx + p.find.length),
      );
      applied++;
    }
    for (const [n, latex] of updated) {
      const ch = chapters.find((c) => c.chapterNumber === n)!;
      await prisma.chapter.update({ where: { id: ch.id }, data: { latexContent: latex } });
    }
    if (applied > 0) {
      await prisma.project.update({
        where: { id },
        data: { currentStage: "GENERATING", generationStatus: "COMPILING_LATEX" },
      });
      const { enqueueGeneration } = await import("../lib/jobQueue");
      await enqueueGeneration("finalize", id, { withImages: false });
    }
    return reply.send({
      success: true,
      data: { applied, skipped, recompiling: applied > 0 },
    });
  });
}
