// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// InkMagnet — AI Cover Designer
//
// Claude designs each cover FROM SCRATCH — no parametric templates to fill,
// no example covers to copy. The model gets the book's identity, a toolbox
// (XeLaTeX + TikZ + optional FLUX background) and general art-direction
// principles, then designs and codes the cover itself. The result is
// compiled, rendered and put through a VISION REVIEW (full size + thumbnail);
// the model revises its own work until the review passes.
//
// Every failure path falls back to the classic parametric coverGenerator,
// so a paid generation can never end up coverless because of this module.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import * as fs from "fs";
import * as path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { prisma } from "../lib/prisma";
import { createLLMClient } from "../lib/llm";
import { parseLLMJson } from "../lib/llmJson";
import { z } from "zod";

const execAsync = promisify(exec);
const anthropic = createLLMClient();
const DESIGN_MODEL = "claude-sonnet-4-6";

const REPLICATE_TOKEN =
  process.env.FLUX_API || process.env.REPLICATE_API_TOKEN || "";
const FLUX_MODEL = "black-forest-labs/flux-1.1-pro-ultra";

const PAPER_MM: Record<string, { w: number; h: number }> = {
  a4: { w: 210, h: 297 },
  a5: { w: 148, h: 210 },
  b5: { w: 176, h: 250 },
  letter: { w: 216, h: 279 },
};

const MAX_COMPILE_FIXES = 3;
const MAX_REVIEW_ROUNDS = 3;
/** below this score after all revision rounds → fall back to the classic generator */
const MIN_ACCEPT_SCORE = 5;

// ── Concept schema (phase 1) ──
const ConceptSchema = z
  .object({
    frameId: z.string().optional().default(""),
    rationale: z.string().min(40),
    direction: z.string().min(10),
    background: z
      .object({
        use: z.boolean(),
        prompt: z.string().optional().default(""),
        textZone: z.string().optional().default(""),
      })
      .default({ use: false, prompt: "", textZone: "" }),
  })
  .passthrough();

const ReviewSchema = z
  .object({
    verdict: z.enum(["approve", "revise"]),
    score: z.number().min(1).max(10),
    issues: z.array(z.string()).default([]),
    fixes: z.string().default(""),
  })
  .passthrough();

interface BookIdentity {
  title: string;
  subtitle: string | null;
  topic: string;
  language: string;
  stylePreset: string;
  customColors: string[];
  format: string;
  targetPages: number;
  chapterTitles: string[];
  authorName: string | null;
}

// ── Layout frames: fixed text-placement skeletons. The designer picks ONE and
// fills it; all visual creativity (palette, imagery, type, decoration, mood)
// happens WITHIN the frame, so every cover stays professionally composed and
// the title/author always land in a predictable, deliberate place. ──
export interface LayoutFrame {
  id: string;
  name: string;
  menu: string; // one-liner shown to the model when it picks a frame
  placement: string; // exact, non-negotiable zone spec handed to the coder
}

