// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BookForge — Content Generator v4.1
// Rich typography: tcolorbox environments, booktabs tables
// Full previous chapters context for style consistency
// + LaTeX sanitization to prevent compilation failures
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import Anthropic from "@anthropic-ai/sdk";
import { reviewAndReviseBook } from "./reviewService";
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
const UTILITY_MODEL = "claude-haiku-4-5";

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

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Content Registry — extracted once per chapter, cached
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface ChapterRegistry {
  chapterNumber: number;
  chapterTitle: string;
  /** 2-3 sentence summary */
  summary: string;
  /** Specific examples, case studies, company names used */
  usedExamples: string[];
  /** Statistics and numbers cited (e.g. "47% studentów myli przedmiot z celem") */
  usedStats: string[];
  /** Key terms defined or introduced with their meaning */
  keyTerms: string[];
  /** How the chapter ends — last topic/argument */
  closingTopic: string;
}

/**
 * Extract a content registry from a completed chapter.
 * Called once after each chapter is generated.
 * Cost: ~$0.002 per call (Haiku, ~2K input + ~300 output tokens)
 */
export async function extractChapterRegistry(
  chapterNumber: number,
  chapterTitle: string,
  latex: string,
  language: string,
  log?: any,
): Promise<ChapterRegistry> {
  // Strip heavy LaTeX for cheaper processing
  const cleanText = latex
    .replace(
      /\\begin\{(table|tabularx|tabular)\}[^]*?\\end\{(table|tabularx|tabular)\}/g,
      "[TABLE]",
    )
    .replace(
      /\\begin\{(tipbox|keyinsight|warningbox|examplebox)\}\{([^}]*)\}/g,
      "\n[$2]: ",
    )
    .replace(/\\end\{(tipbox|keyinsight|warningbox|examplebox)\}/g, "\n")
    .replace(/\\(chapter|section|subsection)\{([^}]*)\}/g, "\n## $2\n")
    .replace(/\\textbf\{([^}]*)\}/g, "$1")
    .replace(/\\textit\{([^}]*)\}/g, "$1")
    .replace(/\\footnote\{[^}]*\}/g, "")
    .replace(/\\[a-zA-Z]+/g, " ")
    .replace(/[{}]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const langName =
    { pl: "Polish", en: "English", de: "German", es: "Spanish", fr: "French" }[
      language
    ] || "English";

  const prompt = `Extract a content registry from this book chapter. Respond ONLY with valid JSON.

CHAPTER ${chapterNumber}: "${chapterTitle}"
LANGUAGE: ${langName}

TEXT:
${cleanText.substring(0, 6000)}

RESPOND with this exact JSON structure:
{
  "summary": "2-3 sentence summary of what this chapter covers and its main argument",
  "usedExamples": ["Company X did Y", "Case study: Z showed..."],
  "usedStats": ["47% of students confuse X with Y", "N=120 respondents"],
  "keyTerms": ["przedmiot badań = what you study", "cel badań = why you study it"],
  "closingTopic": "The chapter ends by discussing X"
}

RULES:
- summary: 2-3 sentences in ${langName}, capturing the MAIN argument
- usedExamples: List every named case study, company, person, or specific scenario (max 10)
- usedStats: List every specific number, percentage, or quantified claim (max 10)
- keyTerms: List terms that were DEFINED or given a specific meaning (max 8)
- closingTopic: 1 sentence about what the last section discusses
- All values in ${langName}`;

  try {
    log?.claudeReq?.(
      "registry",
      `[Ch${chapterNumber}] ${prompt.substring(0, 100)}...`,
    );

    const response = await anthropic.messages.create({
      model: UTILITY_MODEL,
      max_tokens: 600,
      temperature: 0.1,
      messages: [{ role: "user", content: prompt }],
    });

    const text =
      response.content[0].type === "text"
        ? response.content[0].text.trim()
        : "{}";
    log?.claudeRes?.("registry", text);
    log?.api?.(
      UTILITY_MODEL,
      response.usage?.input_tokens || 0,
      response.usage?.output_tokens || 0,
    );

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in registry response");
    const parsed = JSON.parse(jsonMatch[0]);

    return {
      chapterNumber,
      chapterTitle,
      summary: parsed.summary || "",
      usedExamples: (parsed.usedExamples || []).slice(0, 10),
      usedStats: (parsed.usedStats || []).slice(0, 10),
      keyTerms: (parsed.keyTerms || []).slice(0, 8),
      closingTopic: parsed.closingTopic || "",
    };
  } catch (err: any) {
    log?.warn?.(
      `Registry extraction failed for Ch${chapterNumber}: ${err.message}`,
    );
    // Fallback: extract basics programmatically
    return {
      chapterNumber,
      chapterTitle,
      summary: `Chapter ${chapterNumber}: ${chapterTitle}`,
      usedExamples: [],
      usedStats: extractStatsFromLatex(latex),
      keyTerms: [],
      closingTopic: "",
    };
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Style Sample — extracted once from Chapter 1
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Extract a representative style sample from Chapter 1.
 * Takes the opening ~800 chars + a mid-section ~700 chars.
 * Pure string operation — no API call needed.
 */
export function extractStyleSample(firstChapterLatex: string): string {
  // Get the opening (after \chapter{} and first \section{})
  const afterChapter = firstChapterLatex.replace(/^\\chapter\{[^}]*\}\s*/, "");
  const afterFirstSection = afterChapter.replace(/^\\section\{[^}]*\}\s*/, "");

  // Opening: first ~800 chars of actual prose
  const opening = afterFirstSection.substring(0, 800);

  // Mid-section: find the second \section and take ~700 chars after it
  const sections = [...firstChapterLatex.matchAll(/\\section\{[^}]*\}/g)];
  let midSection = "";
  if (sections.length >= 2) {
    const secondSectionIdx = sections[1].index!;
    const afterSecond = firstChapterLatex.substring(secondSectionIdx);
    const afterHeader = afterSecond.replace(/^\\section\{[^}]*\}\s*/, "");
    midSection = afterHeader.substring(0, 700);
  }

  return `${opening}${midSection ? "\n[...]\n" + midSection : ""}`;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Fallback: programmatic stat extraction (no API needed)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function extractStatsFromLatex(latex: string): string[] {
  const stats: string[] = [];

  // Match patterns like "47\% studentów", "N=120", "72\% prac"
  const percentPattern = /(\d+)\\?%\s+[a-zA-ZąćęłńóśżźĄĆĘŁŃÓŚŻŹ]+/g;
  const nPattern = /[Nn]\s*[=:]\s*\d+/g;

  let match;
  while ((match = percentPattern.exec(latex)) !== null) {
    stats.push(match[0].replace(/\\/g, "").trim());
  }
  while ((match = nPattern.exec(latex)) !== null) {
    stats.push(match[0].trim());
  }

  return [...new Set(stats)].slice(0, 10);
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

  log.header("Content Generation Pipeline v4.1", {
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
  const chapterRegistries: ChapterRegistry[] = []; // ← ADD
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
        chapterRegistries,
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

      previousChaptersContent.push({
        number: chapter.number,
        title: chapter.title,
        latex: result.latexContent,
      });

      // Extract registry for lightweight context
      const registry = await extractChapterRegistry(
        chapter.number,
        chapter.title,
        result.latexContent,
        project.language,
        log,
      );
      chapterRegistries.push(registry);

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
      previousChaptersContent.push({
        number: chapter.number,
        title: chapter.title,
        latex: `% Chapter ${chapter.number} "${chapter.title}" — generation failed, content unavailable`,
      });
    }
  }

  // ── Phase 4.5: Review & Revise ──
  log.phase(4.5, "Book Review & Targeted Revision");
  const reviewTimer = log.timer();
  await prisma.project.update({
    where: { id: projectId },
    data: { generationStatus: "REVIEWING_CONTENT" },
  });
  try {
    const chaptersForReview = previousChaptersContent.map((c) => ({
      number: c.number,
      title: c.title,
      latex: c.latex,
    }));

    const { chapters: revisedChapters, stats: reviewStats } =
      await reviewAndReviseBook(
        chaptersForReview,
        project.topic,
        bookTitle,
        project.guidelines || "",
        project.language,
        log,
      );

    // Apply revised LaTeX back to DB
    if (reviewStats.editsApplied > 0) {
      log.step(`Saving ${reviewStats.editsApplied} revision(s) to database...`);
      for (const revised of revisedChapters) {
        const wordCount = revised.latex
          .replace(/\\[a-zA-Z]+(\{[^}]*\})?/g, "")
          .split(/\s+/).length;

        await prisma.chapter.updateMany({
          where: { projectId, chapterNumber: revised.number },
          data: {
            latexContent: revised.latex,
            actualWords: wordCount,
            actualPages: wordCount / wpp,
          },
        });

        // Also update the in-memory content for compilation
        const pcIdx = previousChaptersContent.findIndex(
          (c) => c.number === revised.number,
        );
        if (pcIdx !== -1) {
          previousChaptersContent[pcIdx].latex = revised.latex;
        }
      }
    }

    totalTokens += reviewStats.reviewTokens + reviewStats.revisionTokens;

    log.ok(
      `Review complete: ${reviewStats.originalScore}→${reviewStats.finalScore}/10, ` +
        `${reviewStats.editsApplied} edits, ` +
        `+${reviewStats.reviewTokens + reviewStats.revisionTokens} tokens (${reviewTimer()})`,
    );
  } catch (reviewError: any) {
    // Review is non-critical — if it fails, continue to compilation
    log.warn(`Review failed (non-critical): ${reviewError.message}`);
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
// Main: Build lightweight context block
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Build the previous chapters context for the system prompt.
 * REPLACES the old buildPreviousChaptersContext() function.
 *
 * Components:
 * 1. Style sample from Chapter 1 (~1500 chars)
 * 2. Content registry per chapter (~300-500 chars each)
 * 3. Tail of last chapter (~2000 chars) for smooth transition
 *
 * Total: ~4-6K chars regardless of book size (vs 30-150K+ before)
 */
export function buildPreviousChaptersContext(
  previousChapters: { number: number; title: string; latex: string }[],
  _previousSummaries: string[], // prefix _ suppresses the warning
  registries: ChapterRegistry[],
  _maxChars?: number,
): string {
  if (previousChapters.length === 0) return "";

  const parts: string[] = [];

  // ── 1. Style sample from Chapter 1 ──
  const ch1 = previousChapters[0];
  if (ch1) {
    const sample = extractStyleSample(ch1.latex);
    parts.push(`
═══ YOUR WRITING STYLE (from Chapter 1 — match this EXACTLY) ═══

${sample}

═══ END STYLE SAMPLE ═══

CRITICAL: Match this voice precisely. Same sentence rhythm, same level of directness,
same way you use data and examples. The reader must feel ONE consistent author.`);
  }

  // ── 2. Content registry (what's been covered) ──
  if (registries.length > 0) {
    let registryBlock = `
═══ CONTENT ALREADY COVERED (do NOT repeat) ═══
`;

    for (const reg of registries) {
      registryBlock += `\n── Ch.${reg.chapterNumber}: "${reg.chapterTitle}" ──\n`;
      registryBlock += `Summary: ${reg.summary}\n`;

      if (reg.usedExamples.length > 0) {
        registryBlock += `Examples used: ${reg.usedExamples.join("; ")}\n`;
      }
      if (reg.usedStats.length > 0) {
        registryBlock += `Stats cited: ${reg.usedStats.join("; ")}\n`;
      }
      if (reg.keyTerms.length > 0) {
        registryBlock += `Terms defined: ${reg.keyTerms.join("; ")}\n`;
      }
    }

    registryBlock += `
═══ END CONTENT REGISTRY ═══

RULES:
- NEVER reuse any example, statistic, or case study listed above
- Use the SAME terms for the SAME concepts (check "Terms defined")
- You can REFERENCE earlier chapters: "As we discussed in Chapter X..."
- Build on established concepts, don't re-explain them`;

    parts.push(registryBlock);
  }

  // ── 3. Tail of last chapter (for smooth transition) ──
  const lastCh = previousChapters[previousChapters.length - 1];
  if (lastCh) {
    const tailChars = 2000;
    const tail = lastCh.latex.substring(
      Math.max(0, lastCh.latex.length - tailChars),
    );

    // Find a clean starting point (beginning of a paragraph or section)
    const cleanStart = tail.indexOf("\n\n");
    const cleanTail = cleanStart > 0 ? tail.substring(cleanStart) : tail;

    parts.push(`
═══ END OF CHAPTER ${lastCh.number} (transition point — continue naturally) ═══

${cleanTail.trim()}

═══ END ═══

Your chapter starts where this left off. Transition naturally — don't repeat the closing points above.`);
  }

  return parts.join("\n\n");
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
  chapterRegistries: ChapterRegistry[];
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
  const model = "claude-sonnet-4-5";
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

  const previousChaptersBlock = buildPreviousChaptersContext(
    p.previousChaptersContent,
    p.previousSummaries,
    p.chapterRegistries,
  );

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SYSTEM PROMPT
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const systemPrompt = `You are a seasoned subject-matter expert and published author writing a professional book chapter. You write like a human expert — not like an AI. You produce richly formatted, typographically professional LaTeX output.

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
- BAD: "AI can significantly improve productivity" → GOOD: "Teams using Cursor report 40\\% faster code reviews, with junior developers seeing the biggest gains"
- BAD: "Many companies are adopting AI" → GOOD: "Shopify cut its workforce by 20\\% in 2023, with CEO Tobi Lütke stating AI would replace roles, not just assist them"
- When listing tools/methods: include PRICING, LIMITATIONS, and WHEN NOT to use them
- Minimum 3 concrete data points per section (numbers, percentages, company names, dates)
- When describing a process, include a realistic scenario with specific numbers

STRUCTURE WITHIN SECTIONS:
- Open each section with a specific insight, stat, or contrarian take — NOT a definition
- Close each major section with a \\begin{keyinsight} box summarizing the actionable takeaway
- Use \\begin{tipbox} for practical "how-to" advice within sections
- Use \\begin{warningbox} when discussing common mistakes or counterintuitive pitfalls
- Use \\begin{examplebox} for detailed case studies with company names and numbers
- Use tables (booktabs) when comparing 3+ items, tools, approaches, or data points
- Use \\begin{itemize} sparingly — prefer flowing prose with embedded specifics
- NEVER pad content with long lists of example prompts, templates, or filler

ANTI-FILLER RULES:
- Every paragraph must contain at least one SPECIFIC fact, number, or named example
- Do NOT write "There are many tools available" — instead, compare their trade-offs in a TABLE
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
LATEX OUTPUT & VISUAL ELEMENTS
═══════════════════════════════════════════════════════════════

BASE RULES:
- Output ONLY the chapter body — NO preamble, NO \\documentclass, NO \\begin{document}
- Start with \\chapter{${p.chapter.title}}
- Use \\section{} for main sections, \\subsection{} for subsections
- Use \\textbf{}, \\textit{}, \\emph{} for emphasis (sparingly)
- Use \\footnote{} for asides and source attributions
- Escape special chars: \\%, \\&, \\#, \\$, \\_, \\{, \\}
- Use --- for em-dash, -- for en-dash
- NO \\usepackage, NO custom command definitions
- ALL text in ${lang}
- NEVER leave a section or sentence unfinished

⚠️ CRITICAL LATEX RULES — ENVIRONMENT MATCHING:
- EVERY \\begin{tipbox} MUST have a matching \\end{tipbox}
- EVERY \\begin{keyinsight} MUST have a matching \\end{keyinsight}
- EVERY \\begin{warningbox} MUST have a matching \\end{warningbox}
- EVERY \\begin{examplebox} MUST have a matching \\end{examplebox}
- EVERY \\begin{table} MUST have a matching \\end{table}
- EVERY \\begin{tabularx} MUST have a matching \\end{tabularx}
- EVERY \\begin{itemize} MUST have a matching \\end{itemize}
- EVERY \\begin{enumerate} MUST have a matching \\end{enumerate}
- NEVER leave an environment unclosed — this causes fatal compilation errors
- Double-check ALL environments are properly closed before finishing output

═══ COLORED BOXES — use 3-5 per chapter, mixing types ═══

Practical tip or actionable advice (green left-border):
\\begin{tipbox}{Title of Practical Tip}
Actionable advice for the reader. Concrete steps, not vague suggestions. 2-4 sentences.
\\end{tipbox}

Key takeaway — place at end of each major section (blue frame):
\\begin{keyinsight}{Title of Key Insight}
The ONE thing the reader must remember from this section. Specific, data-backed.
\\end{keyinsight}

Warning about common mistake or pitfall (amber left-border):
\\begin{warningbox}{Title of Warning}
Common mistake and its consequence. Include what to do instead. 2-3 sentences.
\\end{warningbox}

Case study or real-world example (purple frame):
\\begin{examplebox}{Case Study: Company or Person Name}
Real-world example with specific numbers, timeline, and measurable outcomes.
What they did, what happened, what the reader can learn from it.
\\end{examplebox}

═══ TABLES — use 1-2 per chapter for data comparisons ═══

Use booktabs tables for comparing tools, approaches, statistics, or any structured data.
Tables make data easier to scan than prose and look professional.

EXACT SYNTAX — follow precisely:
\\begin{table}[ht]
\\centering
\\caption{Descriptive caption explaining what this table shows}
\\begin{tabularx}{\\textwidth}{lXr}
\\toprule
\\rowcolor{tableheadbg} \\textcolor{tableheadfg}{\\textbf{Column 1}} & \\textcolor{tableheadfg}{\\textbf{Column 2}} & \\textcolor{tableheadfg}{\\textbf{Column 3}} \\\\
\\midrule
Row 1 data & Description text & 95\\% \\\\
Row 2 data & Description text & 72\\% \\\\
Row 3 data & Description text & 48\\% \\\\
\\bottomrule
\\end{tabularx}
\\end{table}

CRITICAL TABLE RULES:
- Column spec must use X (flexible) for text-heavy columns: {lXr}, {lXXr}, {Xlr}
- ALWAYS include \\caption{} — it appears with styled formatting
- Fill tables with REAL data from sources or expert knowledge — NEVER placeholder text
- Use tables when comparing 3+ items instead of writing them as prose
- Keep tables focused: 3-6 rows, 3-4 columns maximum
- In \\rowcolor and \\textcolor lines: every column MUST have \\textcolor{tableheadfg}{\\textbf{...}}

═══ QUOTES ═══

Use \\begin{quote} for notable expert quotes — max 1-2 per chapter, only when impactful.

═══ VISUAL ELEMENT MINIMUMS PER CHAPTER ═══

MANDATORY — every chapter MUST include:
□ At least 1 booktabs table with real comparative data
□ At least 1 keyinsight box (ideally one per \\section{})
□ At least 1 tipbox OR warningbox with actionable advice
□ At least 1 examplebox with a named case study
□ Total: 3-5 colored boxes + 1-2 tables per chapter

These visual elements should feel NATURAL — placed where the content demands them,
not forced. A comparison section NEEDS a table. A practical advice section NEEDS a tipbox.
A section about mistakes NEEDS a warningbox.`;

  // ━━━ User prompt ━━━
  let userPrompt = `Write Chapter ${p.chapter.number}/${p.totalChapters}: "${p.chapter.title}"
Description: ${p.chapter.description}

SECTIONS TO WRITE:
${sectionsOutline}

FULL BOOK TABLE OF CONTENTS (for context — maintain coherent narrative):
${toc}

WORD COUNT TARGET: ${targetWords} words (±10%) = ${p.chapter.targetPages} pages in ${p.bookFormat.toUpperCase()} @ ${p.wpp} words/page.
⚠️ Hard limits: minimum ${Math.round(targetWords * 0.85)} words, maximum ${Math.round(targetWords * 1.15)} words.
⚠️ STRICT MAXIMUM: Do NOT exceed ${Math.round(targetWords * 1.15)} words under any circumstances. If you reach the limit, wrap up the current section and move on.
⚠️ COMPLETE every section and sentence. NEVER stop mid-sentence or leave a section unfinished.

QUALITY CHECKLIST — verify before finishing:
□ Does every section open with a specific fact/insight (not a definition)?
□ Are there 3+ concrete data points per section?
□ Did you avoid ALL banned AI phrases from the system prompt?
□ Is there at least one real company/product name per section?
□ Did you include at least 1 booktabs table with real comparative data?
□ Did you include 3-5 colored boxes (keyinsight, tipbox, warningbox, examplebox)?
□ Does every major \\section{} end with a keyinsight box?
□ Did you avoid long lists of examples/templates that pad word count?
□ Does the chapter read like a professionally typeset book — not a text dump?
□ Is EVERY opened environment properly closed (no missing end-tags)?`;

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
- Maintain the same terminology — if you called something "X" before, call it "X" again
- Use the same ratio of visual elements (tables, boxes) as your previous chapters`;
  }

  // ── Last chapter closing instruction ──
  if (isLastChapter) {
    userPrompt += `

⚠️ THIS IS THE FINAL CHAPTER OF THE BOOK. You MUST:
- Write a proper conclusion section at the end (\\section{...})
- Summarize key takeaways from the ENTIRE book (reference earlier chapters by name)
- End with a concrete call-to-action or forward-looking statement for the reader
- Include a final \\begin{keyinsight} box with the single most important message of the book
- The last paragraph should feel like a deliberate, satisfying ending — NOT a cutoff
- Do NOT end with a generic "the future is bright" statement — end with something actionable and specific`;
  }

  userPrompt += `\n\nBegin LaTeX output now. Start with \\chapter{${p.chapter.title}}. Write exactly ${targetWords} words (±10%), entirely in ${lang}. Remember: expert voice, concrete data, no AI filler, RICH visual formatting (tables + colored boxes). Close every opened environment properly.`;

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

  // ── max_tokens: tighter cap to prevent overshoot ──
  // LaTeX averages ~1.8 tokens/word; use 2.2x safety margin but cap at 20K
  const maxTok = Math.max(4000, Math.min(20000, Math.ceil(targetWords * 2.2)));
  p.log.step(
    `Calling Claude API (max_tokens: ${maxTok}, target: ${targetWords}w)...`,
  );

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
  latex = sanitizeGeneratedLatex(latex);

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
  const wc = countWords(latex);
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
- Continue using visual elements: if you haven't used enough tables or colored boxes yet, add them now
- Output only LaTeX body (no preamble). All text in ${lang}.
- Remember: banned AI phrases still apply. Write like a human expert.
- ⚠️ STOP writing at approximately ${remainingWords} additional words. Do NOT exceed ${maxTotalWords} total words for the chapter.
- ⚠️ Close every opened environment properly — unclosed environments crash compilation.${
      isLastChapter
        ? "\n- THIS IS THE FINAL CHAPTER — make sure it ends with a proper conclusion for the whole book, including a final keyinsight box."
        : ""
    }`;

    prompts.push({
      step: "continuation",
      role: "continuation",
      content: contPrompt,
      timestamp: ts(),
    });

    const contMaxTok = Math.max(
      3000,
      Math.min(16000, Math.ceil(remainingWords * 2.2)),
    );
    const contTimer = p.log.timer();
    p.log.claudeReq?.("chapter-cont", contPrompt);
    const cont = await anthropic.messages.create({
      model,
      max_tokens: contMaxTok,
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
    contLatex = sanitizeGeneratedLatex(contLatex);
    p.log.claudeRes?.("chapter-cont", contLatex);
    latex += "\n\n" + contLatex;
    tokens +=
      (cont.usage?.input_tokens || 0) + (cont.usage?.output_tokens || 0);

    const contWc = countWords(contLatex);
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

  // ── Final sanitization pass on combined content ──
  latex = sanitizeGeneratedLatex(latex);

  // ── Summary ──
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
// LaTeX sanitization — fix AI-generated environment errors
// Runs BEFORE saving to DB (first line of defense)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const KNOWN_ENVS = [
  "tipbox",
  "keyinsight",
  "warningbox",
  "examplebox",
  "itemize",
  "enumerate",
  "quote",
  "table",
  "tabularx",
  "tabular",
  "center",
  "figure",
  "minipage",
  "description",
  "wrapfigure",
];

/**
 * Fix environment nesting order in LaTeX output.
 *
 * AI sometimes generates:
 *   \begin{table}
 *     \begin{tabularx}...
 *   \end{table}        ← WRONG: outer closed before inner
 *   \end{tabularx}     ← this causes "Missing \cr" fatal error
 *
 * This function detects and fixes reversed closings using:
 * 1. Direct pattern matching for known nesting pairs
 * 2. Stack-based analysis for complex/nested cases
 */
function fixEnvironmentNesting(latex: string): string {
  let result = latex;

  // ── Pass 1: Direct swap of known reversed pairs ──
  const nestingPairs: [string, string][] = [
    ["table", "tabularx"],
    ["table", "tabular"],
    ["figure", "center"],
    ["table", "center"],
  ];

  for (const [outer, inner] of nestingPairs) {
    const swappedRe = new RegExp(
      `(\\\\end\\{${outer}\\})(\\s*)(\\\\end\\{${inner}\\})`,
      "g",
    );
    result = result.replace(swappedRe, (_m, endOuter, ws, endInner) => {
      console.log(
        `  🔧 Nesting fix: swapped \\end{${outer}} / \\end{${inner}}`,
      );
      return `${endInner}${ws}${endOuter}`;
    });
  }

  // ── Pass 2: Stack-based nesting validation ──
  // Catches cases where inner \end{} is completely missing
  // e.g. \begin{table}\begin{tabularx}...\end{table} (no \end{tabularx} at all)
  const envRegex = /\\(begin|end)\{(tabularx?|table|figure|center)\}/g;
  const stack: string[] = [];
  const insertions: { pos: number; text: string }[] = [];
  let match;

  while ((match = envRegex.exec(result)) !== null) {
    const [, action, env] = match;
    if (action === "begin") {
      stack.push(env);
    } else {
      if (stack.length > 0 && stack[stack.length - 1] === env) {
        stack.pop();
      } else if (stack.length >= 2) {
        const topEnv = stack[stack.length - 1];
        const secondEnv = stack[stack.length - 2];
        if (secondEnv === env) {
          // Missing \end for inner env — insert it before this \end
          insertions.push({
            pos: match.index,
            text: `\\end{${topEnv}}\n`,
          });
          console.log(
            `  🔧 Nesting fix: inserting missing \\end{${topEnv}} before \\end{${env}}`,
          );
          stack.pop();
          stack.pop();
        }
      }
    }
  }

  // Apply in reverse to preserve positions
  for (const ins of insertions.reverse()) {
    result =
      result.substring(0, ins.pos) + ins.text + result.substring(ins.pos);
  }

  return result;
}

/**
 * Fix unclosed/orphaned LaTeX environments and brace imbalance.
 * Applied immediately after receiving API response, before DB storage.
 */
function sanitizeGeneratedLatex(latex: string): string {
  let result = latex;

  // 1. Fix unclosed/unmatched environments
  for (const env of KNOWN_ENVS) {
    const beginRe = new RegExp("\\\\begin\\{" + env + "\\}", "g");
    const endRe = new RegExp("\\\\end\\{" + env + "\\}", "g");
    const begins = (result.match(beginRe) || []).length;
    const ends = (result.match(endRe) || []).length;

    if (begins > ends) {
      // Missing \end{env} — append at the end
      const missing = begins - ends;
      for (let i = 0; i < missing; i++) {
        result += "\n\\end{" + env + "}";
      }
    } else if (ends > begins) {
      // Orphan \end{env} — remove extras from the beginning
      let toRemove = ends - begins;
      result = result.replace(
        new RegExp("\\\\end\\{" + env + "\\}", "g"),
        (match) => {
          if (toRemove > 0) {
            toRemove--;
            return "";
          }
          return match;
        },
      );
    }
  }

  //   // 1.5. Fix environment nesting order (e.g. \end{table} before \end{tabularx})
  result = fixEnvironmentNesting(result);

  // 2. Fix brace imbalance (non-escaped braces only)
  let depth = 0;
  for (let i = 0; i < result.length; i++) {
    if (result[i] === "{" && (i === 0 || result[i - 1] !== "\\")) depth++;
    if (result[i] === "}" && (i === 0 || result[i - 1] !== "\\")) depth--;
  }
  if (depth > 0) {
    result += "}".repeat(depth);
  }

  // 3. Remove preamble/postamble that model might have included
  result = result.replace(/\\documentclass[^]*?\\begin\{document\}/g, "");
  result = result.replace(/\\end\{document\}/g, "");
  result = result.replace(/\\usepackage(\[[^\]]*\])?\{[^}]*\}/g, "");

  // 4. Strip prompt echoes — model sometimes copies instructions into output
  // Remove \begin{} or \end{} with empty or ... arguments (not valid LaTeX)
  result = result.replace(/\\begin\{\.{0,3}\}/g, "");
  result = result.replace(/\\end\{\.{0,3}\}/g, "");
  // Remove checklist lines (□ ...) that got echoed from the prompt
  result = result.replace(/^□\s+.*$/gm, "");
  // Remove lines that look like prompt instructions
  result = result.replace(
    /^(QUALITY CHECKLIST|WORD COUNT TARGET|SECTIONS TO WRITE|RULES FOR CONTINUATION|Begin LaTeX output now).*$/gm,
    "",
  );
  // Remove lines with ⚠️ that are clearly prompt echoes (not inside boxes)
  result = result.replace(
    /^⚠️\s+(Hard limits|STRICT MAXIMUM|COMPLETE every|CONTINUITY|THIS IS THE FINAL|ENSURE every|STOP writing|Close every opened).*$/gm,
    "",
  );

  // 5. Clean up excessive blank lines
  result = result.replace(/\n{4,}/g, "\n\n\n");

  return result;
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

/** Count words in LaTeX content (stripping commands) */
function countWords(latex: string): number {
  return latex
    .replace(/\\[a-zA-Z]+(\{[^}]*\})?/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 0).length;
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
      model: "claude-haiku-4-5",
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
