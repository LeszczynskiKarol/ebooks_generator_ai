// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BookForge — Author Brief Generator
// One LLM call BEFORE structure generation that decides, per book:
// genre conventions, voice/register, reader address, narrative strategy,
// evidence policy (how claims are grounded) and the visual apparatus.
// The brief is persisted on Project.authorBrief and injected into the
// structure + content prompts, replacing one-size-fits-all rules.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { createLLMClient } from "../lib/llm";
import { prisma } from "../lib/prisma";
import { parseLLMJson, BookBriefSchema, BookBrief } from "../lib/llmJson";

const anthropic = createLLMClient();
const BRIEF_MODEL = "claude-sonnet-4-6";

export type { BookBrief };

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Style preset priors — what the user's preset choice SUGGESTS about
// the prose. A prior, not a cage: the brief call refines it against
// the actual topic and the user's guidelines.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const STYLE_PRESET_PRIORS: Record<string, string> = {
  modern:
    "Contemporary and pragmatic. Direct address, plain language, current examples. " +
    "Leans practical — but the topic decides how data-heavy the prose should be.",
  academic:
    "Precise and methodical. Measured register, careful definitions, structured " +
    "argumentation. Rigor over anecdote; terminology used consistently; claims " +
    "traceable to sources where the material provides them.",
  business:
    "Results-oriented. Concrete outcomes, decisions and trade-offs; comfortable " +
    "with numbers, case studies and frameworks when the topic genuinely supports them.",
  creative:
    "Narrative and essayistic. Vivid scenes, sensory detail, storytelling; ideas " +
    "carried by imagery and example rather than by data apparatus. The reader should " +
    "feel an author's personality on every page.",
  minimal:
    "Spare and calm. Short sentences, no ornament, no hype. Say less, mean more — " +
    "the restraint itself is the style.",
};