export const LAYOUT_FRAMES: LayoutFrame[] = [
  {
    id: "editorial-top",
    name: "Editorial / top-anchored",
    menu: "title anchored in the upper third, large negative space or one graphic below, author at the very bottom",
    placement: [
      "TITLE: the title block's vertical center sits at 22-32% of page height; left-aligned to the left safe margin in a single column no wider than 80% of the page. The title is the dominant element.",
      "SUBTITLE (if any): immediately below the title, same left edge, within 34-44% height.",
      "AUTHOR + year (if any): bottom band at 88-95% height, left edge or bottom-right corner.",
      "The field at 46-86% height holds ONE graphic idea or calm negative space — keep it free of running text.",
    ].join("\n  "),
  },
  {
    id: "center-stage",
    name: "Centered / symmetric",
    menu: "title in the optical center, symmetric composition, decoration radiating around it, author centered at the bottom",
    placement: [
      "TITLE: centered horizontally; the title block's vertical center sits at 40-52% of page height; centered alignment.",
      "SUBTITLE (if any): centered, directly below the title, within 54-62% height.",
      "AUTHOR + year (if any): centered, bottom band at 89-95% height.",
      "Decoration may occupy the top (8-30%) and bottom (66-86%) zones, symmetric about the vertical axis, kept clear of the title.",
    ].join("\n  "),
  },
  {
    id: "bottom-panel",
    name: "Bottom panel over art",
    menu: "top ~60% is the visual field (background image or abstract art), title sits in a solid panel across the bottom third",
    placement: [
      "VISUAL FIELD: the top 0-62% of the page is the dominant image / abstract-art zone — NO running text here (a short kicker is allowed). If no background image is provided, FILL this field with vector art (shapes, pattern, illustration or gradient) — NEVER leave it blank or white.",
      "PANEL: a solid or gradient panel spans the full width across 62-100% height, sitting under the visual field.",
      "TITLE: inside the panel, vertical center at 70-80% height; left-aligned to the left safe margin or centered within the panel.",
      "AUTHOR + year (if any): inside the panel, below the title, at 88-95% height.",
    ].join("\n  "),
  },
  {
    id: "top-band-block",
    name: "Top color block",
    menu: "a solid color block across the top holds the title; the lower page is imagery or texture; author at the bottom",
    placement: [
      "BLOCK: a solid (or subtly shaded) color block spans the full width across 0-36% height.",
      "TITLE: inside the block, vertical center at 14-26% height; left-aligned to the left safe margin.",
      "SUBTITLE (if any): inside the block under the title, within 28-34% height.",
      "LOWER FIELD: 36-100% height is imagery / texture / abstraction; keep it free of running text except the author line.",
      "AUTHOR + year (if any): bottom band at 90-96% height.",
    ].join("\n  "),
  },
];

function framesMenu(): string {
  return LAYOUT_FRAMES.map((f) => `  - "${f.id}": ${f.menu}`).join("\n");
}

function frameBriefText(
  name: string,
  placement: string,
  paper: { w: number; h: number },
): string {
  return `LAYOUT FRAME — "${name}" (NON-NEGOTIABLE placement skeleton)
Page is ${paper.w}mm × ${paper.h}mm; "% height" is measured from the TOP edge.
  ${placement}
Universal rules:
  - 10mm safe margin on all sides; the spine edge (left 6mm) and outer edge (right 6mm) stay completely clear of text.
  - The title appears VERBATIM and is the most prominent element — it must read first even at thumbnail size.
  - Honor these zones exactly. Your creativity goes into palette, imagery, type treatment, decoration and mood — NOT into moving the title or author elsewhere.`;
}

