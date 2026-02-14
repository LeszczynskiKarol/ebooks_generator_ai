// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BookForge — Content Generator v3
// Full previous chapters context for style consistency
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "../lib/prisma";
import { getWordsPerPage } from "../lib/types";
import { createPipelineLogger } from "../lib/logger";
import {
  loadResearch,
  conductChapterResearch,
  mergeResearchForPrompt,
  ChapterResearchResult,
} from "./researchService";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface ChapterStructure {
  id: string;
  number: number;
  title: string;
  description: string;
  targetPages: number;
  sections: {
    id: string;
    title: string;
    description: string;
    targetPages: number;
  }[];
}

interface PromptLog {
  step: string;
  role: "system" | "user" | "continuation";
  content: string;
  timestamp: string;
}

interface ResponseLog {
  step: string;
  content: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
  timestamp: string;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Main entry
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function generateContent(projectId: string) {
  const log = createPipelineLogger("CONTENT", projectId);

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { structure: true },
  });
  if (!project || !project.structure)
    throw new Error("Project or structure not found");

  const structureData = JSON.parse(project.structure.structureJson);
  const chapters: ChapterStructure[] = structureData.chapters;
  const bookTitle =
    structureData.suggestedTitle || project.title || project.topic;
  const wpp = getWordsPerPage(project.bookFormat);

  log.header("Content Generation Pipeline", {
    Book: bookTitle,
    Topic: project.topic,
    Chapters: chapters.length,
    Pages: `${project.targetPages} (${project.bookFormat.toUpperCase()})`,
    "Words/page": wpp,
    Language: project.language,
    Style: project.stylePreset,
  });

  // ── Phase 1: Load global research ──
  log.phase(1, "Load Global Research Data");
  const globalResearch = await loadResearch(projectId);
  const hasGlobalResearch =
    !!globalResearch && globalResearch.selectedSources.length > 0;

  if (hasGlobalResearch) {
    log.ok(
      `Global research: ${globalResearch!.selectedSources.length} sources, ${globalResearch!.totalSourcesLength.toLocaleString()} chars`,
    );
  } else {
    log.warn("No global research data available");
  }

  // ── Phase 2: Per-chapter research ──
  log.phase(2, "Per-Chapter Research");

  const globalUrls = new Set<string>(
    globalResearch?.selectedSources.map((s) => s.url) || [],
  );

  const chapterResearchMap = new Map<number, ChapterResearchResult>();

  for (const chapter of chapters) {
    log.step(
      `\n  🔍 Ch.${chapter.number}: "${chapter.title}" — researching...`,
    );
    const chTimer = log.timer();

    const chapterResearch = await conductChapterResearch(
      projectId,
      {
        number: chapter.number,
        title: chapter.title,
        description: chapter.description,
        sections: chapter.sections,
      },
      globalUrls,
      project.language,
      project.topic,
      log,
    );

    chapterResearchMap.set(chapter.number, chapterResearch);
    log.ok(
      `  Ch.${chapter.number}: ${chapterResearch.selectedSources.length} sources, ${chapterResearch.totalSourcesLength.toLocaleString()} chars (${chTimer()})`,
    );
  }

  const totalChapterSources = Array.from(chapterResearchMap.values()).reduce(
    (sum, r) => sum + r.selectedSources.length,
    0,
  );
  log.data(
    "Per-chapter research total",
    `${totalChapterSources} sources across ${chapters.length} chapters`,
  );

  // ── Phase 3: Create chapter records ──
  log.phase(3, "Initialize Chapter Records");
  for (const ch of chapters) {
    await prisma.chapter.upsert({
      where: {
        projectId_chapterNumber: { projectId, chapterNumber: ch.number },
      },
      create: {
        projectId,
        chapterNumber: ch.number,
        title: ch.title,
        targetPages: ch.targetPages,
        targetWords: ch.targetPages * wpp,
        status: "PENDING",
      },
      update: {
        title: ch.title,
        targetPages: ch.targetPages,
        targetWords: ch.targetPages * wpp,
        status: "PENDING",
        latexContent: null,
        writerPrompts: null,
        writerResponses: null,
      },
    });
    const chResearch = chapterResearchMap.get(ch.number);
    log.step(
      `  Ch.${ch.number}: "${ch.title}" — ${ch.targetPages}p, ~${ch.targetPages * wpp}w, ${ch.sections.length} sections, ${chResearch?.selectedSources.length || 0} dedicated sources`,
    );
  }

  await prisma.project.update({
    where: { id: projectId },
    data: {
      generationStatus: "GENERATING_CONTENT",
      currentStage: "GENERATING",
      generationProgress: 0,
    },
  });
  log.ok(
    `${chapters.length} chapters initialized, status → GENERATING_CONTENT`,
  );

  // ── Phase 4: Generate chapters ──
  log.phase(4, "Generate Chapter Content");
  const previousSummaries: string[] = [];
  const previousChaptersContent: {
    number: number;
    title: string;
    latex: string;
  }[] = [];
  let totalTokens = 0;

  for (let i = 0; i < chapters.length; i++) {
    const chapter = chapters[i];
    const rec = await prisma.chapter.findUnique({
      where: {
        projectId_chapterNumber: { projectId, chapterNumber: chapter.number },
      },
    });
    if (!rec) continue;

    const targetWords = chapter.targetPages * wpp;
    log.step(
      `\n  ✍️  Ch ${chapter.number}/${chapters.length}: "${chapter.title}"`,
    );
    log.data(
      "Target",
      `${chapter.targetPages} pages × ${wpp} wpp = ${targetWords} words`,
    );
    log.data("Sections", chapter.sections.map((s) => s.title).join(" | "));

    // Merge global + chapter-specific research for THIS chapter
    const chapterResearch = chapterResearchMap.get(chapter.number) || null;
    const { text: mergedSourcesText, hasResearch } = mergeResearchForPrompt(
      globalResearch,
      chapterResearch,
      20000,
    );
    log.data(
      "Research for this chapter",
      `${chapterResearch?.selectedSources.length || 0} chapter-specific + ${globalResearch?.selectedSources.length || 0} global → ${mergedSourcesText.length.toLocaleString()} chars in prompt`,
    );

    // Log previous chapters context
    const prevContentChars = previousChaptersContent.reduce(
      (sum, c) => sum + c.latex.length,
      0,
    );
    log.data(
      "Previous chapters context",
      previousChaptersContent.length > 0
        ? `${previousChaptersContent.length} chapters, ${prevContentChars.toLocaleString()} chars (full text)`
        : "none (first chapter)",
    );

    await prisma.chapter.update({
      where: { id: rec.id },
      data: { status: "GENERATING" },
    });

    try {
      const chTimer = log.timer();
      const result = await generateChapterLatex({
        bookTitle,
        bookTopic: project.topic,
        language: project.language,
        stylePreset: project.stylePreset,
        guidelines: project.guidelines || "",
        bookFormat: project.bookFormat,
        chapter,
        chapterIndex: i,
        totalChapters: chapters.length,
        previousSummaries,
        previousChaptersContent,
        allChapters: chapters,
        sourcesText: mergedSourcesText,
        hasResearch,
        wpp,
        log,
      });

      totalTokens += result.tokensUsed;
      previousSummaries.push(
        `Ch${chapter.number} "${chapter.title}": ${result.summary}`,
      );

      // ★ Store FULL content for subsequent chapters
      previousChaptersContent.push({
        number: chapter.number,
        title: chapter.title,
        latex: result.latexContent,
      });

      const wordCount = result.latexContent
        .replace(/\\[a-zA-Z]+(\{[^}]*\})?/g, "")
        .split(/\s+/).length;
      const pageEstimate = Math.round(wordCount / wpp);

      await prisma.chapter.update({
        where: { id: rec.id },
        data: {
          latexContent: result.latexContent,
          actualWords: wordCount,
          actualPages: wordCount / wpp,
          status: "LATEX_READY",
          writerPrompts: JSON.stringify(result.prompts),
          writerResponses: JSON.stringify(result.responses),
        },
      });

      await prisma.project.update({
        where: { id: projectId },
        data: { generationProgress: (i + 1) / chapters.length },
      });

      const accuracy = Math.round((wordCount / targetWords) * 100);
      log.ok(
        `Ch ${chapter.number} DONE — ${wordCount}w (~${pageEstimate}p) [${accuracy}% of target] ${result.tokensUsed} tokens (${chTimer()})`,
      );
      if (accuracy < 80)
        log.warn(`  ⚠️  Chapter significantly SHORT: ${accuracy}% of target`);
      if (accuracy > 120)
        log.warn(`  ⚠️  Chapter significantly LONG: ${accuracy}% of target`);
    } catch (error: any) {
      log.err(`Ch ${chapter.number} FAILED`, error);
      await prisma.chapter.update({
        where: { id: rec.id },
        data: { status: "ERROR" },
      });
      previousSummaries.push(`Ch${chapter.number}: [generation failed]`);
      // Push placeholder so subsequent chapters know this one exists but failed
      previousChaptersContent.push({
        number: chapter.number,
        title: chapter.title,
        latex: `% Chapter ${chapter.number} "${chapter.title}" — generation failed, content unavailable`,
      });
    }
  }

  // ── Phase 5: Finalize ──
  log.phase(5, "Compilation");
  const estimatedCost = (totalTokens / 1_000_000) * 3;
  await prisma.project.update({
    where: { id: projectId },
    data: {
      generationStatus: "CONTENT_READY",
      currentStage: "COMPILING",
      generationProgress: 1,
      totalTokensUsed: totalTokens,
      totalCostUsd: estimatedCost,
    },
  });

  log.data("Total tokens", totalTokens.toLocaleString());
  log.data("Estimated cost", `$${estimatedCost.toFixed(4)}`);
  log.step("Starting PDF compilation...");

  const { compileBook } = await import("./bookCompiler");
  await compileBook(projectId);

  log.footer(
    "SUCCESS",
    `${chapters.length} chapters, ${totalTokens.toLocaleString()} tokens, ~$${estimatedCost.toFixed(4)}`,
  );
  return { totalTokens, estimatedCost };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Token budget: previous chapters context
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Build the previous chapters context block with smart budget management.
 *
 * Token math (Sonnet 4.5 = 200k context):
 *   System prompt + research:  ~50-60k tokens (~200-240k chars)
 *   User prompt:               ~2-3k tokens  (~8-12k chars)
 *   Output (max_tokens):       ~6-32k tokens
 *   Available for prev chapters: ~100-140k tokens (~400-560k chars)
 *
 * One chapter ≈ 1500 words ≈ 2500 tokens ≈ 10k chars (LaTeX).
 * Even 10 chapters (Complete tier) = ~25k tokens = fits easily.
 *
 * Safety fallback: if total chars exceed maxChars, keep recent chapters
 * in full and summarize older ones (most relevant for style matching).
 */
