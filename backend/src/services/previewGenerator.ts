// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Free pre-payment preview — title + table of contents (chapters and
// sections with descriptions and page budgets), generated in ONE LLM call
// (no research, no brief).
//
// Why: 2026-10 funnel showed 44/74 users leaving the order form within
// ~18 s and 10/12 abandoning Stripe — they were asked to pay for a book
// they could not see. The preview shows them their book first.
//
// The preview has the SAME shape as ProjectStructure.structureJson, so the
// customer edits it in the same StructureEditor they get after payment
// (titles, descriptions, pages, add/remove chapters and sections, AI redo
// with feedback). After payment, generateStructure() receives the (possibly
// edited) preview as the contract the customer paid for.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
import crypto from "crypto";
import { z } from "zod";
import { createLLMClient, SONNET_MODEL } from "../lib/llm";
import { prisma } from "../lib/prisma";
import { parseLLMJson } from "../lib/llmJson";
import { rebalancePages } from "../lib/pageBudget";

const anthropic = createLLMClient();

// Sonnet over Haiku on purpose (eval 2026-10-06, 10 real orders): Haiku made
// Polish errors a customer notices ("Czwarta czara dziecka") and under-planned
// long briefs; Sonnet costs ~$0.03 vs ~$0.01 per preview.
export const PREVIEW_MODEL = process.env.PREVIEW_MODEL || SONNET_MODEL;

// $ per 1M tokens [input, output] — cost ledger only, billing is Anthropic's.
const PRICES: Array<[RegExp, number, number]> = [
  [/haiku-4-5/, 1, 5],
  [/sonnet-5/, 2, 10],
  [/sonnet-4/, 3, 15],
];

export function previewCostUsd(model: string, inTok: number, outTok: number) {
  const p = PRICES.find(([re]) => re.test(model));
  if (!p) return 0;
  return (inTok * p[1] + outTok * p[2]) / 1_000_000;
}

// Lenient on input (LLM output or customer edits), strict on output via
// normalizePreview(). Sections may arrive as bare strings (older previews).
const SectionInSchema = z.union([
  z.string().transform((title) => ({ title, description: "", targetPages: 0 })),
  z.object({
    title: z.string(),
    description: z.string().optional().default(""),
    targetPages: z.coerce.number().optional().default(0),
  }),
]);
const ChapterInSchema = z.object({
  title: z.string(),
  description: z.string().optional().default(""),
  targetPages: z.coerce.number().optional().default(0),
  sections: z.array(SectionInSchema).optional().default([]),
});
const PreviewInSchema = z.object({
  rejected: z.boolean().optional(),
  reason: z.string().optional(),
  suggestedTitle: z.string().optional(),
  title: z.string().optional(), // legacy key
  subtitle: z.string().optional().default(""),
  promise: z.string().optional().default(""),
  chapters: z.array(ChapterInSchema).optional().default([]),
});

export interface PreviewSection {
  id: string;
  title: string;
  description: string;
  targetPages: number;
  order: number;
}
export interface PreviewChapter {
  id: string;
  number: number;
  title: string;
  description: string;
  targetPages: number;
  sections: PreviewSection[];
}
export interface BookPreview {
  rejected?: boolean;
  reason?: string;
  suggestedTitle: string;
  subtitle: string;
  promise: string;
  chapters: PreviewChapter[];
  /** true once the customer changed it in the editor */
  editedByCustomer?: boolean;
}

const clip = (s: string, n: number) => s.trim().slice(0, n);