// ── The toolbox + principles brief ──
function designerSystem(book: BookIdentity, paper: { w: number; h: number }) {
  return `You are a senior book cover designer. You design covers as a DESIGNER
would — concept first, then execution. You work WITHIN a fixed LAYOUT FRAME that
sets where the title, subtitle and author sit; inside that frame every cover is
still unrepeatable — its palette, imagery, type treatment, decoration and mood
are derived from THIS book's subject, audience and mood.

YOUR CANVAS
- Full-bleed page exactly ${paper.w}mm × ${paper.h}mm (portrait book cover).
- Engine: XeLaTeX. You write a COMPLETE standalone .tex file.
- Required skeleton: \\documentclass + geometry with paperwidth=${paper.w}mm,
  paperheight=${paper.h}mm, margin=0pt + fontspec + tikz, body = ONE
  tikzpicture with [remember picture, overlay] anchored to current page.

YOUR TOOLBOX (use what serves the concept — not everything at once)
- TikZ vector graphics: filled shapes, bezier paths, polygons, circles, arcs,
  clipping masks, rotation, scaling, opacity (\\fill[<color>, opacity=...]),
  line work, dotted/dashed patterns, decorations. For gradients/scrims, stack
  several semi-transparent solid \\fill layers with stepped opacity (a \\foreach
  works well) — do NOT use \\shade (see NON-NEGOTIABLES).
- Typography via fontspec — available families (mix at most TWO):
  "TeX Gyre Heros" (grotesque sans), "TeX Gyre Adventor" (geometric sans),
  "TeX Gyre Termes" (Times-like serif), "TeX Gyre Bonum" (warm serif),
  "TeX Gyre Pagella" (Palatino-like serif), "Libertinus Serif", "Libertinus Sans".
  You control size precisely with \\fontsize{X}{Y}\\selectfont, weight (\\bfseries),
  italics, letterspacing (LetterSpace fontspec option), case, color, rotation.
  Type itself can be the image: oversized words, cropped letterforms,
  stacked lines, vertical baselines.
- Optional photographic BACKGROUND generated for you (you write the image
  prompt). It arrives as bg.jpg ALREADY CROPPED to the page proportions AND with
  a smooth dark gradient baked into its lower half for text legibility. Place it
  FULL-BLEED over the whole page, exactly once:
  \\node[anchor=north west,inner sep=0pt] at (current page.north west)
    {\\includegraphics[width=${paper.w}mm,height=${paper.h}mm]{bg.jpg}};
  Then place the title/subtitle/author in the LOWER part of the page (over the
  pre-darkened area) in light/white type. This OVERRIDES any "panel" in your
  layout frame: when a photo background is present the baked gradient IS the
  panel — you must NOT draw a solid color block, band, or filled rectangle over
  the photo (the hard-edged "sticker" look is exactly what we are eliminating),
  and no scrims, stepped-opacity fills, or decorative shapes over it. The ONLY
  things you draw are the full-bleed image and the text, plus at most ONE thin
  (≤1pt) accent rule. Let the photo bleed straight into the text.

NON-NEGOTIABLES
- A LAYOUT FRAME will be given with exact zones for the title, subtitle and
  author. Place that text in those zones — never relocate it. Your creativity
  lives in the visuals, not in where the text sits.
- NEVER use \\shade or the TikZ "shadings" library (no \\usetikzlibrary{shadings},
  no top color/bottom color/inner color/outer color). They compile to PDF
  soft-masks that render as a flat GREY block in the cover's preview pipeline.
- Do NOT fake a gradient by stacking many semi-transparent fills — it produces
  visible banding. Use FLAT solid color fills only. (For a photo background the
  smooth darkening is already baked into the image — see the BACKGROUND note.)
- Do NOT apply LetterSpace (fontspec letterspacing) to any line that contains
  more than one word — it collapses the spaces between words into one run
  ("Zioła w polskim" → "Zioławpolskim"). Use LetterSpace ONLY on a single word
  or a short all-caps label; multi-word titles keep normal tracking. Always keep
  real spaces between words.
- The title text must appear VERBATIM (you may break lines anywhere). Keep its
  capitalization as given. You MAY set the title in ALL CAPS as a deliberate
  display style, but NEVER capitalize each word individually — per-word Title
  Case is an English-only convention and is wrong in other languages.
- NEVER distort the background photo. bg.jpg is pre-cropped to the page; include
  it ONLY full-bleed at width=${paper.w}mm height=${paper.h}mm. Do NOT pass
  keepaspectratio=false, and never scale it into a partial or differently-shaped
  box — that stretches the photo, which is unacceptable.
- All visible text in the book's language. No lorem ipsum, no English fillers
  on non-English covers, no invented review quotes or publisher logos.
- Nothing may overflow the page or get clipped mid-letter unintentionally.
- No raster effects you cannot actually produce in TikZ; no external images
  except the provided bg.jpg.
- The spine edge (left 6mm) and outer edge (right 6mm) stay free of critical
  text.
- BUDGET: the complete .tex file must stay under ~180 lines. If your idea
  needs hundreds of TikZ paths, simplify the idea — a complete, restrained
  file beats a truncated ornate one. Repetition belongs in \\foreach loops.

ART DIRECTION PRINCIPLES (general craft — the design itself is yours)
- One dominant idea per cover. If everything is loud, nothing is.
- Hierarchy: at thumbnail size (~120px tall) the title must still read first.
- Composition: WITHIN the frame's zones, use scale contrast, generous negative
  space and alignment to a grid; let one element dominate.
- Color: build a deliberate palette (2-4 colors). If the author provided
  brand colors, treat them as the palette's anchors. High contrast between
  type and ground is mandatory.
- Mood must match the subject: a cookbook breathes differently than a tax
  guide. Surprise is welcome; kitsch and cliché symbolism are not
  (no lightbulbs for "ideas", no handshakes, no rocket ships, no brains).
- Respect the audience's culture and language (typographic conventions,
  diacritics render correctly with fontspec).`;
}