export function getStylePresetPrior(preset: string): string {
  return STYLE_PRESET_PRIORS[preset] || STYLE_PRESET_PRIORS.modern;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Brief generation
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface BriefParams {
  topic: string;
  title: string | null;
  language: string;
  stylePreset: string;
  guidelines: string | null;
  targetPages: number;
  bookFormat: string;
  /** Digest of research sources (truncated) — may be empty */
  sourcesDigest: string;
  log?: any;
}

function buildBriefPrompt(p: BriefParams): string {
  return `You are an experienced publishing editor deciding HOW a new book should be written before any word of it exists. Your decisions become the creative contract that the writer must follow for the whole book.

BOOK ORDER:
Topic: ${p.topic}
${p.title ? `Working title: ${p.title}` : ""}
Language of the book: ${p.language}
Length: ~${p.targetPages} pages (${p.bookFormat.toUpperCase()})
Style preset chosen by the customer: "${p.stylePreset}" — meaning: ${getStylePresetPrior(p.stylePreset)}
${p.guidelines ? `CUSTOMER GUIDELINES (these OVERRIDE everything else): ${p.guidelines}` : "Customer guidelines: none."}

${
  p.sourcesDigest
    ? `RESEARCH DIGEST (what real-world material exists on this topic):
${p.sourcesDigest}
`
    : "No web research available — judge the topic on your own expertise."
}

YOUR TASK — decide, for THIS specific book:

1. genre — what kind of book this really is (practical handbook, academic writing guide, cookbook, reflective essay collection, technical tutorial, business playbook, popular science...) and which conventions of that genre the writer must honor.

2. audience — who will actually read it and what they need from it.

3. voice — the author persona and register, 2-4 sentences. Decide this YOURSELF from topic + genre + preset prior + guidelines. A cookbook wants a different author than a thesis-methodology guide. Be specific: temperament, distance, humor or none, opinionated or measured.

4. readerAddress — how the text addresses the reader IN THE BOOK'S LANGUAGE (e.g. for Polish: bezpośrednie "ty", forma bezosobowa, or "Państwo"; for English: direct "you" or neutral). One choice, with a one-line reason.

5. narrativeStrategy — how sections should typically open and flow: scene/anecdote-first? problem-first? data-first? step-by-step? How much storytelling vs. exposition.

6. evidencePolicy — CRITICAL. What grounds a claim in THIS book: hard data and named tools/companies? research findings? worked examples and exercises? recipes and sensory detail? lived scenarios? Say explicitly how dense numeric data should be (e.g. "statistics are central — several per section", "numbers only where they naturally exist, most sections need none", "no statistics — this is a narrative book") and what the writer should reach for INSTEAD when a number would be forced. Never require the writer to invent statistics.

7. visualStrategy — the writer has this fixed LaTeX toolbox: booktabs tables, tipbox (practical tip), keyinsight (takeaway), warningbox (pitfall), examplebox (case study/example), \\stepflow (process diagram), \\concept (term definition box), \\pullquote (large quote), \\bignumber (highlighted statistic — requires a REAL number). Decide which elements fit this book and roughly how often (per chapter), and which to use rarely or NEVER. A data-driven guide can carry 4-6 boxes and 1-2 tables per chapter; a narrative book maybe 1-2 boxes and no tables. Do NOT prescribe identical apparatus for every chapter — give a range and let content decide.

8. numbering — how headings are numbered in THIS book. Pick ONE:
   - "hierarchical": 1. / 1.1. / 1.1.1. — textbooks, technical and academic guides, anything readers cross-reference by number.
   - "chapters": numbered chapters, unnumbered sections — most practical handbooks, self-help, career, parenting, business books.
   - "none": no numbers at all — essays, narrative non-fiction, short lead magnets.
   - "items": numbered chapters PLUS one continuous counter for the individual items the book is made of — cookbooks ("Recipe 52"), craft/pattern books ("Project 7"), workbooks ("Exercise 14"), template collections. Choose this whenever the book is essentially a numbered collection, and ESPECIALLY when the topic/title promises a count ("60 recipes", "20 projects").
   For "items" also give itemLabel — the singular noun for one item IN THE BOOK'S LANGUAGE, capitalized as it will print before the number (Polish: "Przepis", "Projekt", "Ćwiczenie", "Wzór"; English: "Recipe", "Project", "Exercise") — and itemCount: the number promised by the topic/title if there is one, else null.

9. avoid — 3-6 genre-specific traps for this particular book (e.g. for a cookbook: "nutrition statistics forced into every section"; for an academic guide: "startup case studies"; for a narrative book: "bullet-point listicles").

RULES:
- Customer guidelines ALWAYS win over the preset prior and over your own taste.
- The preset prior is a starting point — bend it to the topic where they conflict, and say so in "voice".
- Write ALL values in ENGLISH (this brief is injected into English writing prompts). Only readerAddress may contain words in the book's language.
- Be concrete and directive ("open sections with...", "use...", "never...") — the writer follows this literally.

Respond with RAW JSON ONLY — no markdown fences, no commentary:
{
  "genre": "...",
  "audience": "...",
  "voice": "...",
  "readerAddress": "...",
  "narrativeStrategy": "...",
  "evidencePolicy": "...",
  "visualStrategy": "...",
  "avoid": ["...", "..."],
  "numbering": { "mode": "hierarchical | chapters | none | items", "itemLabel": "... or null", "itemCount": 60, "reason": "one line" }
}`;
}

/**
 * Fallback brief when the LLM call fails — mirrors the platform's historical
 * defaults (practitioner voice, balanced density) so the pipeline never dies.
 */
function fallbackBrief(p: BriefParams): BookBrief {
  return {
    genre: `Practical non-fiction guide on: ${p.topic}`,
    audience: "Readers who bought the book to solve a concrete problem.",
    voice:
      "A confident practitioner sharing hard-won knowledge — direct, concrete, " +
      "willing to take positions. " +
      getStylePresetPrior(p.stylePreset),
    readerAddress:
      p.language === "pl"
        ? 'Direct singular "ty" when giving advice.'
        : 'Direct "you" when giving advice.',
    narrativeStrategy:
      "Open sections with a specific insight or example, not a definition; " +
      "mix exposition with worked examples.",
    evidencePolicy:
      "Ground claims in specific examples and, where the research material " +
      "provides them, real numbers and named tools. Never invent statistics — " +
      "where no number exists, use a concrete scenario instead.",
    visualStrategy:
      "Use 2-4 colored boxes per chapter where the content calls for them " +
      "(keyinsight for takeaways, tipbox for advice, warningbox for pitfalls, " +
      "examplebox for worked examples). Tables only when comparing 3+ real items. " +
      "\\stepflow for genuine processes; \\bignumber only with a real figure from sources.",
    avoid: [
      "identical visual apparatus in every chapter",
      "statistics invented to fill a quota",
    ],
    numbering: {
      mode: "hierarchical",
      itemLabel: null,
      itemCount: null,
      reason: "fallback brief — platform default",
    },
  };
}

/**
 * Generate the author brief with one LLM call. Falls back to a sensible
 * default on any failure — brief generation must never block the pipeline.
 */
export async function generateAuthorBrief(p: BriefParams): Promise<BookBrief> {
  const prompt = buildBriefPrompt(p);
  try {
    p.log?.step?.("Generating author brief (genre/voice/evidence/visuals)...");
    p.log?.claudeReq?.("brief", prompt.substring(0, 300) + "...");

    const response = await anthropic.messages.create({
      model: BRIEF_MODEL,
      // 2026-07: 1500 truncated a real brief mid-"avoid" (verbose briefs run
      // ~2k tokens); repair salvaged it but lost content — keep headroom.
      max_tokens: 3000,
      temperature: 0.7,
      messages: [{ role: "user", content: prompt }],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";
    p.log?.claudeRes?.("brief", text);
    p.log?.api?.(
      BRIEF_MODEL,
      response.usage?.input_tokens || 0,
      response.usage?.output_tokens || 0,
    );

    const parsed = parseLLMJson(text, BookBriefSchema);
    if (!parsed.ok) throw new Error(parsed.error);

    p.log?.ok?.(
      `Author brief: genre="${parsed.data.genre.substring(0, 60)}..."`,
    );
    return parsed.data;
  } catch (err: any) {
    p.log?.warn?.(
      `Author brief generation failed (${err.message}) — using fallback brief`,
    );
    return fallbackBrief(p);
  }
}

/**
 * Load the persisted brief for a project, or generate + persist it.
 * Used by both structureGenerator (creates it) and contentGenerator
 * (safety net for projects whose structure predates the brief feature).
 */
export async function getOrCreateAuthorBrief(
  project: {
    id: string;
    topic: string;
    title: string | null;
    language: string;
    stylePreset: string;
    guidelines: string | null;
    targetPages: number;
    bookFormat: string;
    authorBrief?: string | null;
  },
  sourcesDigest: string,
  log?: any,
): Promise<BookBrief> {
  if (project.authorBrief) {
    const parsed = parseLLMJson(project.authorBrief, BookBriefSchema);
    if (parsed.ok) {
      log?.step?.("Author brief loaded from project");
      return parsed.data;
    }
    log?.warn?.("Stored author brief invalid — regenerating");
  }

  const brief = await generateAuthorBrief({
    topic: project.topic,
    title: project.title,
    language: project.language,
    stylePreset: project.stylePreset,
    guidelines: project.guidelines,
    targetPages: project.targetPages,
    bookFormat: project.bookFormat,
    sourcesDigest,
    log,
  });

  await prisma.project.update({
    where: { id: project.id },
    data: { authorBrief: JSON.stringify(brief) },
  });
  log?.ok?.("Author brief saved to project");
  return brief;
}

/**
 * Render the brief as a prompt block shared by the structure and content
 * generators. Kept compact — the brief steers, the hard rules still live
 * in the calling prompts.
 */
export function formatBriefForPrompt(brief: BookBrief): string {
  const avoid =
    brief.avoid && brief.avoid.length > 0
      ? `\nGENRE-SPECIFIC TRAPS TO AVOID:\n${brief.avoid.map((a) => `- ${a}`).join("\n")}`
      : "";

  return `═══════════════════════════════════════════════════════════════
AUTHOR BRIEF — THE CREATIVE CONTRACT FOR THIS BOOK
(decided for this specific book; follow it over any generic habit)
═══════════════════════════════════════════════════════════════
GENRE & CONVENTIONS: ${brief.genre}
AUDIENCE: ${brief.audience}
VOICE: ${brief.voice}
READER ADDRESS: ${brief.readerAddress}
NARRATIVE STRATEGY: ${brief.narrativeStrategy}
EVIDENCE POLICY (what grounds a claim in THIS book): ${brief.evidencePolicy}
VISUAL APPARATUS (which elements fit THIS book): ${brief.visualStrategy}${avoid}
═══════════════════════════════════════════════════════════════`;
}