/** Stable ids, sequential numbering, sane page budgets, size caps. */
export function normalizePreview(raw: unknown): BookPreview | null {
  const parsed = PreviewInSchema.safeParse(raw);
  if (!parsed.success) return null;
  const d = parsed.data;
  if (d.rejected) {
    return {
      rejected: true,
      reason: clip(d.reason || "", 500),
      suggestedTitle: "",
      subtitle: "",
      promise: "",
      chapters: [],
    };
  }
  const chapters = d.chapters
    .filter((c) => c.title.trim())
    .slice(0, 40)
    .map((c, ci) => {
      const id = `ch${ci + 1}`;
      const sections = c.sections
        .filter((s) => s.title.trim())
        .slice(0, 20)
        .map((s, si) => ({
          id: `${id}-s${si + 1}`,
          title: clip(s.title, 300),
          description: clip(s.description, 1000),
          targetPages: Math.max(0.5, Math.round((s.targetPages || 1) * 2) / 2),
          order: si,
        }));
      const sectionPages = sections.reduce((a, s) => a + s.targetPages, 0);
      return {
        id,
        number: ci + 1,
        title: clip(c.title, 300),
        description: clip(c.description, 1000),
        targetPages: Math.max(1, Math.round(c.targetPages || sectionPages || 1)),
        sections,
      };
    });
  return {
    suggestedTitle: clip(d.suggestedTitle || d.title || "", 300),
    subtitle: clip(d.subtitle, 500),
    promise: clip(d.promise, 1500),
    chapters,
  };
}

export interface PreviewInput {
  topic: string;
  title: string | null;
  guidelines: string | null;
  language: string;
  targetPages: number;
  stylePreset: string;
}

/** Same inputs → same hash → the stored preview is returned without a call. */
export function previewInputHash(p: PreviewInput): string {
  return crypto
    .createHash("sha256")
    .update(
      JSON.stringify([
        p.topic.trim(),
        (p.title || "").trim(),
        (p.guidelines || "").trim(),
        p.language,
        p.targetPages,
        // not the style: the plan depends on the description, and the auto
        // look rewrites stylePreset after the first preview (2026-10-06: a
        // resubmitted, unchanged order paid for a second preview).
      ]),
    )
    .digest("hex")
    .slice(0, 32);
}

const LANG_NAMES: Record<string, string> = {
  pl: "Polish",
  en: "English",
  de: "German",
  es: "Spanish",
  fr: "French",
  it: "Italian",
  pt: "Portuguese",
};

function capitalizationRule(lang: string): string {
  if (lang === "en")
    return "Use Title Case for the book title and chapter titles.";
  if (lang === "de")
    return "Follow German orthography (nouns capitalized), no English Title Case.";
  return 'Use SENTENCE CASE for the title and every chapter/section title — capitalize only the first word and proper nouns (e.g. "Architektura rozproszenia", NOT "Architektura Rozproszenia").' +
    (lang === "pl" ? " Quotations use Polish typographic quotes „…” — never straight double or single quotes." : "");
}

function formatPreviewOutline(pv: BookPreview): string {
  return pv.chapters
    .map(
      (c) =>
        `${c.number}. ${c.title} (${c.targetPages} p.) — ${c.description}${c.sections
          .map((s) => `\n   - ${s.title} (${s.targetPages} p.)${s.description ? ` — ${s.description}` : ""}`)
          .join("")}`,
    )
    .join("\n");
}

export interface RedoInput {
  /** what the customer wants changed */
  feedback: string;
  /** the version they are looking at (possibly edited by them) */
  previous: BookPreview;
}