function bookBriefText(book: BookIdentity) {
  return `BOOK IDENTITY
Title (verbatim): ${book.title}
${book.subtitle ? `Subtitle: ${book.subtitle}` : "Subtitle: none"}
${book.authorName ? `Author: ${book.authorName}` : "Author: none (no author line)"}
Topic: ${book.topic}
Language: ${book.language}
Interior style preset: ${book.stylePreset}
${
  book.customColors.length
    ? `Author's brand colors (anchor the palette on these): ${book.customColors.join(", ")}`
    : "No brand colors given — derive the palette from the subject's mood."
}
Length: ~${book.targetPages} pages
Chapters: ${book.chapterTitles.slice(0, 8).join(" · ") || "n/a"}`;
}

// ── FLUX background (portrait) ──
async function generateBackground(
  prompt: string,
  outPath: string,
  log?: any,
): Promise<boolean> {
  if (!REPLICATE_TOKEN) return false;
  try {
    const create = await fetch(
      `https://api.replicate.com/v1/models/${FLUX_MODEL}/predictions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${REPLICATE_TOKEN}`,
          "Content-Type": "application/json",
          Prefer: "wait=60",
        },
        body: JSON.stringify({
          input: {
            prompt:
              prompt +
              ", no text, no words, no letters, no labels, no watermark",
            aspect_ratio: "2:3",
            raw: false,
            output_format: "jpg",
            safety_tolerance: 2,
          },
        }),
      },
    );
    if (!create.ok) return false;
    let prediction: any = await create.json();
    for (
      let i = 0;
      i < 20 &&
      !["succeeded", "failed", "canceled"].includes(prediction.status);
      i++
    ) {
      await new Promise((r) => setTimeout(r, 3000));
      const poll = await fetch(prediction.urls.get, {
        headers: { Authorization: `Bearer ${REPLICATE_TOKEN}` },
      });
      prediction = await poll.json();
    }
    if (prediction.status !== "succeeded") return false;
    const url = Array.isArray(prediction.output)
      ? prediction.output[0]
      : prediction.output;
    const img = await fetch(url);
    if (!img.ok) return false;
    fs.writeFileSync(outPath, Buffer.from(await img.arrayBuffer()));
    return true;
  } catch (err: any) {
    log?.warn?.(`Cover background failed: ${err.message}`);
    return false;
  }
}

function extractTex(text: string): string | null {
  const fence = text.match(/```(?:latex|tex)?\s*([\s\S]*?)```/);
  // No closing fence (truncated response) — take everything from \documentclass,
  // never the prose the model wrote before the code block.
  const tex = fence
    ? fence[1]
    : text.includes("\\documentclass")
      ? text.slice(text.indexOf("\\documentclass"))
      : null;
  if (!tex || !tex.includes("\\documentclass")) return null;
  if (!tex.includes("\\end{document}")) return null; // truncated — unusable
  return tex.trim();
}

async function compileTex(
  coverDir: string,
  texName: string,
): Promise<{ ok: boolean; logTail: string }> {
  const logPath = path.join(coverDir, texName.replace(/\.tex$/, ".log"));
  const pdfPath = path.join(coverDir, texName.replace(/\.tex$/, ".pdf"));
  if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath);
  try {
    for (let pass = 1; pass <= 2; pass++) {
      await execAsync(
        `xelatex -interaction=nonstopmode "${texName}"`,
        { timeout: 90000, maxBuffer: 10 * 1024 * 1024, cwd: coverDir },
      );
    }
  } catch {
    /* xelatex non-zero exit is normal on warnings — judge by the PDF */
  }
  const ok = fs.existsSync(pdfPath) && fs.statSync(pdfPath).size > 5000;
  const logTail = fs.existsSync(logPath)
    ? fs
        .readFileSync(logPath, "utf-8")
        .split("\n")
        .filter((l) => l.startsWith("!") || l.includes("Error"))
        .slice(0, 12)
        .join("\n") ||
      fs.readFileSync(logPath, "utf-8").slice(-1500)
    : "no log";
  return { ok, logTail };
}