function buildPreviousChaptersContext(
  previousChapters: { number: number; title: string; latex: string }[],
  previousSummaries: string[],
  maxChars: number = 400000, // ~100k tokens — safe limit
): string {
  if (previousChapters.length === 0) return "";

  const totalChars = previousChapters.reduce(
    (sum, c) => sum + c.latex.length,
    0,
  );

  // ── Case 1: Everything fits (vast majority of books) ──
  if (totalChars <= maxChars) {
    const chaptersBlock = previousChapters
      .map(
        (c) => `
╔══════════════════════════════════════════════════════════════╗
║  CHAPTER ${c.number}: "${c.title}" (ALREADY WRITTEN)
╚══════════════════════════════════════════════════════════════╝

${c.latex}

═══ END OF CHAPTER ${c.number} ═══`,
      )
      .join("\n\n");

    return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
YOUR PREVIOUSLY WRITTEN CHAPTERS (${previousChapters.length} chapters — FULL TEXT)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

YOU wrote these chapters earlier in this same book. This is YOUR voice, YOUR style.

CRITICAL — use the full text below to:
1. MATCH your writing style EXACTLY — same sentence rhythm, same level of directness,
   same way you open sections, same way you use data and examples
2. NEVER repeat examples, statistics, case studies, or arguments already covered
3. BUILD on concepts you introduced — reference them naturally ("As we saw in Chapter X...")
4. MAINTAIN terminology consistency — use the same terms for the same concepts
5. ENSURE narrative flow — the reader will read these chapters in sequence

${chaptersBlock}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
  }

  // ── Case 2: Doesn't fit — keep recent in full, summarize older ──
  let usedChars = 0;
  const fullChapters: typeof previousChapters = [];
  const summarizedChapters: {
    number: number;
    title: string;
    summary: string;
  }[] = [];

  const fullBudget = Math.floor(maxChars * 0.85);

  // Add from most recent backwards (most important for style matching)
  for (let i = previousChapters.length - 1; i >= 0; i--) {
    const ch = previousChapters[i];
    if (usedChars + ch.latex.length <= fullBudget) {
      fullChapters.unshift(ch);
      usedChars += ch.latex.length;
    } else {
      summarizedChapters.unshift({
        number: ch.number,
        title: ch.title,
        summary: previousSummaries[i] || `Chapter ${ch.number}: ${ch.title}`,
      });
    }
  }

  let block = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
YOUR PREVIOUSLY WRITTEN CHAPTERS (${previousChapters.length} total: ${summarizedChapters.length} summarized + ${fullChapters.length} full text)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

MATCH your writing style exactly. NEVER repeat covered material.

`;

  if (summarizedChapters.length > 0) {
    block += `── EARLIER CHAPTERS (summaries only — avoid repeating their content) ──\n\n`;
    for (const ch of summarizedChapters) {
      block += `  Ch.${ch.number} "${ch.title}": ${ch.summary}\n`;
    }
    block += `\n── RECENT CHAPTERS (full text — match this style precisely) ──\n`;
  }

  for (const c of fullChapters) {
    block += `
╔══════════════════════════════════════════════════════════════╗
║  CHAPTER ${c.number}: "${c.title}" (ALREADY WRITTEN)
╚══════════════════════════════════════════════════════════════╝

${c.latex}

═══ END OF CHAPTER ${c.number} ═══
`;
  }

  block += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

  return block;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Generate single chapter
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface GenParams {
  bookTitle: string;
  bookTopic: string;
  language: string;
  stylePreset: string;
  guidelines: string;
  bookFormat: string;
  chapter: ChapterStructure;
  chapterIndex: number;
  totalChapters: number;
  previousSummaries: string[];
  previousChaptersContent: {
    number: number;
    title: string;
    latex: string;
  }[];
  allChapters: ChapterStructure[];
  sourcesText: string;
  hasResearch: boolean;
  wpp: number;
  log: any;
}

async function generateChapterLatex(p: GenParams): Promise<{
  latexContent: string;
  tokensUsed: number;
  summary: string;
  prompts: PromptLog[];
  responses: ResponseLog[];
}> {
  const targetWords = p.chapter.targetPages * p.wpp;
  const lang = getLangName(p.language);
  const prompts: PromptLog[] = [];
  const responses: ResponseLog[] = [];
  const model = "claude-sonnet-4-5-20250929";
  const isLastChapter = p.chapterIndex === p.totalChapters - 1;
  const hasPreviousChapters = p.previousChaptersContent.length > 0;

  const sectionsOutline = p.chapter.sections
    .map(
      (s, i) =>
        `  ${i + 1}. "${s.title}" — ${s.description} (~${s.targetPages * p.wpp} words)`,
    )
    .join("\n");

  const toc = p.allChapters
    .map(
      (c) =>
        `  ${c.number === p.chapter.number ? "→" : " "} Ch.${c.number}: ${c.title}`,
    )
    .join("\n");

  // ── Build previous chapters context (full text) ──
  const previousChaptersBlock = buildPreviousChaptersContext(
    p.previousChaptersContent,
    p.previousSummaries,
  );

  // ━━━ System prompt ━━━
  const systemPrompt = `You are a seasoned subject-matter expert and published author writing a professional book chapter. You write like a human expert — not like an AI.

BOOK CONTEXT:
Book: "${p.bookTitle}" | Topic: ${p.bookTopic} | Language: ${lang} | Style: ${p.stylePreset}
Format: ${p.bookFormat.toUpperCase()} (~${p.wpp} words/page with onehalfspacing)
${p.guidelines ? `Author guidelines: ${p.guidelines}` : ""}

${
  p.hasResearch
    ? `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RESEARCH SOURCES — YOUR PRIMARY KNOWLEDGE BASE FOR THIS CHAPTER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${p.sourcesText}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HOW TO USE SOURCES:
- PRIORITIZE ★ CHAPTER-SPECIFIC sources — they were found specifically for this chapter
- Extract SPECIFIC facts: names, numbers, dates, percentages, tool names, pricing
- Build arguments AROUND source data — don't just mention it, ANALYZE it
- Contrast different sources when they disagree
- Cite companies, products, regulations BY NAME with specifics
- DO NOT copy verbatim — synthesize, compare, and add your expert interpretation
- Book-level sources provide broader context; chapter-specific sources drive the core content
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`
    : ""
}
${previousChaptersBlock}

═══════════════════════════════════════════════════════════════
WRITING QUALITY RULES — READ CAREFULLY
═══════════════════════════════════════════════════════════════

VOICE & TONE:
- Write as a confident practitioner sharing hard-won knowledge, NOT as a lecturer
- Use direct, concise sentences. Prefer "X does Y" over "It is worth noting that X has the capability to do Y"
- Vary sentence length: mix short punchy statements with longer analytical ones
- Address the reader directly with "you" when giving advice
- Show opinions and take positions — experts have viewpoints, not just summaries${
    hasPreviousChapters
      ? `
- CRITICAL: You have your previously written chapters above. Match that EXACT writing style.
  Same sentence rhythm. Same level of directness. Same way you use examples.
  The reader must not detect any style shift between chapters.`
      : ""
  }

BANNED PATTERNS — NEVER use these AI-typical phrases:
- "In today's rapidly evolving..." / "In the dynamic world of..."
- "It's worth noting that..." / "It's important to understand..."
- "Let's dive into..." / "Let's explore..."
- "In conclusion..." / "To summarize..."
- "Whether you're a... or a..." / "From X to Y..."
- "Game-changer" / "revolutionary" / "transformative" / "cutting-edge"
- "Powerful tool" / "robust solution" / "comprehensive approach"
- "Navigate the complexities" / "unlock the potential" / "harness the power"
- "Fascinating" / "remarkable" / "dramatic" / "crucial" / "essential" (overuse)
- "Landscape" (when describing an industry) / "paradigm shift" / "at the forefront"
- "Delve into" / "realm of" / "tapestry of"
- Starting paragraphs with "Furthermore" / "Moreover" / "Additionally" — vary transitions
- "W dzisiejszym dynamicznie zmieniającym się świecie" / "Nie jest tajemnicą, że"
- "Warto zauważyć" / "Należy podkreślić" / "szeroki wybór" / "najwyższa jakość"

CONTENT DEPTH — what separates expert content from filler:
- Every claim must have a SPECIFIC example, number, or case study backing it
- BAD: "AI can significantly improve productivity" → GOOD: "Teams using Cursor report 40% faster code reviews, with junior developers seeing the biggest gains"
- BAD: "Many companies are adopting AI" → GOOD: "Shopify cut its workforce by 20% in 2023, with CEO Tobi Lütke stating AI would replace roles, not just assist them"
- When listing tools/methods: include PRICING, LIMITATIONS, and WHEN NOT to use them
- Minimum 3 concrete data points per section (numbers, percentages, company names, dates)
- When describing a process, include a realistic scenario with specific numbers

STRUCTURE WITHIN SECTIONS:
- Open each section with a specific insight, stat, or contrarian take — NOT a definition
- Close each section with a practical takeaway or decision framework
- Use \\begin{itemize} sparingly — prefer flowing prose with embedded specifics
- NEVER pad content with long lists of example prompts, templates, or filler

ANTI-FILLER RULES:
- Every paragraph must contain at least one SPECIFIC fact, number, or named example
- Do NOT write "There are many tools available" — instead, compare their trade-offs
- Do NOT repeat the same point in different words across paragraphs
- Information density: a reader should learn something new in every paragraph${
    hasPreviousChapters
      ? `
- NEVER repeat data points, examples, or arguments from your previous chapters.
  The reader has already absorbed that content. Reference it naturally instead:
  "As discussed in Chapter X..." or "Building on the framework from Chapter X..."`
      : ""
  }

═══════════════════════════════════════════════════════════════

LATEX OUTPUT RULES:
- Output ONLY the chapter body — NO preamble, NO \\documentclass, NO \\begin{document}
- Start with \\chapter{${p.chapter.title}}
- Use \\section{} for main sections, \\subsection{} for subsections
- Use \\textbf{}, \\textit{}, \\emph{} for emphasis (sparingly)
- Use \\begin{itemize}/\\begin{enumerate} for lists (max 1-2 per section)
- Use \\begin{quote} for notable quotes, \\footnote{} for asides
- Escape special chars: \\%, \\&, \\#, \\$, \\_, \\{, \\}
- Use --- for em-dash, -- for en-dash
- NO undefined custom commands, NO \\usepackage
- ALL text in ${lang}
- NEVER leave a section or sentence unfinished — complete every thought`;

  // ━━━ User prompt ━━━
  let userPrompt = `Write Chapter ${p.chapter.number}/${p.totalChapters}: "${p.chapter.title}"
Description: ${p.chapter.description}

SECTIONS TO WRITE:
${sectionsOutline}

FULL BOOK TABLE OF CONTENTS (for context — maintain coherent narrative):
${toc}

WORD COUNT TARGET: ${targetWords} words (±10%) = ${p.chapter.targetPages} pages in ${p.bookFormat.toUpperCase()} @ ${p.wpp} words/page.
⚠️ Hard limits: minimum ${Math.round(targetWords * 0.85)} words, maximum ${Math.round(targetWords * 1.15)} words.
⚠️ COMPLETE every section and sentence. NEVER stop mid-sentence or leave a section unfinished.

QUALITY CHECKLIST — verify before finishing:
□ Does every section open with a specific fact/insight (not a definition)?
□ Are there 3+ concrete data points per section?
□ Did you avoid ALL banned AI phrases from the system prompt?
□ Is there at least one real company/product name per section?
□ Did you avoid long lists of examples/templates that pad word count?
□ Does the chapter read like it was written by a human expert with opinions?`;

  // ── Continuity instruction for chapters 2+ ──
  if (hasPreviousChapters) {
    const lastChNum =
      p.previousChaptersContent[p.previousChaptersContent.length - 1].number;
    userPrompt += `

⚠️ CONTINUITY — your previous ${p.previousChaptersContent.length} chapter(s) are in the system prompt above:
- Match your established writing style EXACTLY — the reader must feel one consistent author
- Transition naturally from Chapter ${lastChNum} — don't repeat its closing points
- Reference earlier chapters when building on concepts: "As we discussed in Chapter ${lastChNum}..."
- Do NOT reuse any examples, statistics, or case studies from previous chapters
- Maintain the same terminology — if you called something "X" before, call it "X" again`;
  }

  // ── Last chapter closing instruction ──
  if (isLastChapter) {
    userPrompt += `

⚠️ THIS IS THE FINAL CHAPTER OF THE BOOK. You MUST:
- Write a proper conclusion section at the end (\\section{...})
- Summarize key takeaways from the ENTIRE book (reference earlier chapters by name)
- End with a concrete call-to-action or forward-looking statement for the reader
- The last paragraph should feel like a deliberate, satisfying ending — NOT a cutoff
- Do NOT end with a generic "the future is bright" statement — end with something actionable and specific`;
  }

  userPrompt += `\n\nBegin LaTeX output now. Start with \\chapter{${p.chapter.title}}. Write exactly ${targetWords} words (±10%), entirely in ${lang}. Remember: expert voice, concrete data, no AI filler.`;

  // ── Logging ──
  const ts = () => new Date().toISOString();
  prompts.push({
    step: "main",
    role: "system",
    content: systemPrompt,
    timestamp: ts(),
  });
  prompts.push({
    step: "main",
    role: "user",
    content: userPrompt,
    timestamp: ts(),
  });

  p.log.data("System prompt", `${systemPrompt.length.toLocaleString()} chars`);
  p.log.data("User prompt", `${userPrompt.length.toLocaleString()} chars`);
  p.log.data("Research in prompt", p.hasResearch ? "YES" : "NO");
  p.log.data(
    "Previous chapters in context",
    hasPreviousChapters
      ? `${p.previousChaptersContent.length} chapters (full text, ${previousChaptersBlock.length.toLocaleString()} chars)`
      : "none (first chapter)",
  );
  p.log.data(
    "Is last chapter",
    isLastChapter ? "YES — closing instructions added" : "NO",
  );

  // Increased from original: min 6000 (was 4096), multiplier 3.0 (was 2.5)
  const maxTok = Math.max(6000, Math.min(32000, Math.ceil(targetWords * 3.0)));
  p.log.step(`Calling Claude API (max_tokens: ${maxTok})...`);

  // ── Main API call ──
  const apiTimer = p.log.timer();
  p.log.claudeReq?.(
    "chapter-main",
    `[system: ${systemPrompt.length} chars] ${userPrompt}`,
  );
  const res = await anthropic.messages.create({
    model,
    max_tokens: maxTok,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  let latex = "";
  let tokens = (res.usage?.input_tokens || 0) + (res.usage?.output_tokens || 0);
  for (const b of res.content) {
    if (b.type === "text") latex += b.text;
  }
  latex = cleanLatex(latex);
  latex = deAIfy(latex, p.language);

  p.log.claudeRes?.("chapter-main", latex);
  p.log.api(model, res.usage?.input_tokens || 0, res.usage?.output_tokens || 0);
  p.log.ok(
    `Main response: ${latex.length.toLocaleString()} chars (${apiTimer()})`,
  );

  responses.push({
    step: "main",
    content: latex,
    inputTokens: res.usage?.input_tokens || 0,
    outputTokens: res.usage?.output_tokens || 0,
    model,
    timestamp: ts(),
  });

  // ── Continuation if too short or incomplete ──
  const wc = latex.replace(/\\[a-zA-Z]+(\{[^}]*\})?/g, "").split(/\s+/).length;
  const endsCleanly = /[.!?…"]\s*$/.test(
    latex.replace(/\\[a-zA-Z]+(\{[^}]*\})?/g, "").trim(),
  );

  p.log.data(
    "Word count (main)",
    `${wc}/${targetWords} (${Math.round((wc / targetWords) * 100)}%)`,
  );
  p.log.data("Ends cleanly", endsCleanly ? "YES" : "NO — will continue");

  if ((wc < targetWords * 0.85 || !endsCleanly) && p.chapter.targetPages > 2) {
    p.log.warn(
      `Needs continuation: ${wc}/${targetWords} words, endsCleanly=${endsCleanly}`,
    );

    const remainingWords = targetWords - wc;
    const maxTotalWords = Math.round(targetWords * 1.15);

    const contPrompt = `You wrote ${wc} of ${targetWords} target words. Continue writing the remaining ~${remainingWords} words.

RULES FOR CONTINUATION:
- Pick up EXACTLY where you left off — do NOT repeat any content
- Maintain the same expert voice and quality level
- Add NEW data points, examples, and analysis — don't pad with filler
- Complete any unfinished sections from the outline
- COMPLETE every sentence — never stop mid-thought
- Output only LaTeX body (no preamble). All text in ${lang}.
- Remember: banned AI phrases still apply. Write like a human expert.
- ⚠️ STOP writing at approximately ${remainingWords} additional words. Do NOT exceed ${maxTotalWords} total words for the chapter.${
      isLastChapter
        ? "\n- THIS IS THE FINAL CHAPTER — make sure it ends with a proper conclusion for the whole book."
        : ""
    }`;

    prompts.push({
      step: "continuation",
      role: "continuation",
      content: contPrompt,
      timestamp: ts(),
    });

    const contTimer = p.log.timer();
    p.log.claudeReq?.("chapter-cont", contPrompt);
    const cont = await anthropic.messages.create({
      model,
      max_tokens: maxTok,
      system: systemPrompt,
      messages: [
        { role: "user", content: userPrompt },
        { role: "assistant", content: latex },
        { role: "user", content: contPrompt },
      ],
    });

    let contLatex = "";
    for (const b of cont.content) {
      if (b.type === "text") contLatex += b.text;
    }
    contLatex = cleanLatex(contLatex);
    contLatex = deAIfy(contLatex, p.language);
    p.log.claudeRes?.("chapter-cont", contLatex);
    latex += "\n\n" + contLatex;
    tokens +=
      (cont.usage?.input_tokens || 0) + (cont.usage?.output_tokens || 0);

    const contWc = contLatex
      .replace(/\\[a-zA-Z]+(\{[^}]*\})?/g, "")
      .split(/\s+/).length;
    p.log.api(
      model,
      cont.usage?.input_tokens || 0,
      cont.usage?.output_tokens || 0,
    );
    p.log.ok(`Continuation: +${contWc} words (${contTimer()})`);
    p.log.data("Total word count", `${wc + contWc}/${targetWords}`);

    responses.push({
      step: "continuation",
      content: contLatex,
      inputTokens: cont.usage?.input_tokens || 0,
      outputTokens: cont.usage?.output_tokens || 0,
      model,
      timestamp: ts(),
    });
  }

  // ── Summary (for logging + fallback if budget exceeded in future chapters) ──
  const summary = await chapterSummary(latex, p.language, p.log);
  p.log.step(`Summary: ${summary.substring(0, 100)}...`);

  return {
    latexContent: latex,
    tokensUsed: tokens,
    summary,
    prompts,
    responses,
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Post-processing: remove AI-typical patterns
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function deAIfy(latex: string, language: string): string {
  const universal: [RegExp, string][] = [
    [/^(Furthermore|Moreover|Additionally),?\s*/gm, ""],
    [/^(In conclusion|To summarize|In summary),?\s*/gm, ""],
    [/It(?:'s| is) worth noting that\s*/gi, ""],
    [/It(?:'s| is) important to (?:understand|note|recognize) that\s*/gi, ""],
    [/Let(?:'s| us) (?:dive into|explore|delve into)\s*/gi, ""],
    [/In today's rapidly (?:evolving|changing)\s*/gi, ""],
    [/In the dynamic world of\s*/gi, ""],
    [/\bgame[- ]changer\b/gi, "significant shift"],
    [/\bcutting[- ]edge\b/gi, "advanced"],
    [/\bparadigm shift\b/gi, "fundamental change"],
    [/ {2,}/g, " "],
  ];

  const polish: [RegExp, string][] = [
    [/W dzisiejszym dynamicznie zmieniaj[aą]cym si[eę] [śs]wiecie\s*/g, ""],
    [/W erze cyfrowej transformacji\s*/g, ""],
    [/Nie jest tajemnic[aą],?\s*[żz]e\s*/gi, ""],
    [/Warto zauwa[żz]y[ćc],?\s*[żz]e\s*/gi, ""],
    [/Nale[żz]y podkre[śs]li[ćc],?\s*[żz]e\s*/gi, ""],
    [/Jest to niezwykle istotne/gi, "To istotne"],
    [/Co wi[ęe]cej,?\s*/g, ""],
    [/Ponadto,?\s*/g, ""],
    [/Podsumowuj[aą]c,?\s*/g, ""],
    [/szeroki wybór/gi, "wybór"],
    [/najwy[żz]sz(a|ej) jako[śs]ci/gi, "wysok$1 jakości"],
    [/idealne rozwi[aą]zanie/gi, "dobre rozwiązanie"],
  ];

  for (const [pattern, replacement] of universal) {
    latex = latex.replace(pattern, replacement);
  }

  if (language === "pl") {
    for (const [pattern, replacement] of polish) {
      latex = latex.replace(pattern, replacement);
    }
  }

  latex = latex.replace(/^\s*\n\s*\n\s*\n/gm, "\n\n");
  return latex;
}

// ━━━ Helpers ━━━

function cleanLatex(text: string): string {
  text = text
    .replace(/^```(?:latex|tex)?\s*\n?/gm, "")
    .replace(/\n?```\s*$/gm, "");
  text = text.replace(/\\documentclass[^]*?\\begin\{document\}/g, "");
  text = text.replace(/\\end\{document\}/g, "");
  text = text.replace(/\\usepackage(\[[^\]]*\])?\{[^}]*\}/g, "");
  return text.trim();
}

async function chapterSummary(
  content: string,
  lang: string,
  log?: any,
): Promise<string> {
  try {
    const plain = content
      .replace(/\\[a-zA-Z]+(\[[^\]]*\])?(\{[^}]*\})?/g, " ")
      .replace(/[{}]/g, "")
      .slice(0, 3000);
    const prompt = `2-sentence summary in ${getLangName(lang)}:\n\n${plain}`;
    log?.claudeReq?.("summary", prompt);
    const r = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 200,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });
    for (const b of r.content) {
      if (b.type === "text") {
        log?.claudeRes?.("summary", b.text);
        return b.text;
      }
    }
    return "Done.";
  } catch {
    return "Done.";
  }
}

function getLangName(c: string): string {
  return (
    (
      {
        en: "English",
        pl: "Polish",
        de: "German",
        es: "Spanish",
        fr: "French",
        it: "Italian",
        pt: "Portuguese",
        nl: "Dutch",
      } as Record<string, string>
    )[c] || "English"
  );
}
