// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BookForge — AI Illustrations (FLUX 1.1 Pro Ultra via Replicate)
//
// Optional pipeline phase (Project.useAiImages): after review, before
// compilation, each chapter gets ONE illustration:
//   1. a cheap model reads the finished chapter and returns a brief
//      (placement anchor, caption in the book language, EN image prompt,
//      and the kind: raw photo / polished photo / flat illustration),
//   2. FLUX renders it (the `raw` flag is decided PER IMAGE by the brief —
//      documentary subjects suit raw, conceptual imagery does not),
//   3. the image is stored (S3 + local fallback) and a \begin{figure}
//      block is inserted into the chapter LaTeX server-side.
// Failures are non-fatal — a chapter simply stays unillustrated.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import * as fs from "fs";
import * as path from "path";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { createLLMClient } from "../lib/llm";
import { parseLLMJson } from "../lib/llmJson";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const anthropic = createLLMClient();
const BRIEF_MODEL = "claude-sonnet-4-6"; // Karol: always sonnet, not haiku

const REPLICATE_TOKEN =
  process.env.FLUX_API || process.env.REPLICATE_API_TOKEN || "";
const FLUX_MODEL = "black-forest-labs/flux-1.1-pro-ultra";

// ── Brief schema ──
const IllustrationBriefSchema = z
  .object({
    anchor: z.string().min(12),
    caption: z.string().min(5).max(300),
    prompt: z.string().min(10).max(800),
    kind: z.enum(["photo-raw", "photo-polished", "illustration"]),
    hasPeople: z.boolean().default(false),
  })
  .passthrough();

const MultiBriefSchema = z
  .object({
    images: z.array(IllustrationBriefSchema).min(1).max(8),
  })
  .passthrough();

// density → roughly how many book pages one image should serve
const DENSITY_PAGES_PER_IMAGE: Record<string, number> = {
  standard: 5,
  rich: 3,
};
const MAX_IMAGES_PER_BOOK = 15;
const MAX_IMAGES_PER_CHAPTER = 6;

// People in illustrations must be locally credible for the book's audience —
// a Polish handbook with visibly non-local casts reads as stocky and fake.
// Applied server-side whenever the brief reports people in the scene.
const LOCALE_PEOPLE_HINT: Record<string, string> = {
  pl: "people of Polish (Central European) appearance, realistic Polish setting",
  en: "people of Western European or North American appearance",
  de: "people of German (Central European) appearance, realistic German setting",
  es: "people of Spanish (Southern European) appearance, realistic Spanish setting",
  fr: "people of French (Western European) appearance, realistic French setting",
  it: "people of Italian (Southern European) appearance, realistic Italian setting",
  pt: "people of Portuguese (Southern European) appearance, realistic Portuguese setting",
  nl: "people of Dutch (Northern European) appearance, realistic Dutch setting",
};

// kind → FLUX raw flag + prompt prefix
const KIND_CONFIG: Record<
  string,
  { raw: boolean; prefix: string }
> = {
  "photo-raw": {
    raw: true,
    prefix:
      "Candid documentary photograph, natural available light, realistic textures, ",
  },
  "photo-polished": {
    raw: false,
    prefix:
      "Professional editorial photograph, clean composition, soft studio light, ",
  },
  illustration: {
    raw: false,
    prefix:
      "Flat modern editorial illustration, simple geometric shapes, generous negative space, ",
  },
};

// book style → palette/mood hint appended to every prompt
const STYLE_HINT: Record<string, string> = {
  modern: "contemporary look, balanced palette",
  academic: "calm neutral tones, serious and trustworthy mood",
  minimal: "restrained monochrome palette, minimalist composition",
  creative: "bold expressive colors, dynamic composition",
  business: "corporate look, blue and neutral tones",
};

const PROMPT_SUFFIX =
  ", no text, no words, no letters, no labels, no watermark";