async function renderPng(
  coverDir: string,
  pdfName: string,
): Promise<{ full: string; thumb: string } | null> {
  try {
    // Full render at 300 DPI with vector AA — the reviewer must judge the cover
    // at true (crisp) quality, NOT a low-res raster that fakes "jagged/pixelated"
    // artefacts the vector PDF does not actually have.
    await execAsync(
      `pdftoppm -png -singlefile -r 300 -aa yes -aaVector yes "${pdfName}" cover-review`,
      { timeout: 60000, cwd: coverDir },
    );
    // Thumbnail stays small on purpose — it tests store-listing legibility — but
    // is downscaled from a crisp source rather than rendered at a coarse DPI.
    await execAsync(
      `pdftoppm -png -singlefile -scale-to 320 -aa yes -aaVector yes "${pdfName}" cover-thumb`,
      { timeout: 60000, cwd: coverDir },
    );
    const full = path.join(coverDir, "cover-review.png");
    const thumb = path.join(coverDir, "cover-thumb.png");
    if (!fs.existsSync(full) || !fs.existsSync(thumb)) return null;
    return { full, thumb };
  } catch {
    return null;
  }
}

function imgBlock(filePath: string) {
  return {
    type: "image" as const,
    source: {
      type: "base64" as const,
      media_type: "image/png" as const,
      data: fs.readFileSync(filePath).toString("base64"),
    },
  };
}

/**
 * Design a unique cover for the project. Returns the compiled PDF path or
 * null (caller falls back to the classic parametric generator).
 */
/**
 * When a photo background is used, enforce it in CODE — the model reliably
 * ignores the prompt and draws a hard-edged solid panel over the photo. We
 * force the background full-bleed and strip any filled rectangles (panels /
 * bands / scrims) and \shade, leaving only the photo (with its baked-in smooth
 * gradient) plus the text. Non-rectangle fills (small icons) survive.
 */
function enforceBgTex(tex: string, paper: { w: number; h: number }): string {
  return tex
    .replace(
      /\\includegraphics\[[^\]]*\]\{bg\.jpg\}/g,
      `\\includegraphics[width=${paper.w}mm,height=${paper.h}mm]{bg.jpg}`,
    )
    .replace(/\\fill\b[^;]*\brectangle\b[^;]*;/g, "% [panel stripped]")
    .replace(/\\shade\b[^;]*;/g, "% [shade stripped]");
}

export async function designCover(
  projectId: string,
  log?: any,
): Promise<{ pdfPath: string } | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      chapters: { orderBy: { chapterNumber: "asc" }, select: { title: true } },
    },
  });
  if (!project) return null;

  const book: BookIdentity = {
    title: project.title || project.topic,
    subtitle: project.subtitle,
    topic: project.topic,
    language: project.language,
    stylePreset: project.stylePreset,
    customColors: project.customColors ? JSON.parse(project.customColors) : [],
    format: project.bookFormat,
    targetPages: project.targetPages,
    chapterTitles: project.chapters.map((c) => c.title),
    authorName: project.authorName,
  };
  const coverDir = path.join(process.cwd(), "tmp", "covers", projectId);
  const res = await designCoverForBook(book, coverDir, { log });
  return res ? { pdfPath: res.pdfPath } : null;
}

/**
 * Core designer — works from a BookIdentity (no DB / no S3), so it is
 * unit-testable. Picks (or is forced into) a layout frame, designs within it,
 * compiles, vision-reviews and quality-gates. Returns the PDF path + score +
 * chosen frame, or null (caller falls back to the parametric generator).
 */