export function buildPreviewPrompt(p: PreviewInput, redo?: RedoInput): string {
  const lang = LANG_NAMES[p.language] || p.language;
  const chLo = Math.min(10, Math.max(3, Math.round(p.targetPages / 18)));
  const chHi = Math.min(14, Math.max(chLo + 1, Math.round(p.targetPages / 8)));

  const redoBlock = redo
    ? `
THIS IS A REVISION. The customer is looking at this version:
Title: ${redo.previous.suggestedTitle}
${formatPreviewOutline(redo.previous)}

${redo.feedback.trim() ? `Their request for the new version: ${redo.feedback.trim().slice(0, 2000)}\nApply it fully; keep what they did not ask to change.` : "They asked for a different version: propose a genuinely different angle and chapter arc, not a reworded copy."}
`
    : "";

  return `You are a senior non-fiction editor. A customer described the eBook they want. Before they pay, show them the book they will get: its title and a table of contents good enough that they think "yes, that is exactly my book — and better than I could plan it myself".

CUSTOMER ORDER:
Topic / description: ${p.topic}
${p.title ? `Title chosen by the customer (keep it EXACTLY, do not rephrase): ${p.title}` : "Title: not given — propose one."}
${p.guidelines ? `Customer guidelines: ${p.guidelines}` : ""}
Length: ${p.targetPages} pages | Style: ${p.stylePreset} | Language of the book: ${lang}
${redoBlock}
HOW TO PLAN IT:
- First work out silently who the reader is, what they need to be able to do or understand after the book, and what genre this is (practical guide, cookbook/collection, narrative, workbook, reference, academic…). Plan in that genre's logic.
- Each chapter has a clear angle or job, not just a subject label. Chapters build on each other; no filler like "What is X" / "Why X matters" / generic "Introduction" eating a chapter, no vague "Future trends" or "Tips and tricks".
- Name concrete things the customer will recognise as real substance: methods, steps, examples, cases, recipes, tools, numbers — whatever the genre calls for. Never invent statistics, studies or quotes.
- Respect everything the customer asked for in the description and guidelines (audience, scope, tone, must-have topics, structure they described). If they described a structure, follow it.
- ${chLo}-${chHi} chapters for ${p.targetPages} pages (the material decides within that range). 2-5 sections per chapter.
- Page budgets: every chapter and section gets "targetPages"; chapter pages add up to about ${p.targetPages}, a chapter's sections add up to the chapter.
- A collection book (N recipes, exercises, case studies, animal pairs…): chapters are thematic groups and the sections name the items.
- The order settings win over the description: plan for ${p.targetPages} pages in ${lang} even if the description asks for another length or language — scale the plan down (fewer items, tighter scope) instead of refusing.
- Vary title shapes (plain noun phrase, how-to, question, promise); the antithesis pattern "X, not Y" at most once; a colon in at most half the titles.
- Write EVERYTHING (title, subtitle, promise, chapters, sections) in correct, natural ${lang}, as a native ${lang} editor would — correct grammar and inflection, no words or phrases from another language except proper names and terms ${lang} professionals really use. ${capitalizationRule(p.language)}

Refuse ONLY when there is no real subject at all (random characters, a meaningless word, spam) or the content is something you would not write. Mismatched settings, an over-ambitious scope, a foreign-language description or vague wording are NEVER reasons to refuse — plan the best book you can. To refuse, return {"rejected": true, "reason": "<one short sentence for the customer, in ${lang}>"} and nothing else.

Respond with RAW JSON only, no markdown fences:
{
  "suggestedTitle": "Book title",
  "subtitle": "Optional subtitle that sharpens the promise, or empty string",
  "promise": "2 sentences addressed to the reader: who this book is for and what they will be able to do after reading it.",
  "chapters": [
    {
      "title": "Chapter title with a clear angle",
      "description": "1-2 sentences, max ~35 words: what this chapter gives the reader, naming 1-3 concrete things.",
      "targetPages": 8,
      "sections": [
        { "title": "Section title", "description": "One sentence, max ~20 words: what exactly this section covers.", "targetPages": 2 }
      ]
    }
  ]
}`;
}