// minimal LaTeX escaping for captions (plain text from the model)
function escCaption(text: string): string {
  return text
    .replace(/\\/g, "")
    .replace(/[&%$#_{}]/g, (m) => "\\" + m)
    .replace(/~/g, " ");
}

// ── Replicate call (sync via Prefer: wait, fallback poll) ──
// Exported: blog-hero endpoint (autopilotRoutes) reuses the same generator.
export async function generateFluxImage(
  prompt: string,
  raw: boolean,
  log?: any,
  opts?: { aspectRatio?: string },
): Promise<{ buffer: Buffer; seed: number | null } | null> {
  if (!REPLICATE_TOKEN) {
    log?.warn?.("FLUX_API not set — skipping illustration");
    return null;
  }

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
          prompt,
          aspect_ratio: opts?.aspectRatio || "3:2",
          raw,
          output_format: "jpg",
          safety_tolerance: 2,
        },
      }),
    },
  );
  if (!create.ok) {
    log?.warn?.(`Replicate ${create.status}: ${(await create.text()).slice(0, 200)}`);
    return null;
  }
  let prediction: any = await create.json();

  // Poll if the sync wait didn't finish
  for (
    let i = 0;
    i < 20 &&
    prediction.status !== "succeeded" &&
    prediction.status !== "failed" &&
    prediction.status !== "canceled";
    i++
  ) {
    await new Promise((r) => setTimeout(r, 3000));
    const poll = await fetch(prediction.urls.get, {
      headers: { Authorization: `Bearer ${REPLICATE_TOKEN}` },
    });
    prediction = await poll.json();
  }
  if (prediction.status !== "succeeded") {
    log?.warn?.(`FLUX prediction ${prediction.status}: ${prediction.error || ""}`);
    return null;
  }

  const url = Array.isArray(prediction.output)
    ? prediction.output[0]
    : prediction.output;
  if (!url) return null;

  const img = await fetch(url);
  if (!img.ok) return null;
  const buffer = Buffer.from(await img.arrayBuffer());
  const seed =
    typeof prediction?.metrics?.seed === "number"
      ? prediction.metrics.seed
      : typeof prediction?.input?.seed === "number"
        ? prediction.input.seed
        : null;
  return { buffer, seed };
}

// ── Store image: S3 when configured + local fallback for the compiler ──
async function storeImage(
  projectId: string,
  chapterNumber: number,
  buffer: Buffer,
): Promise<{ s3Key: string; s3Url: string }> {
  const fileName = `ai-ch${chapterNumber}-${Date.now()}.jpg`;
  const s3Key = `books/${projectId}/images/${fileName}`;
  const region = process.env.AWS_REGION || "eu-north-1";
  const bucket = process.env.S3_BUCKET;

  // local fallback — downloadProjectImages() reads tmp/uploads/{id}/{basename}
  const localDir = path.join(process.cwd(), "tmp", "uploads", projectId);
  fs.mkdirSync(localDir, { recursive: true });
  fs.writeFileSync(path.join(localDir, fileName), buffer);

  if (process.env.AWS_ACCESS_KEY_ID && bucket) {
    const s3 = new S3Client({
      region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: s3Key,
        Body: buffer,
        ContentType: "image/jpeg",
      }),
    );
  }

  // The URL doubles as the unique token in LaTeX that rewriteImageUrls()
  // swaps for the packaged local path at compile time.
  const s3Url = bucket
    ? `https://${bucket}.s3.${region}.amazonaws.com/${s3Key}`
    : `bookforge-local://${s3Key}`;
  return { s3Key, s3Url };
}

