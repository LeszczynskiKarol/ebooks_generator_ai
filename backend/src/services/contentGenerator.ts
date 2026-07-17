// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BookForge — Content Generator v4.1
// Rich typography: tcolorbox environments, booktabs tables
// Full previous chapters context for style consistency
// + LaTeX sanitization to prevent compilation failures
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { createLLMClient } from "../lib/llm";
import { reviewAndReviseBook } from "./reviewService";
import { prisma } from "../lib/prisma";
import { getWordsPerPage, footnotesEnabled } from "../lib/types";
import { applyCitationGuards } from "../lib/citationGuards";
import { createPipelineLogger } from "../lib/logger";
import {
  loadResearch,
  conductChapterResearch,
  mergeResearchForPrompt,
  ChapterResearchResult,
} from "./researchService";
import {
  getOrCreateAuthorBrief,
  formatBriefForPrompt,
  BookBrief,
} from "./briefGenerator";
import { parseLLMJson, ChapterRegistrySchema } from "../lib/llmJson";
import {
  repairControlCharLatex,
  mergeSplitTableHeaders,
} from "../lib/latexFixes";

const anthropic = createLLMClient();
const UTILITY_MODEL = "claude-sonnet-4-6";

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

    const result = parseLLMJson(text, ChapterRegistrySchema);
    if (!result.ok) throw new Error(result.error);
    const parsed = result.data;

    return {
      chapterNumber,
      chapterTitle,
      summary: parsed.summary,
      usedExamples: parsed.usedExamples.slice(0, 10),
      usedStats: parsed.usedStats.slice(0, 10),
      keyTerms: parsed.keyTerms.slice(0, 8),
      closingTopic: parsed.closingTopic,
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

export async function generateContent(
  projectId: string,
  opts: { force?: boolean } = {},
) {
  const log = createPipelineLogger("CONTENT", projectId);

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { structure: true },
  });
  if (!project || !project.structure)
    throw new Error("Project or structure not found");

  const structureData = JSON.parse(project.structure.structureJson);
  const chapters: ChapterStructure[] = structureData.chapters;

  // ── Resume / user-edit protection ──
  // A chapter is skipped (its saved content reused) when:
  //  - the user manually edited it (always protected, even with force), or
  //  - it is already LATEX_READY and this is a resume run (no force).
  const existingRecords = await prisma.chapter.findMany({
    where: { projectId },
  });
  const recordByNumber = new Map(
    existingRecords.map((r) => [r.chapterNumber, r]),
  );
  const shouldSkip = (chapterNumber: number): boolean => {
    const rec = recordByNumber.get(chapterNumber);
    if (!rec?.latexContent) return false;
    if (rec.userEditedAt) return true;
    return !opts.force && rec.status === "LATEX_READY";
  };
  const skippedNumbers = new Set(
    chapters.filter((c) => shouldSkip(c.number)).map((c) => c.number),
  );
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

  if (skippedNumbers.size > 0) {
    log.ok(
      `Resume: reusing ${skippedNumbers.size}/${chapters.length} saved chapter(s) — ` +
        chapters
          .filter((c) => skippedNumbers.has(c.number))
          .map((c) => {
            const rec = recordByNumber.get(c.number);
            return `Ch${c.number}${rec?.userEditedAt ? " (user-edited)" : ""}`;
          })
          .join(", "),
    );
  }

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

  // ── Phase 1.5: Author brief (normally created at structure time;
  //    generated here as a safety net for pre-brief projects) ──
  const brief = await getOrCreateAuthorBrief(
    project,
    mergeResearchForPrompt(globalResearch, null, 8000).text,
    log,
  );

  // ── Phase 2: Per-chapter research ──
  log.phase(2, "Per-Chapter Research");

  const globalUrls = new Set<string>(
    globalResearch?.selectedSources.map((s) => s.url) || [],
  );

  const chapterResearchMap = new Map<number, ChapterResearchResult>();

  for (const chapter of chapters) {
    if (skippedNumbers.has(chapter.number)) {
      log.step(
        `\n  ⏭️  Ch.${chapter.number}: "${chapter.title}" — already generated, skipping research`,
      );
      continue;
    }
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
    if (skippedNumbers.has(ch.number)) {
      log.step(
        `  Ch.${ch.number}: "${ch.title}" — keeping existing content (skip)`,
      );
      continue;
    }
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
      generationProgress: skippedNumbers.size / chapters.length,
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

    // ── Resume: reuse saved content instead of regenerating ──
    if (skippedNumbers.has(chapter.number) && rec.latexContent) {
      log.step(
        `\n  ⏭️  Ch ${chapter.number}/${chapters.length}: "${chapter.title}" — reusing saved content${
          rec.userEditedAt ? " (user-edited)" : ""
        }`,
      );
      previousChaptersContent.push({
        number: chapter.number,
        title: chapter.title,
        latex: rec.latexContent,
      });

      let registry: ChapterRegistry | null = null;
      if (rec.registryJson) {
        try {
          registry = JSON.parse(rec.registryJson);
        } catch {
          registry = null;
        }
      }
      if (!registry) {
        registry = await extractChapterRegistry(
          chapter.number,
          chapter.title,
          rec.latexContent,
          project.language,
          log,
        );
        await prisma.chapter.update({
          where: { id: rec.id },
          data: { registryJson: JSON.stringify(registry) },
        });
      }
      chapterRegistries.push(registry);
      previousSummaries.push(
        `Ch${chapter.number} "${chapter.title}": ${registry.summary}`,
      );
      continue;
    }

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
        brief,
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
        allowFootnotes: footnotesEnabled(project),
        log,
      });

      totalTokens += result.tokensUsed;

      // ── Mechanical citation guards (no LLM judge) — only when footnotes are on ──
      if (footnotesEnabled(project)) {
        const guard = applyCitationGuards(result.latexContent, mergedSourcesText);
        result.latexContent = guard.content;
        if (guard.demotedPages.length || guard.statsFindings.length) {
          log.warn(
            `Ch ${chapter.number} citation guards: ${guard.demotedPages.length} unverifiable page(s) stripped, ${guard.statsFindings.length} stat claim(s) flagged`,
          );
          for (const d of guard.demotedPages.slice(0, 6))
            log.step?.(`   ⚠ removed s. ${d.page} (${d.reason})`);
        }
      }

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
          registryJson: JSON.stringify(registry),
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
        // Never let the automated review overwrite a user-edited chapter
        if (recordByNumber.get(revised.number)?.userEditedAt) {
          log.warn(
            `  Ch${revised.number}: user-edited — skipping review revision`,
          );
          continue;
        }
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

  // ── Phase 4.7: AI Illustrations (optional, non-fatal) ──
  if (project.useAiImages) {
    log.phase(4.7, "AI Illustrations (FLUX)");
    const illuTimer = log.timer();
    try {
      const { illustrateChapters } = await import("./illustrationService");
      const added = await illustrateChapters(projectId, {
        language: project.language,
        stylePreset: project.stylePreset,
        imageGuidelines: project.imageGuidelines || null,
        imageDensity: project.imageDensity || "standard",
        log,
      });
      log.ok(`Illustrations: ${added} image(s) added (${illuTimer()})`);
    } catch (illuError: any) {
      log.warn(`Illustrations failed (non-critical): ${illuError.message}`);
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

  // ── Auto-generate cover if the user ticked "Generate cover" in the order form ──
  const projForCover = await prisma.project.findUnique({
    where: { id: projectId },
  });
  if (projForCover?.autoCoverRequested && projForCover.coverType === "NONE") {
    try {
      const { getDefaultCoverParams, generateCoverLatex, derivePillarsFromChapters } =
        await import("./coverGenerator");
      const params = getDefaultCoverParams(projForCover);
      // Fill the cover's midsection with chapter pillars
      params.pillars = derivePillarsFromChapters(
        chapters.map((c) => ({ title: c.title, description: c.description })),
      );
      const cc = projForCover.customColors
        ? JSON.parse(projForCover.customColors)
        : undefined;
      const coverLatex = generateCoverLatex(
        params,
        projForCover.bookFormat,
        projForCover.language,
        projForCover.stylePreset,
        cc,
      );
      await prisma.project.update({
        where: { id: projectId },
        data: {
          coverType: "GENERATED",
          coverLatex,
          coverParams: JSON.stringify(params),
          coverUpdatedAt: new Date(),
        },
      });
      log.ok("Auto-generated professional cover (requested in order form)");
    } catch (e: any) {
      log.warn(`Auto-cover generation failed (non-fatal): ${e.message}`);
    }
  }

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
═══ YOUR WRITING VOICE (from Chapter 1 — match the VOICE, not the punctuation habits) ═══

${sample}

═══ END STYLE SAMPLE ═══

This sample shows how the AUTHOR BRIEF's voice sounds in practice — the brief remains the
master definition. Match the VOICE: same register, directness, and way of using evidence,
so the reader feels ONE consistent author. But do NOT copy punctuation manierisms from this
sample (em-dashes, colon-continuations, aphorism closers, "nie tylko... lecz"). The RHYTHM &
PUNCTUATION rules below OVERRIDE this sample — even if Chapter 1 overused dashes, you keep
them rare.`);
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
  brief: BookBrief;
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
  /** false → popular book: facts stay grounded but NO footnote apparatus */
  allowFootnotes: boolean;
  log: any;
}

async function generateChapterLatex(p: GenParams): Promise<{
  latexContent: string;
  tokensUsed: number;
  summary: string;
  prompts: PromptLog[];
  responses: ResponseLog[];
}> {
  // Models systematically undershoot long-form targets by 15-25%. Ask ABOVE
  // the real target so a single response usually lands on it — continuations
  // are a last resort (they tend to leak meta-commentary into the book).
  const realTargetWords = p.chapter.targetPages * p.wpp;
  const targetWords = Math.round(realTargetWords * 1.2);
  const lang = getLangName(p.language);
  const prompts: PromptLog[] = [];
  const responses: ResponseLog[] = [];
  const model = "claude-sonnet-4-6";
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

${formatBriefForPrompt(p.brief)}

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
- Extract the SPECIFIC material the brief's EVIDENCE POLICY calls for: in a data-driven
  book that's names, numbers, dates, pricing; in other genres it's techniques, recipes,
  stories, regulations — whatever the sources actually offer
- Build the chapter AROUND source material — don't just mention it, USE it
- Contrast different sources when they disagree
- Name real things (companies, products, institutions, works) only with specifics from sources
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
- Embody the VOICE and READER ADDRESS from the AUTHOR BRIEF above — that persona, that register, consistently
- Use direct, concise sentences. Prefer "X does Y" over "It is worth noting that X has the capability to do Y"
- Vary sentence length: mix short punchy statements with longer analytical ones
- Have a point of view where the genre allows one — an author is not a neutral summarizer${
    hasPreviousChapters
      ? `
- CRITICAL: stay consistent with the voice defined in the brief; your previously
  written chapters above show how that voice sounds in practice. Same register,
  same directness, same way of using examples — the reader must not detect any
  author shift between chapters.`
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
- Every claim must be backed by something CONCRETE — and what counts as "concrete"
  is defined by the EVIDENCE POLICY in the author brief. In a data-driven guide that
  means numbers, named tools, dates; in a cookbook it means techniques, ingredients,
  temperatures, sensory detail; in a narrative book it means scenes and specifics of
  lived experience. Never a vague generality in any genre.
- BAD (any genre): "AI can significantly improve productivity" / "wiele osób uważa, że..."
  GOOD: the genre-appropriate specific ("Teams using Cursor report 40\\% faster code
  reviews" / "ciasto odpocznie 30 minut w lodówce, inaczej się kurczy przy pieczeniu")
- Follow the evidence policy's stated data density — do NOT force statistics into a
  book (or a section) whose evidence policy doesn't call for them, and do NOT go
  vague in a book whose policy demands hard data
- When you compare tools/methods in a data-driven book: include pricing, limitations,
  and when NOT to use them
- NEVER invent a statistic to satisfy density — a concrete example always beats a
  fabricated number

STRUCTURE WITHIN SECTIONS:
- Open each section the way the brief's NARRATIVE STRATEGY prescribes — with something
  specific (an insight, a scene, a problem, a number), NEVER with a dictionary definition
- Deploy visual elements per the brief's VISUAL APPARATUS — where content calls for
  them, not on a quota (element catalog + syntax below)
- Use \\begin{itemize} sparingly — prefer flowing prose with embedded specifics
- NEVER pad content with long lists of example prompts, templates, or filler

ANTI-FILLER RULES:
- Every paragraph must contain something the reader can USE or visualize — a fact,
  an example, a step, a scene — per the evidence policy; never generic filler prose
- Do NOT write "there are many options available" — show the actual options in the
  form the genre calls for (table, worked example, story)
- Do NOT repeat the same point in different words across paragraphs
- Information density: a reader should learn something new in every paragraph${
    hasPreviousChapters
      ? `
- NEVER repeat data points, examples, or arguments from your previous chapters.
  The reader has already absorbed that content. Reference it naturally instead:
  "As discussed in Chapter X..." or "Building on the framework from Chapter X..."`
      : ""
  }

${
  p.allowFootnotes
    ? `CITATIONS & FACTUAL INTEGRITY — CRITICAL (readers may copy citations into academic work):
- Cite ONLY sources that appear in the research material above, or canonical works you are certain exist
- NEVER invent page numbers. Some sources are tagged with "=== STRONA N ===" markers — the page of any passage is N in the nearest preceding marker. Add "s. X" / "p. X" ONLY when the fact comes from such a tagged passage and X is that marker's number; for a source with no page markers, cite the work WITHOUT a page number (page citations are auto-verified and silently removed if they don't match the source)
- NEVER invent journal volume/issue numbers, publication years, author names, sample sizes, or survey results
- Statistics and percentages MUST come from the research material. If you need an illustrative quantity, phrase it as an estimate ("zwykle", "typowo", "około") — never as a precise fabricated stat
- Case studies and anecdotes you compose yourself MUST be framed as hypothetical or typical scenarios ("Wyobraź sobie...", "Typowy przebieg wygląda tak:", "Imagine a student who...") — NEVER presented as real named people, real theses, or real published studies`
    : `FACTUAL INTEGRITY — CRITICAL (this is a POPULAR book — NO footnote apparatus):
- NEVER use \\footnote{} — this book has no footnotes, no reference list, no academic apparatus
- When a number or study genuinely matters, attribute it NATURALLY inside the sentence
  ("badacze z Uniwersytetu Kopenhaskiego policzyli, że...", "według danych Eurostatu...") —
  and only if that source actually appears in the research material above
- Statistics and percentages MUST come from the research material. If you need an illustrative
  quantity, phrase it as an estimate ("zwykle", "typowo", "około") — never as a precise fabricated stat
- Most paragraphs need NO source at all — practical knowledge speaks for itself; do not
  decorate the text with attributions where none are needed
- Case studies and anecdotes you compose yourself MUST be framed as hypothetical or typical
  scenarios — NEVER presented as real named people or real published studies`
}

NO FABRICATED AUTHORITY — applies whether or not footnotes are on:
- NEVER invent verbatim quotes from regulations, statutes, dyplomowanie rules, ministry guidelines, or any institutional document. Do not present '",,...''"' as a quoted rule unless that exact wording appears in the research material above.
- NEVER attribute a specific policy, requirement, quoted rule, or precise number to a NAMED institution (a university, faculty, a system like JSA, a ministry) unless that exact fact is in the research material. Without a verifiable source, write generally ("wiele uczelni wymaga...", "regulaminy dyplomowania zwykle określają...", "część wydziałów...") — a vague-but-true statement always beats a precise invention.
- Institution names: use the official name and keep it IDENTICAL on every mention (e.g. always "Uniwersytet SWPS", never mix "SWPS"/"USWPS"; never alternate "Vizja"/"Wizja"). If unsure of the exact name, refer generically rather than guess.

RHYTHM & PUNCTUATION — these patterns expose machine-written text, avoid them:
- Em-dashes (--- / —) are the SINGLE biggest AI tell (a publisher rejected a whole book over their density). HARD BUDGET: roughly one per two pages — a handful in the ENTIRE chapter, NEVER a default connector. Replace almost all with a comma, a full stop (split the sentence in two), parentheses, or a meaning-specific word ("czyli", "lecz", "ponieważ", "dlatego"). NEVER use a PAIR "--- ... ---" for an aside; use commas or parentheses.
- The colon is NOT a universal connector. Use it almost only before an explicit list. Continuing a thought after a colon ("...wykazała zależność: im więcej X, tym...") is an AI mannerism — vary it with a comma + "czyli", a semicolon, or a new sentence. At most ~1 mid-sentence colon per 3-4 paragraphs.
- Do NOT default to three-item structures ("trzy filary", "three steps") — let the count follow the content (2, 4, 5...)
- The antithesis "not X, but Y" ("nie X, lecz Y") at most ONCE per section
- "nie tylko... lecz/ale również/także/też" is the SAME antithesis figure — at most ONCE per section; rewrite the rest as a plain declarative sentence
- Mechanical modals (warto / należy / trzeba / powinien) — do not open advice sentences with them by reflex; replace many with a direct imperative ("Pobierz...", "Sprawdź...") or a plain descriptive statement
- BOX TITLES count toward the same limit: titles like "Teoria jako argument, nie dekoracja" /
  "X, not Y" are the SAME tell. At most ONE antithesis-shaped box title in the whole chapter —
  the rest must be plain descriptive titles ("Technika mapowania pojęć", "Jak sprawdzić bibliografię")
- Aphorism-style punchlines are a strong tell — HARD LIMIT 1-2 in the WHOLE chapter (count them before finishing). This includes symmetric closers ("X wymaga planowania, nie talentu"; "...nie pracą, lecz aktem wiary"; "Bez X nie ma Y, a bez Y nie ma Z"; "...niż wszystkie inne razem wzięte"). Almost every paragraph and box must end on a plain, informative sentence — not a quotable line
- NUMERIC TABLES: before finalizing, recompute every derived value (sums, averages, weighted
  scores) by hand — all arithmetic in a table must check out exactly. Readers verify these
- Quotes: use \`\`...'' (English) or ,,...'' (Polish). NEVER the straight " character — it breaks typesetting
- Number ranges tight, no spaces: 5--15, s.~228--229
- Polish only: use "oraz" solely as a second-level connector after "i" already appeared in the sentence; otherwise write "i"

═══════════════════════════════════════════════════════════════
LATEX OUTPUT & VISUAL ELEMENTS
═══════════════════════════════════════════════════════════════

BASE RULES:
- Output ONLY the chapter body — NO preamble, NO \\documentclass, NO \\begin{document}
- Start with \\chapter{${p.chapter.title}}
- Use \\section{} for main sections, \\subsection{} for subsections
- Use \\textbf{}, \\textit{}, \\emph{} for emphasis (sparingly)
${p.allowFootnotes ? "- Use \\footnote{} for asides and source attributions" : "- \\footnote{} is FORBIDDEN in this book — weave any attribution into the sentence itself"}
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
- EVERY \\begin{checklistbox} MUST have a matching \\end{checklistbox}
- EVERY \\begin{table} MUST have a matching \\end{table}
- EVERY \\begin{tabularx} MUST have a matching \\end{tabularx}
- EVERY \\begin{itemize} MUST have a matching \\end{itemize}
- EVERY \\begin{enumerate} MUST have a matching \\end{enumerate}
- NEVER leave an environment unclosed — this causes fatal compilation errors
- Double-check ALL environments are properly closed before finishing output

═══ COLORED BOXES — element catalog (usage intensity: per the brief's VISUAL APPARATUS) ═══

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

Action checklist — place exactly ONE at the very END of each chapter (checkbox list):
\\begin{checklistbox}{Checklist: Short Chapter Topic}
\\begin{itemize}
\\item First concrete, verifiable action item from this chapter
\\item Second action item — imperative mood, one line each
\\item 4-6 items total, each something the reader can tick off
\\end{itemize}
\\end{checklistbox}

═══ TABLES — for structured comparisons (only if the brief's visual apparatus calls for them) ═══

Use booktabs tables for comparing tools, approaches, statistics, or any structured data.
Tables make data easier to scan than prose and look professional.

EXACT SYNTAX — a table with one long-text column (tabularx, full width):
\\begin{table}[!htbp]
\\centering
\\caption{Descriptive caption explaining what this table shows}
\\begin{tabularx}{\\textwidth}{lXr}
\\toprule
\\rowcolor{tableheadbg} \\textcolor{tableheadfg}{\\textbf{Column 1}} & \\textcolor{tableheadfg}{\\textbf{Column 2}} & \\textcolor{tableheadfg}{\\textbf{Column 3}} \\\\
\\midrule
Row 1 data & Longer description text that wraps & 95\\% \\\\
Row 2 data & Longer description text that wraps & 72\\% \\\\
\\bottomrule
\\end{tabularx}
\\end{table}

A compact table where NO column has long text (plain tabular — natural width, not stretched):
\\begin{table}[!htbp]
\\centering
\\caption{Descriptive caption}
\\begin{tabular}{lcr}
\\toprule
\\rowcolor{tableheadbg} \\textcolor{tableheadfg}{\\textbf{Etap}} & \\textcolor{tableheadfg}{\\textbf{Czas}} & \\textcolor{tableheadfg}{\\textbf{Punkty}} \\\\
\\midrule
Test & 60 min & 10 \\\\
Wypracowanie & 180 min & 35 \\\\
\\bottomrule
\\end{tabular}
\\end{table}

CRITICAL TABLE RULES — column widths must follow content:
- X columns ONLY for cells with genuinely long text (sentences, descriptions) — X columns
  split the leftover width EQUALLY, so a numbers column typed as X becomes absurdly wide
- Short-content columns (numbers, points, dates, single words, names) = l/c/r — they stay narrow
- NEVER make every column X; typical good specs: {lXr}, {lX}, {lXc} — at most 2 X columns
- If NO column carries long text, use plain tabular (second example) — the table takes its
  natural width instead of being stretched across the whole page with gaping columns
- ALWAYS include \\caption{} — it appears with styled formatting
- Fill tables with REAL data from sources or expert knowledge — NEVER placeholder text
- Use tables when comparing 3+ items instead of writing them as prose
- Keep tables focused: 3-6 rows, 3-4 columns maximum
- In \\rowcolor and \\textcolor lines: every column MUST have \\textcolor{tableheadfg}{\\textbf{...}}

═══ QUOTES ═══

Use \\begin{quote} for notable expert quotes — max 1-2 per chapter, only when impactful.

═══ RICH VISUAL MACROS — use for visual variety (these render as designed graphics) ═══

You have FOUR special macros. Supply ONLY the content — never write raw TikZ. Use REAL data.

1. \\pullquote{...} — a large, elegant pull quote for one striking idea.
   \\pullquote{Dobre narzędzie nie zmusza cię do myślenia o wyglądzie --- pozwala myśleć o treści.}

2. \\bignumber{VALUE}{short label} — a big highlighted statistic for a key number.
   \\bignumber{92\\%}{prac naukowych w fizyce składanych jest w \\LaTeX{}-u}

3. \\stepflow{Krok A, Krok B, Krok C, ...} — a horizontal process/flow diagram.
   Comma-separated, 2-6 SHORT steps (1-3 words each) on ONE line. Use for ANY process or sequence.
   \\stepflow{Plik .tex, pdflatex, Plik .log, Poprawki, Gotowy PDF}

4. \\concept{Termin}{Definicja} — a highlighted concept/definition box for an important term.
   \\concept{WYSIWYM}{What You See Is What You Mean --- opisujesz znaczenie, system dba o wygląd.}

MACRO RULES:
- \\bignumber{VALUE}: VALUE must be an ACTUAL figure (e.g. 320\\,000, 68\\%, 2,5×), never a description or phrase. If you have no real number from the research material, do NOT use \\bignumber at all.
- \\stepflow steps must be SHORT (1-3 words) and comma-separated on ONE line — never long sentences.
- Prefer a \\stepflow diagram over describing a process only in prose.
- NEVER use \\includegraphics or reference image files (rysunek.pdf, schemat.pdf, wykres.png, etc.) —
  you have NO external images. Visualize processes with \\stepflow and concepts with \\concept.

═══ VISUAL ELEMENT USAGE — the brief decides, not a quota ═══

The AUTHOR BRIEF's VISUAL APPARATUS section defines which elements fit THIS book and
roughly how many per chapter. Follow it. Universal rules on top of it:
- Place an element ONLY where the content genuinely calls for it: a comparison of 3+
  real items wants a table; practical advice wants a tipbox; a common mistake wants a
  warningbox; a real process wants a \\stepflow. Never insert one to fill a quota.
- NEVER use \\bignumber without a REAL figure from the research material — if the brief
  calls for visual emphasis but no real number exists, use \\pullquote instead
- Do NOT give every chapter the identical apparatus (same box count, same macro mix) —
  uniform apparatus across chapters is a machine-generation tell; let each chapter's
  content decide
- If the brief says an element does not fit this book, do not use it at all`;

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
□ Does every section open with something specific, per the brief's narrative strategy (never a definition)?
□ Is every claim grounded the way the brief's EVIDENCE POLICY requires (and NO statistic invented to fill space)?
□ Does the whole chapter sustain the VOICE and reader address from the brief?
□ Did you avoid ALL banned AI phrases from the system prompt?
□ Do the visual elements match the brief's VISUAL APPARATUS — used where content calls for them, no quota-filling, not the same apparatus as other chapters?
□ Did you AVOID \\includegraphics and any external image references entirely?
□ Did you avoid long lists of examples/templates that pad word count?
□ Does the chapter read like a professionally typeset book — not a text dump?
□ Is EVERY opened environment properly closed (no missing end-tags)?`;

  // ── Continuity instruction for chapters 2+ ──
  if (hasPreviousChapters) {
    const lastChNum =
      p.previousChaptersContent[p.previousChaptersContent.length - 1].number;
    userPrompt += `

⚠️ CONTINUITY — your previous ${p.previousChaptersContent.length} chapter(s) are in the system prompt above:
- Keep the voice from the AUTHOR BRIEF — the reader must feel one consistent author across chapters
- Transition naturally from Chapter ${lastChNum} — don't repeat its closing points
- Reference earlier chapters when building on concepts: "As we discussed in Chapter ${lastChNum}..."
- Do NOT reuse any examples, statistics, or case studies from previous chapters
- Maintain the same terminology — if you called something "X" before, call it "X" again
- Stay within the brief's visual apparatus, but do NOT clone the previous chapters'
  exact element mix — this chapter's content decides its own apparatus`;
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

  userPrompt += `\n\nBegin LaTeX output now. Start with \\chapter{${p.chapter.title}}. Write exactly ${targetWords} words (±10%), entirely in ${lang}. Remember: the voice and evidence policy from the AUTHOR BRIEF, no AI filler, visual elements where the brief and the content call for them. NO \\includegraphics. Close every opened environment properly.`;

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

  // ── max_tokens ──
  // Polish LaTeX with tables/commands runs ~3 tokens/word; 6x margin so the
  // model can FINISH the chapter cleanly instead of being cut off mid-table
  // (truncation mid-environment is the #1 cause of broken LaTeX / compile fails).
  const maxTok = Math.max(10000, Math.min(32000, Math.ceil(targetWords * 6)));
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

  // Continue ONLY when the chapter is genuinely short of the REAL page target
  // or visibly truncated — every continuation is a risk of meta-text leakage.
  if ((wc < realTargetWords * 0.8 || !endsCleanly) && p.chapter.targetPages > 2) {
    p.log.warn(
      `Needs continuation: ${wc}/${targetWords} words, endsCleanly=${endsCleanly}`,
    );

    const remainingWords = targetWords - wc;
    const maxTotalWords = Math.round(targetWords * 1.15);

    const contPrompt = `You wrote ${wc} of ${targetWords} target words. Continue writing the remaining ~${remainingWords} words.

⚠️ YOUR ENTIRE RESPONSE IS INSERTED VERBATIM INTO THE PRINTED BOOK.
The FIRST character of your response must already be book content (LaTeX).
ABSOLUTELY NO meta-commentary, no planning notes, no "Looking at...", no
"Let me...", no sentences about what you are going to write — any such text
would be PRINTED in the book and ruin it.

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
      4000,
      Math.min(24000, Math.ceil(remainingWords * 4)),
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
    contLatex = stripMetaCommentary(contLatex);
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
  // 0. Fix box titles — AI sometimes puts title inside body with escaped braces
  // Pattern: \begin{tipbox}\n\textbackslash{}\{Title\textbackslash{}\} → \begin{tipbox}{Title}
  for (const box of ["tipbox", "keyinsight", "warningbox", "examplebox"]) {
    result = result.replace(
      new RegExp(
        `(\\\\begin\\{${box}\\})\\s*\\n\\s*(?:\\\\textbackslash\\{\\})*\\\\\\{(.+?)(?:\\\\textbackslash\\{\\})*\\\\\\}`,
        "g",
      ),
      (_match: string, begin: string, title: string) => {
        const cleanTitle = title.replace(/\\textbackslash\{\}/g, "").trim();
        return `${begin}{${cleanTitle}}`;
      },
    );
  }

  // 0b. Strip orphan \section{} before first \chapter{} (prevents Chapter 0 in TOC)
  const chIdx = result.indexOf("\\chapter{");
  if (chIdx > 0 && /\\section\{/.test(result.substring(0, chIdx))) {
    result = result.substring(chIdx);
  }

  // 0c. Ensure spacing around dashes
  result = result.replace(/([^\s\\{}-])---([^\s\\{}-])/g, "$1 --- $2");
  result = result.replace(/([^\s\\{}-])--([^\s\\{}-])/g, "$1 -- $2");

  // 0d. Fix corrupted \textbackslash{}textless → \textless{}
  result = result.replace(/\\textbackslash\{\}textless/g, "\\textless{}");
  result = result.replace(
    /\\textless\{\}(?:\\textbackslash\{\})*\\?\{(?:\\textbackslash\{\})*\\?\}/g,
    "\\textless{}",
  );

  // 0e. Flatten triple \textbf nesting from table header corruption
  result = result.replace(
    /\\textbf\{\\textbf\{\\textbf\{([^}]*)\}\}\}/g,
    "\\textbf{$1}",
  );

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
  // Remove model self-commentary that leaked into content (esp. from continuations)
  // e.g. "The previous output ended mid-table... Here is the clean continuation..."
  result = result.replace(
    /^.*\b(the previous output|clean continuation|picking up (from|where)|rewriting the (table|remainder|rest)|here is the (clean|corrected|continuation)|ended mid-(table|sentence|environment)|continuing from where|as (requested|instructed))\b.*$/gim,
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

  // ── Structural repairs (PDF + EPUB read this content) ──
  latex = repairControlCharLatex(latex);
  latex = mergeSplitTableHeaders(latex);

  // ── Typographic normalization (PDF + EPUB read this content) ──
  // Straight `"` is an ACTIVE babel character under polish (eats the following
  // space, `" -` becomes an invisible optional hyphen) — normalize to ,,/''/``.
  latex = latex.replace(/(?<![\s\\])"/g, "''");
  latex = latex.replace(/(?<!\\)"(?=\S)/g, language === "pl" ? ",," : "``");
  // A quote CLOSED with ,, (opening mark) → ''
  latex = latex.replace(/([^\s,]),,(?=$|[\s.,;:!?)\]—–-])/gm, "$1''");
  // Number ranges stay tight: "228 -- 229" → "228--229"
  latex = latex.replace(/(\d)\s*---?\s*(\d)/g, "$1--$2");
  latex = latex.replace(/\b([IVX]{1,4})\s+---?\s+([IVX]{1,4})\b/g, "$1--$2");
  // Polish typography: tie single-letter words (a/i/o/u/w/z) to the next
  // word with ~ so they never hang at line ends ("sierotki")
  latex = latex.replace(
    /(^|[\s(~])([aiouwzAIOUWZ])[ \t]+(?=[^\s\\&%—–-])/gm,
    "$1$2~",
  );

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
      model: "claude-sonnet-4-6",
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

/**
 * Backstop against the model "thinking out loud" before book content: drop
 * LEADING paragraphs that read as English planning prose, not LaTeX/book text
 * (e.g. "Looking at what was already written, the chapter has..."). Such a
 * paragraph once shipped, printed, in a Polish cookbook.
 */
function stripMetaCommentary(latex: string): string {
  const paragraphs = latex.split(/\n\s*\n/);
  let firstContent = 0;
  for (const para of paragraphs) {
    const t = para.trim();
    if (!t) {
      firstContent++;
      continue;
    }
    const looksMeta =
      !t.includes("\\") &&
      /\b(I |I'll|I will|I need|I can|Let me|Looking at|Based on|The chapter|This chapter (has|is)|continuing from)\b/i.test(
        t,
      ) &&
      // meta prose is plain ASCII; real book text in PL/DE/etc. has diacritics
      // and even EN book text rarely opens with first-person process talk
      /^[\x00-\x7F]*$/.test(t);
    if (looksMeta) {
      firstContent++;
      continue;
    }
    break;
  }
  return paragraphs.slice(firstContent).join("\n\n");
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