export interface PreviewResult {
  preview: BookPreview;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

export async function generatePreview(
  p: PreviewInput,
  model: string = PREVIEW_MODEL,
  redo?: RedoInput,
): Promise<PreviewResult> {
  const response = await anthropic.messages.create({
    model,
    max_tokens: 6000,
    messages: [{ role: "user", content: buildPreviewPrompt(p, redo) }],
  });
  const text =
    response.content[0]?.type === "text" ? response.content[0].text : "";
  const inputTokens = response.usage?.input_tokens || 0;
  const outputTokens = response.usage?.output_tokens || 0;
  const usedModel = response.model || model;

  const parsed = parseLLMJson(text, PreviewInSchema);
  if (!parsed.ok) throw new Error(`Invalid preview JSON: ${parsed.error}`);
  const preview = normalizePreview(parsed.data);
  if (!preview) throw new Error("Preview failed normalization");
  if (!preview.rejected && preview.chapters.length === 0) {
    throw new Error("Preview has no chapters");
  }
  // The customer's own title always wins over the model's suggestion.
  if (p.title && !preview.rejected) preview.suggestedTitle = p.title;
  preview.chapters = rebalancePages(preview.chapters, p.targetPages);

  return {
    preview,
    model: usedModel,
    inputTokens,
    outputTokens,
    costUsd: previewCostUsd(usedModel, inputTokens, outputTokens),
  };
}

// ── Abuse limits ────────────────────────────────────────────────────────
// Every LLM call is logged in PreviewLog; limits count rows in the last 24 h.
// Defaults keep the worst case bounded: GLOBAL_DAY × ~$0.03.
const num = (v: string | undefined, d: number) => {
  const n = parseInt(v || "", 10);
  return Number.isFinite(n) && n >= 0 ? n : d;
};
// The per-order cap is not here: an order gets exactly one AI redo
// (Project.previewRedoUsed), like the paid structure (structureRedoUsed).
export const PREVIEW_LIMITS = {
  perUserDay: num(process.env.PREVIEW_PER_USER_DAY, 6),
  perIpDay: num(process.env.PREVIEW_PER_IP_DAY, 10),
  globalDay: num(process.env.PREVIEW_GLOBAL_DAY, 300),
};

export type LimitCode =
  | "PREVIEW_PROJECT_LIMIT"
  | "PREVIEW_USER_LIMIT"
  | "PREVIEW_IP_LIMIT"
  | "PREVIEW_BUSY";

/** Returns the first limit hit, or null. Customers who already paid for a
 *  book skip the per-user/IP caps (never the global one). */
export async function checkPreviewLimits(opts: {
  userId: string;
  ip: string | null;
  isAdmin: boolean;
}): Promise<LimitCode | null> {
  if (opts.isAdmin) return null;
  const since = new Date(Date.now() - 24 * 3600 * 1000);

  const global = await prisma.previewLog.count({
    where: { createdAt: { gte: since } },
  });
  if (global >= PREVIEW_LIMITS.globalDay) return "PREVIEW_BUSY";

  const paid = await prisma.project.count({
    where: { userId: opts.userId, paymentStatus: "PAID" },
  });
  if (paid > 0) return null;

  const byUser = await prisma.previewLog.count({
    where: { userId: opts.userId, createdAt: { gte: since } },
  });
  if (byUser >= PREVIEW_LIMITS.perUserDay) return "PREVIEW_USER_LIMIT";

  if (opts.ip) {
    const byIp = await prisma.previewLog.count({
      where: { ip: opts.ip, createdAt: { gte: since } },
    });
    if (byIp >= PREVIEW_LIMITS.perIpDay) return "PREVIEW_IP_LIMIT";
  }
  return null;
}

/** One preview call per user at a time (double clicks, parallel tabs). */
const inFlight = new Set<string>();
export function acquirePreviewSlot(userId: string): boolean {
  if (inFlight.has(userId)) return false;
  inFlight.add(userId);
  return true;
}
export function releasePreviewSlot(userId: string) {
  inFlight.delete(userId);
}

/** Text block for the full structure prompt (post-payment). */
export function formatPreviewForStructurePrompt(raw: unknown): string {
  const pv = normalizePreview(raw);
  if (!pv || pv.rejected || !pv.chapters.length) return "";
  const edited = (raw as { editedByCustomer?: boolean })?.editedByCustomer;
  return `PREVIEW THE CUSTOMER SAW AND PAID FOR — THIS IS THE CONTRACT${
    edited ? " (the customer edited it themselves — their edits are explicit wishes)" : ""
  }:
Title: ${pv.suggestedTitle}${pv.subtitle ? `\nSubtitle: ${pv.subtitle}` : ""}
${formatPreviewOutline(pv)}

Keep this title (use it as suggestedTitle) and deliver every chapter and section
promise above, in this order. You MAY sharpen wording, rebalance pages, add
sections, and split or merge a chapter when the research clearly calls for it —
but the customer must recognise the book they approved. Never drop a promised
chapter or section topic.`;
}