// ── Brief: where to put the images, what they show, how they should look ──
async function briefsForChapter(
  chapterTitle: string,
  latex: string,
  language: string,
  stylePreset: string,
  count: number,
  existingCaptions: string[],
  userGuidance?: string | null,
  log?: any,
): Promise<z.infer<typeof IllustrationBriefSchema>[]> {
  // Strip heavy environments so the model reads prose, not tables
  const cleanText = latex
    .replace(/\\begin\{(table|tabularx|tabular)\}[^]*?\\end\{(table|tabularx|tabular)\}/g, "[TABLE]")
    .replace(/\\begin\{figure\}[^]*?\\end\{figure\}/g, "[EXISTING IMAGE]")
    .substring(0, 14000);

  const styleBias =
    stylePreset === "creative"
      ? "This book is CREATIVE — lean towards photo-raw when people/places appear."
      : stylePreset === "academic" || stylePreset === "business"
        ? "This book is FORMAL — prefer photo-polished or illustration; choose photo-raw only for genuinely documentary scenes."
        : stylePreset === "minimal"
          ? "This book is MINIMAL — prefer illustration."
          : "";

  const prompt = `You are an art director planning the illustrations for a book chapter.

CHAPTER: "${chapterTitle}"
BOOK STYLE: ${stylePreset}
CAPTION LANGUAGE: ${language}
TARGET: exactly ${count} illustration(s), spread through the WHOLE chapter (not clustered at the start)
${
  existingCaptions.length
    ? `
ALREADY ILLUSTRATED IN THIS CHAPTER (do NOT repeat these subjects, place new images elsewhere):
${existingCaptions.map((c) => "- " + c).join("\n")}
`
    : ""
}${
  userGuidance
    ? `
AUTHOR'S IMAGE PREFERENCES (respect them when picking subject and style):
${userGuidance.substring(0, 600)}
`
    : ""
}
CHAPTER TEXT (LaTeX):
${cleanText}

Respond ONLY with JSON:
{
  "images": [
    {
      "anchor": "EXACT verbatim substring (40-80 chars) copied character-for-character from the chapter text above, ending at a sentence end — the image will be inserted right AFTER this fragment",
      "caption": "figure caption in ${language}, 1 sentence, informative not decorative",
      "prompt": "English image prompt: concrete subject, setting, composition. Describe a SCENE, never text/diagrams/charts",
      "kind": "photo-raw | photo-polished | illustration",
      "hasPeople": true/false
    }
  ]
}

KIND RULES:
- photo-raw: natural documentary photography — real people in real environments, candid moments, workplaces. Use when the passage is about human experience or practice.
- photo-polished: refined editorial photography — objects, still lifes, symbolic compositions, polished aesthetics. Use for conceptual or process-oriented passages.
- illustration: flat editorial graphic — abstract concepts, relationships, anything a camera could not capture well.
${styleBias}

HARD RULES:
- return EXACTLY ${count} image(s), each anchored to a DIFFERENT part of the chapter
- every subject must be DISTINCT — no two images of the same dish/object/scene
- anchor MUST be copied verbatim from the text (it will be string-matched), MUST NOT
  contain LaTeX commands or line breaks, and MUST NOT sit inside [EXISTING IMAGE] or [TABLE]
- the image must contain NO text, letters or labels
- AVOID subjects that inherently show printed text up close (forms, questionnaires,
  open book pages, screens, signs) — the generator renders gibberish glyphs on them;
  prefer scenes, objects and environments where no readable surface dominates
- never propose charts, diagrams with labels, or UI screenshots
- if the scene contains people, their appearance and the environment MUST be
  locally plausible for the book's audience (language: ${language}) — set hasPeople=true`;

  try {
    const response = await anthropic.messages.create({
      model: BRIEF_MODEL,
      max_tokens: 1800,
      temperature: 0.4,
      messages: [{ role: "user", content: prompt }],
    });
    const text =
      response.content[0].type === "text" ? response.content[0].text : "{}";
    const result = parseLLMJson(text, MultiBriefSchema);
    if (!result.ok) {
      log?.warn?.(`Illustration brief invalid: ${result.error}`);
      return [];
    }
    return result.data.images.slice(0, count);
  } catch (err: any) {
    log?.warn?.(`Illustration brief failed: ${err.message}`);
    return [];
  }
}

/**
 * Illustrate all LATEX_READY chapters of a project. Image count scales with
 * the book's length and the chosen density (imageDensity: standard|rich),
 * capped per chapter and per book. Re-running tops chapters up to the target
 * without duplicating existing placements.
 */
