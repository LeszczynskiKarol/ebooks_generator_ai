// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Automatic look: when the customer leaves the style on "auto" and/or picks
// no colours, the model chooses the style preset and a 3-colour accent
// palette for THIS book's topic and audience (2026-10-06 — a fixed palette
// per preset meant every unconfigured book was violet).
//
// Runs once per order (designResolvedAt): alongside the free preview, or —
// for orders that never had one (mobile app) — before the paid structure.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
import { llmLangName } from "../lib/languages";
import { withCost } from "../lib/costTracker";
import { z } from "zod";
import { createLLMClient, SONNET_MODEL } from "../lib/llm";
import { prisma } from "../lib/prisma";
import { parseLLMJson } from "../lib/llmJson";

const anthropic = createLLMClient();

const PRESETS: Record<string, string> = {
  modern: "contemporary sans/serif mix, clean, direct — practical guides, how-to, self-improvement, lifestyle",
  academic: "classic serif, formal, precise — scholarly, medical, legal, theory-heavy or study material",
  minimal: "elegant, restrained, lots of white space — calm topics, mindfulness, design, essays",
  creative: "bold, expressive, narrative — storytelling, hobbies, travel, food, kids/family, arts",
  business: "sharp all-sans, results-oriented — business, finance, marketing, careers, B2B lead magnets",
};

const DesignSchema = z.object({
  stylePreset: z.string(),
  colors: z.array(z.string()).default([]),
});

const HEX = /^#[0-9A-Fa-f]{6}$/;

/** Picks style and/or colours for an order whose customer left them on auto.
 *  No-op when nothing is on auto or it was already resolved. Never throws. */
export function resolveAutoDesign(projectId: string, log?: any): Promise<void> {
  return withCost(projectId, "design", () => pickDesign(projectId, log));
}

async function pickDesign(projectId: string, log?: any): Promise<void> {
  try {
    const p = await prisma.project.findUnique({ where: { id: projectId } });
    if (!p || p.designResolvedAt || (!p.autoStyle && !p.autoColors)) return;

    const prompt = `You are the art director of a book publisher. Choose the look of this book from its subject and audience.

BOOK:
Topic: ${p.topic}
${p.title ? `Title: ${p.title}` : ""}
${p.guidelines ? `Customer brief: ${p.guidelines.slice(0, 4000)}` : ""}
Language: ${llmLangName(p.language)} | ${p.targetPages} pages

${p.autoStyle ? `STYLE — pick exactly one preset key:\n${Object.entries(PRESETS).map(([k, d]) => `- ${k}: ${d}`).join("\n")}` : `STYLE is fixed by the customer: ${p.stylePreset} (return it unchanged).`}

${p.autoColors ? `COLOURS — 3 hex accent colours that fit the subject and mood (e.g. calm greens for gardening, warm tones for family topics, deep navy for finance). They print on white paper as headings, chapter bands and box frames, so the FIRST colour must be dark enough for white text on it and for headings on white (contrast ≥ 4.5:1 against white). Harmonious, professional, not neon.` : `COLOURS: return an empty array.`}

Respond with RAW JSON only: {"stylePreset":"<key>","colors":["#RRGGBB","#RRGGBB","#RRGGBB"]}`;

    const res = await anthropic.messages.create({
      model: SONNET_MODEL,
      max_tokens: 300,
      messages: [{ role: "user", content: prompt }],
    });
    const text = res.content[0]?.type === "text" ? res.content[0].text : "";
    const parsed = parseLLMJson(text, DesignSchema);
    if (!parsed.ok) throw new Error(parsed.error);

    const style = p.autoStyle && PRESETS[parsed.data.stylePreset] ? parsed.data.stylePreset : p.stylePreset;
    const colors = parsed.data.colors.filter((c) => HEX.test(c)).slice(0, 3);
    await prisma.project.update({
      where: { id: projectId },
      data: {
        stylePreset: style,
        ...(p.autoColors && colors.length ? { customColors: JSON.stringify(colors) } : {}),
        designResolvedAt: new Date(),
      },
    });
    log?.ok?.(`Auto design: ${style} ${colors.join(" ")}`);
  } catch (e: any) {
    // The preset palette is a fine fallback; never block the order.
    log?.warn?.(`Auto design skipped: ${e?.message}`);
  }
}