export async function designCoverForBook(
  book: BookIdentity,
  coverDir: string,
  opts: { log?: any; forceFrameId?: string; disableBackground?: boolean } = {},
): Promise<{ pdfPath: string; score: number; frameId: string } | null> {
  const log = opts.log;
  const paper = PAPER_MM[book.format] || PAPER_MM.a4;
  const system = designerSystem(book, paper);

  fs.mkdirSync(coverDir, { recursive: true });
  const texName = "cover-designed.tex";

  // ━━━ Phase 1: concept ━━━
  log?.step?.("  🎨 Cover concept...");
  const conceptResp = await anthropic.messages.create({
    model: DESIGN_MODEL,
    max_tokens: 900,
    temperature: 1,
    system,
    messages: [
      {
        role: "user",
        content: `${bookBriefText(book)}

Choose the LAYOUT FRAME that best fits your idea, then develop ONE strong concept.

LAYOUT FRAMES (pick exactly one "id"):
${framesMenu()}

Respond ONLY with JSON:
{
  "frameId": "one of the frame ids above",
  "rationale": "3-5 sentences: the idea, why it fits this book and audience, what makes it distinctive",
  "direction": "short label of the visual direction (e.g. 'typographic poster', 'photographic with panel', 'geometric abstraction')",
  "background": {
    "use": true/false — do you want a generated photographic/illustrated background?,
    "prompt": "if use: English image prompt for the background (concrete scene/texture, mood, lighting; remember type must sit on it)",
    "textZone": "if use: where the calm zone for type should be (e.g. 'upper third clean sky')"
  }
}`,
      },
    ],
  });
  const conceptText =
    conceptResp.content[0].type === "text" ? conceptResp.content[0].text : "";
  const concept = parseLLMJson(conceptText, ConceptSchema);
  if (!concept.ok) {
    log?.warn?.(`Cover concept invalid: ${concept.error}`);
    return null;
  }
  log?.ok?.(
    `  🎨 Concept: ${concept.data.direction} ${concept.data.background.use ? "(+FLUX background)" : "(pure vector)"}`,
  );

  // Layout frame: forced (tests) → model's pick → first as fallback.
  const frameId =
    opts.forceFrameId || concept.data.frameId || LAYOUT_FRAMES[0].id;
  const selectedFrame =
    LAYOUT_FRAMES.find((f) => f.id === frameId) || LAYOUT_FRAMES[0];
  log?.step?.(`  🧭 Layout frame: ${selectedFrame.name}`);

  // ━━━ Phase 2: optional background ━━━
  let hasBg = false;
  if (
    !opts.disableBackground &&
    concept.data.background.use &&
    concept.data.background.prompt
  ) {
    hasBg = await generateBackground(
      concept.data.background.prompt,
      path.join(coverDir, "bg.jpg"),
      log,
    );
    log?.step?.(`  🖼️  Background: ${hasBg ? "generated" : "FAILED — design without it"}`);
    if (hasBg) {
      // Treat the photo deterministically with ImageMagick so the model never
      // has to (its TikZ scrims band or break poppler rendering):
      //   1. cover-crop to the EXACT page ratio → full-bleed never distorts it;
      //   2. bake a SMOOTH transparent→dark gradient into the lower half so the
      //      title is legible without any model-drawn scrim/panel.
      const bg = path.join(coverDir, "bg.jpg");
      const overlay = path.join(coverDir, "scrim.png");
      const wPx = Math.round((paper.w / 25.4) * 200);
      const hPx = Math.round((paper.h / 25.4) * 200);
      const topPx = Math.round(hPx * 0.3); // clear photo on top
      const gradPx = hPx - topPx; // one continuous smooth ramp — NO flat band
      const run = async (cmd: string): Promise<boolean> => {
        try { await execAsync(`magick ${cmd}`, { timeout: 30000 }); return true; }
        catch {
          try { await execAsync(`convert ${cmd}`, { timeout: 30000 }); return true; }
          catch { return false; }
        }
      };
      // Zoom ~8% while cover-cropping so any pale border FLUX bakes into the
      // photo edges is cropped off (otherwise it shows as light bars on the
      // cover's left/right sides).
      const okCrop = await run(
        `"${bg}" -resize ${Math.round(wPx * 1.08)}x${Math.round(hPx * 1.08)}^ -gravity center -extent ${wPx}x${hPx} -strip "${bg}"`,
      );
      // transparent top half + smooth none→black bottom half → composite over photo
      // transparent top + ONE smooth none→black ramp, alpha capped at ~0.9 so
      // the photo stays faintly visible even at the very bottom (no flat black
      // block that would read as a pasted panel).
      const okMake = await run(
        `-size ${wPx}x${topPx} xc:none -size ${wPx}x${gradPx} gradient:none-black -append -channel A -evaluate multiply 0.9 +channel "${overlay}"`,
      );
      const okScrim =
        okMake &&
        (await run(
          `"${bg}" "${overlay}" -gravity north -compose over -composite -strip "${bg}"`,
        ));
      if (okCrop && okScrim) log?.step?.("  🖼️  bg cover-cropped + smooth scrim baked");
      else log?.warn?.("  🖼️  ImageMagick unavailable — bg not cropped/scrim not baked");
    }
  }

  // With a photo background the text sits on the photo's pre-darkened lower band
  // (the baked gradient IS the panel) — this replaces any frame that asks for a
  // solid panel, so the prompt and the review stay consistent (no "draw a panel"
  // vs "don't draw a panel" contradiction).
  const PHOTO_PLACEMENT = `TITLE: in the lower part of the page — vertical center at 70-80% height; left-aligned to the left safe margin or centered. SUBTITLE (if any): just below, 83-88%. AUTHOR + year (if any): 90-95%. All of this text sits DIRECTLY on the photo's pre-darkened lower band in light/white type. There is NO separate solid panel — the photo's baked dark gradient is the backdrop, and the upper ~60% of the page stays clear photo.`;
  const effectiveFrameName = hasBg
    ? "Photo — text on the darkened lower band"
    : selectedFrame.name;
  const effectivePlacement = hasBg ? PHOTO_PLACEMENT : selectedFrame.placement;

  // ━━━ Phase 3: code the cover ━━━
  const history: Array<{ role: "user" | "assistant"; content: any }> = [
    {
      role: "user",
      content: `${bookBriefText(book)}

YOUR APPROVED CONCEPT:
${concept.data.rationale}
Direction: ${concept.data.direction}
${hasBg ? `Background: bg.jpg IS available — pre-cropped to the page (${paper.w}×${paper.h}mm) with a smooth dark gradient already baked into its lower half. Place it FULL-BLEED (width=${paper.w}mm,height=${paper.h}mm); put the title/subtitle/author over that darkened lower area in light type. Draw NO panel, band, filled rectangle, scrim or decorative shape over the photo (that "panel" is already in the image) — this overrides any panel in the layout frame. Never distort it.` : "Background: none — pure vector/typographic execution."}

${frameBriefText(effectiveFrameName, effectivePlacement, paper)}

Write the COMPLETE ${texName} now. Output ONLY the LaTeX code in a \`\`\`latex fence. It must compile standalone with xelatex.`,
    },
  ];

  let tex: string | null = null;
  let compiled = false;

  for (let attempt = 0; attempt <= MAX_COMPILE_FIXES; attempt++) {
    const resp = await anthropic.messages.create({
      model: DESIGN_MODEL,
      max_tokens: 14000,
      temperature: attempt === 0 ? 0.7 : 0.3,
      system,
      messages: history,
    });
    const out = resp.content[0].type === "text" ? resp.content[0].text : "";
    history.push({ role: "assistant", content: out });
    tex = extractTex(out);
    if (!tex) {
      log?.warn?.("  Cover designer returned no usable tex");
      return null;
    }
    if (hasBg) tex = enforceBgTex(tex, paper);
    fs.writeFileSync(path.join(coverDir, texName), tex, "utf-8");
    const result = await compileTex(coverDir, texName);
    if (result.ok) {
      compiled = true;
      break;
    }
    log?.warn?.(`  ⚙️ Cover compile failed (attempt ${attempt + 1})`);
    if (attempt < MAX_COMPILE_FIXES) {
      history.push({
        role: "user",
        content: `Compilation FAILED. xelatex errors:\n${result.logTail}\n\nFix the code and output the complete corrected file again in a \`\`\`latex fence.`,
      });
    }
  }
  if (!compiled || !tex) return null;

  // ━━━ Phase 4: vision review & revise ━━━
  let lastScore = 0;
  let lastVerdict: string = "revise";
  for (let round = 0; round < MAX_REVIEW_ROUNDS; round++) {
    const pngs = await renderPng(coverDir, texName.replace(/\.tex$/, ".pdf"));
    if (!pngs) break;

    const reviewResp = await anthropic.messages.create({
      model: DESIGN_MODEL,
      max_tokens: 800,
      temperature: 0.2,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `You are a ruthless art director reviewing a book cover BEFORE print.
Book title (must appear verbatim): "${book.title}"
Language: ${book.language}
Layout frame in use — "${effectiveFrameName}":
  ${effectivePlacement}

Image 1 = full cover. Image 2 = thumbnail (store-listing size).

Judge:
1. Title present in full and verbatim, dominant and readable (also at THUMBNAIL size)? NOTE: ALL-CAPS, and varying size/weight across the title's words or lines, are legitimate design choices — do NOT treat them as a "verbatim violation" as long as the complete title text is present and reads as the title.
2. Any text clipped, overflowing the page, overlapping illegibly, or sitting on a busy area without sufficient contrast?
3. Hierarchy and composition: one dominant idea? balanced margins? deliberate alignment?
4. Color: deliberate palette? sufficient type/ground contrast everywhere?
5. Craft: does anything look broken, misplaced, or accidental (stray shapes, half-rendered elements, default-LaTeX look)?
6. Taste: does it look like a designed retail cover for this subject, free of kitsch?
7. Layout frame: do the title, subtitle and author sit in the frame's prescribed zones above? Flag it if the title drifted out of its zone or the frame was ignored.${hasBg ? `\n8. Photo background: set verdict "revise" if ANY solid color panel/band, filled rectangle, scrim, or decorative shape is drawn OVER the photo. With a photo background the text must sit directly on the photo's own pre-darkened lower area — a hard-edged color block under/over the photo is a defect, not a design choice.` : ""}

Respond ONLY with JSON:
{"verdict":"approve|revise","score":1-10,"issues":["specific problem ..."],"fixes":"concrete instructions for the designer"}
Approve ONLY if score >= 7 and no critical issues (clipping, illegible title, broken rendering).`,
            },
            imgBlock(pngs.full),
            imgBlock(pngs.thumb),
          ],
        },
      ],
    });
    const reviewText =
      reviewResp.content[0].type === "text" ? reviewResp.content[0].text : "";
    const review = parseLLMJson(reviewText, ReviewSchema);
    if (!review.ok) break;

    lastScore = review.data.score;
    lastVerdict = review.data.verdict;
    log?.step?.(
      `  🔍 Cover review: ${review.data.verdict} (${review.data.score}/10)${review.data.issues.length ? " — " + review.data.issues[0] : ""}`,
    );
    fs.writeFileSync(
      path.join(coverDir, `cover-review-${round + 1}.json`),
      JSON.stringify(
        { frame: selectedFrame.id, concept: concept.data, review: review.data },
        null,
        2,
      ),
    );

    if (review.data.verdict === "approve") break;
    // last allowed round: no further revision — the gate below decides
    if (round === MAX_REVIEW_ROUNDS - 1) break;

    // revise
    history.push({
      role: "user",
      content: `ART DIRECTOR REVIEW — revisions required (score ${review.data.score}/10):
${review.data.issues.map((i) => "- " + i).join("\n")}

Instructions: ${review.data.fixes}

Revise your design accordingly. Keep the concept, fix the execution. Output the complete corrected file in a \`\`\`latex fence.`,
    });
    const resp = await anthropic.messages.create({
      model: DESIGN_MODEL,
      max_tokens: 14000,
      temperature: 0.4,
      system,
      messages: history,
    });
    const out = resp.content[0].type === "text" ? resp.content[0].text : "";
    history.push({ role: "assistant", content: out });
    let revised = extractTex(out);
    if (!revised) break;
    if (hasBg) revised = enforceBgTex(revised, paper);
    fs.writeFileSync(path.join(coverDir, texName), revised, "utf-8");
    const result = await compileTex(coverDir, texName);
    if (!result.ok) {
      // revision broke the build — keep the previous compiling version
      fs.writeFileSync(path.join(coverDir, texName), tex, "utf-8");
      await compileTex(coverDir, texName);
      break;
    }
    tex = revised;
  }

  const pdfPath = path.join(coverDir, "cover-designed.pdf");
  if (!fs.existsSync(pdfPath) || fs.statSync(pdfPath).size < 5000) return null;

  // Quality gate: never ship a cover its own reviewer scored as weak —
  // the classic parametric cover is the better deal then.
  if (lastVerdict !== "approve" && lastScore < MIN_ACCEPT_SCORE) {
    log?.warn?.(
      `  🎨 Designed cover rejected by quality gate (${lastScore}/10) — using classic generator`,
    );
    return null;
  }

  log?.ok?.(
    `  🎨 AI-designed cover ready (review: ${lastScore}/10, frame: ${selectedFrame.name})`,
  );
  return { pdfPath, score: lastScore, frameId: selectedFrame.id };
}