export async function illustrateChapters(
  projectId: string,
  opts: {
    language: string;
    stylePreset: string;
    imageGuidelines?: string | null;
    imageDensity?: string | null;
    log?: any;
  },
): Promise<number> {
  const { language, stylePreset, imageGuidelines, log } = opts;
  const perPages =
    DENSITY_PAGES_PER_IMAGE[opts.imageDensity || "standard"] ||
    DENSITY_PAGES_PER_IMAGE.standard;
  const chapters = await prisma.chapter.findMany({
    where: { projectId, status: "LATEX_READY" },
    orderBy: { chapterNumber: "asc" },
    include: { imagePlacements: true },
  });

  const existingTotal = chapters.reduce(
    (n, c) => n + c.imagePlacements.length,
    0,
  );
  let bookBudget = MAX_IMAGES_PER_BOOK - existingTotal;

  let added = 0;
  for (const ch of chapters) {
    if (!ch.latexContent || bookBudget <= 0) continue;

    const target = Math.min(
      MAX_IMAGES_PER_CHAPTER,
      Math.max(1, Math.round((ch.targetPages || 10) / perPages)),
    );
    const need = Math.min(target - ch.imagePlacements.length, bookBudget);
    if (need <= 0) {
      log?.step?.(
        `  Ch.${ch.chapterNumber}: ${ch.imagePlacements.length}/${target} images — already at target`,
      );
      continue;
    }

    const briefs = await briefsForChapter(
      ch.title,
      ch.latexContent,
      language,
      stylePreset,
      need,
      ch.imagePlacements.map((p) => p.caption || "").filter(Boolean),
      imageGuidelines,
      log,
    );

    let latex = ch.latexContent;
    let chapterAdded = 0;
    for (const brief of briefs) {
      if (!latex.includes(brief.anchor)) {
        log?.warn?.(
          `  Ch.${ch.chapterNumber}: anchor not found in text — skipping one image`,
        );
        continue;
      }

      const kindCfg = KIND_CONFIG[brief.kind] || KIND_CONFIG["photo-polished"];
      const fluxPrompt =
        kindCfg.prefix +
        brief.prompt +
        // Locale credibility: people in a Polish book should look Polish etc.
        (brief.hasPeople
          ? ", " + (LOCALE_PEOPLE_HINT[language] || LOCALE_PEOPLE_HINT.en)
          : "") +
        ", " +
        (STYLE_HINT[stylePreset] || STYLE_HINT.modern) +
        (imageGuidelines ? ", " + imageGuidelines.substring(0, 200) : "") +
        PROMPT_SUFFIX;

      log?.step?.(
        `  Ch.${ch.chapterNumber}: ${brief.kind} (raw=${kindCfg.raw}) — "${brief.prompt.substring(0, 70)}..."`,
      );

      const image = await generateFluxImage(fluxPrompt, kindCfg.raw, log);
      if (!image) continue;

      const { s3Key, s3Url } = await storeImage(
        projectId,
        ch.chapterNumber,
        image.buffer,
      );

      const dbImage = await prisma.projectImage.create({
        data: {
          projectId,
          source: "AI_GENERATED",
          s3Key,
          s3Url,
          format: "jpg",
          fluxPrompt,
          fluxSeed: image.seed,
          description: brief.caption,
        },
      });
      await prisma.imagePlacement.create({
        data: {
          chapterId: ch.id,
          imageId: dbImage.id,
          position: brief.anchor.substring(0, 250),
          caption: brief.caption,
          width: 0.85,
        },
      });

      const figureBlock = `\n\n\\begin{figure}[h]\n\\centering\n\\includegraphics[width=0.85\\linewidth]{${s3Url}}\n\\caption{${escCaption(brief.caption)}}\n\\end{figure}\n\n`;
      // Model MA kończyć anchor na końcu zdania, ale bywa, że urywa go w
      // środku — wstawienie figury tam rozcina zdanie na dwa akapity (reszta
      // zaczyna się od ", na przykład..."). Dlatego punkt wstawienia zawsze
      // przesuwamy do końca BIEŻĄCEGO akapitu (najbliższe "\n\n") — figura
      // między akapitami nigdy nie tnie zdania.
      const anchorIdx = latex.indexOf(brief.anchor);
      let insertAt = anchorIdx + brief.anchor.length;
      const paraEnd = latex.indexOf("\n\n", insertAt);
      insertAt = paraEnd === -1 ? latex.length : paraEnd;
      latex = latex.slice(0, insertAt) + figureBlock + latex.slice(insertAt);

      chapterAdded++;
      bookBudget--;
      log?.ok?.(
        `  Ch.${ch.chapterNumber}: illustration ${ch.imagePlacements.length + chapterAdded}/${target} added (${(image.buffer.length / 1024).toFixed(0)} KB)`,
      );
      if (bookBudget <= 0) break;
    }

    if (chapterAdded > 0) {
      await prisma.chapter.update({
        where: { id: ch.id },
        data: { latexContent: latex },
      });
      added += chapterAdded;
    }
  }
  return added;
}
