// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BookForge — Research Service v3
// Global research (book-level) + Per-chapter research
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import axios from "axios";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { createPipelineLogger } from "../lib/logger";
import { createLLMClient } from "../lib/llm";
import { parseLLMJson } from "../lib/llmJson";

const anthropic = createLLMClient();

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || "";
const GOOGLE_CX = process.env.GOOGLE_CX || "";
const SCRAPER_URL = process.env.SCRAPER_URL || "";
const SCRAPER_API_KEY = process.env.SCRAPER_API_KEY || "";

/** Domains to skip during scraping — known to block bots, return PDFs, or have no useful text */
const BLOCKED_DOMAINS = [
  "bip.cke.gov.pl", // WAF blocks bots, always 502
  "youtube.com", // Video — no useful text content
  "www.youtube.com",
  "youtu.be",
];

const LANGUAGE_NAMES: Record<string, string> = {
  pl: "polski",
  en: "English",
  de: "Deutsch",
  es: "español",
  fr: "français",
  it: "italiano",
  pt: "português",
  nl: "Nederlands",
};
const LANGUAGE_CODES: Record<string, string> = {
  pl: "pl",
  en: "en",
  de: "de",
  es: "es",
  fr: "fr",
  it: "it",
  pt: "pt",
  nl: "nl",
};

// ━━━ Public interfaces ━━━

export interface ResearchResult {
  googleQuery: string;
  englishQuery?: string;
  searchResults: Array<{ title: string; link: string; snippet: string }>;
  englishSearchResults?: Array<{
    title: string;
    link: string;
    snippet: string;
  }>;
  allScraped: Array<{
    url: string;
    text: string;
    length: number;
    status: string;
  }>;
  selectedSources: Array<{
    url: string;
    text: string;
    length: number;
    lang: string;
  }>;
  totalSourcesLength: number;
  selectionReasoning?: string;
  researchedAt: string;
}

export interface ChapterResearchResult {
  chapterNumber: number;
  chapterTitle: string;
  queries: string[];
  selectedSources: Array<{
    url: string;
    text: string;
    length: number;
    lang: string;
  }>;
  totalSourcesLength: number;
  researchedAt: string;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GLOBAL RESEARCH (unchanged — runs during structure generation)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Main research pipeline v2 — book-level research.
 * Called during structure generation. Unchanged from original.
 */
export async function conductResearch(
  projectId: string,
): Promise<ResearchResult> {
  const log = createPipelineLogger("RESEARCH", projectId);
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new Error("Project not found");

  log.header("Research Pipeline v2 (Global)", {
    Topic: project.topic,
    Language: project.language,
    Guidelines: (project.guidelines || "none").substring(0, 100),
  });

  if (!hasApiKeys()) {
    log.warn(`Research SKIPPED — missing env vars`);
    log.footer("SUCCESS", "Skipped — no API keys");
    return emptyResearch();
  }

  try {
    // PHASE 1: Simple query in target language
    log.phase(1, "Generate Simple Search Query");
    const queryTimer = log.timer();
    const googleQuery = await generateSimpleQuery(
      project.topic,
      project.language,
      log,
    );
    log.ok(`Query: "${googleQuery}" (${queryTimer()})`);

    // PHASE 2: Google search + scrape ALL
    log.phase(2, "Search & Scrape (target language)");
    const searchTimer = log.timer();
    const searchResults = await searchGoogle(
      googleQuery,
      project.language,
      log,
    );
    log.ok(`Google: ${searchResults.length} results (${searchTimer()})`);

    if (searchResults.length === 0) {
      log.warn("No search results — aborting research");
      log.footer("SUCCESS", "No results found");
      return emptyResearch();
    }

    const scrapeTimer = log.timer();
    const allScraped = await scrapeUrls(
      searchResults.map((r) => r.link),
      log,
    );
    const validScraped = allScraped.filter(
      (r) => r.status === "success" && r.length > 500,
    );
    log.ok(
      `Scraped: ${validScraped.length}/${allScraped.length} valid (${scrapeTimer()})`,
    );

    if (validScraped.length === 0) {
      log.warn("All scraping failed");
      log.footer("SUCCESS", "Scraping failed — Claude knowledge only");
      return emptyResearch();
    }

    // PHASE 3: Claude selects 3-5 best + evaluates quality
    log.phase(3, "Claude Selects Best Sources & Evaluates Quality");
    const selectTimer = log.timer();
    const selection = await claudeSelectAndEvaluate(
      project.topic,
      project.language,
      validScraped,
      log,
    );
    log.ok(
      `Selected ${selection.selectedIndices.length} sources (${selectTimer()})`,
    );

    let selectedSources = selection.selectedIndices.map((idx) => ({
      ...validScraped[idx],
      lang: project.language,
    }));

    // PHASE 4 (conditional): English supplement
    let englishQuery: string | undefined;
    let englishSearchResults:
      | Array<{ title: string; link: string; snippet: string }>
      | undefined;

    if (!selection.sufficient && project.language !== "en") {
      log.phase(4, "English Supplement Search");
      englishQuery = await generateSimpleQuery(project.topic, "en", log);
      const enSearchResults = await searchGoogle(englishQuery, "en", log);

      if (enSearchResults.length > 0) {
        englishSearchResults = enSearchResults;
        const existingUrls = new Set(allScraped.map((s) => s.url));
        const newUrls = enSearchResults
          .map((r) => r.link)
          .filter((u) => !existingUrls.has(u));

        if (newUrls.length > 0) {
          const enScraped = await scrapeUrls(newUrls, log);
          const enValid = enScraped.filter(
            (r) => r.status === "success" && r.length > 500,
          );
          allScraped.push(...enScraped);

          if (enValid.length > 0) {
            const enSelection = await claudeSelectEnglishSupplement(
              project.topic,
              enValid,
              selectedSources,
              log,
            );
            const enSources = enSelection.map((idx) => ({
              ...enValid[idx],
              lang: "en",
            }));
            selectedSources.push(...enSources);
          }
        }
      }
    }

    // FINALIZE
    const totalLength = selectedSources.reduce((sum, s) => sum + s.length, 0);
    const result: ResearchResult = {
      googleQuery,
      englishQuery,
      searchResults,
      englishSearchResults,
      allScraped: allScraped.map((r) => ({
        url: r.url,
        text: "",
        length: r.length,
        status: r.status,
      })),
      selectedSources: selectedSources.map((s) => ({
        url: s.url,
        text: sanitizeText(s.text),
        length: s.length,
        lang: s.lang,
      })),
      totalSourcesLength: totalLength,
      selectionReasoning: selection.reasoning,
      researchedAt: new Date().toISOString(),
    };

    await prisma.project.update({
      where: { id: projectId },
      data: { researchData: JSON.stringify(result) },
    });

    log.footer(
      "SUCCESS",
      `${selectedSources.length} sources, ${totalLength.toLocaleString()} chars`,
    );
    return result;
  } catch (error: any) {
    log.err("Research pipeline failed", error);
    log.footer("ERROR", error.message);
    return emptyResearch();
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PER-CHAPTER RESEARCH (NEW)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface ChapterInfo {
  number: number;
  title: string;
  description: string;
  sections: Array<{ title: string; description: string }>;
}

/**
 * Conduct research for a specific chapter.
 *
 * Flow:
 * 1. Generate 2 targeted queries from chapter title + section descriptions
 * 2. Search & scrape (deduplicate against global URLs)
 * 3. Claude selects 2-3 best sources for THIS chapter
 * 4. Optional English supplement if needed
 * 5. Cache result in chapter.researchData
 */
export async function conductChapterResearch(
  projectId: string,
  chapter: ChapterInfo,
  globalUrls: Set<string>,
  language: string,
  bookTopic: string,
  log: any,
): Promise<ChapterResearchResult> {
  const emptyResult: ChapterResearchResult = {
    chapterNumber: chapter.number,
    chapterTitle: chapter.title,
    queries: [],
    selectedSources: [],
    totalSourcesLength: 0,
    researchedAt: new Date().toISOString(),
  };

  if (!hasApiKeys()) {
    log.step(`  Ch.${chapter.number} research SKIPPED — no API keys`);
    return emptyResult;
  }

  const chLog = {
    step: (msg: string) => log.step(`    [Ch${chapter.number}] ${msg}`),
    ok: (msg: string) => log.ok(`    [Ch${chapter.number}] ${msg}`),
    warn: (msg: string) => log.warn(`    [Ch${chapter.number}] ${msg}`),
    err: (msg: string, e?: any) =>
      log.err(`    [Ch${chapter.number}] ${msg}`, e),
    timer: log.timer,
    api: log.api,
    claudeReq: log.claudeReq,
    claudeRes: log.claudeRes,
  };

  try {
    // ── Step 1: Generate chapter-specific queries ──
    const queries = await generateChapterQueries(
      bookTopic,
      chapter,
      language,
      chLog,
    );
    chLog.ok(`Queries: ${queries.map((q) => `"${q}"`).join(", ")}`);

    // ── Step 2: Search & scrape (deduplicated) ──
    const allScraped: Array<{
      url: string;
      text: string;
      length: number;
      status: string;
    }> = [];

    for (const query of queries) {
      const searchResults = await searchGoogle(query, language, chLog);
      chLog.step(`"${query}" → ${searchResults.length} results`);

      // Filter out URLs already used globally or in this chapter
      const newUrls = searchResults
        .map((r) => r.link)
        .filter(
          (u) => !globalUrls.has(u) && !allScraped.some((s) => s.url === u),
        );

      if (newUrls.length > 0) {
        const scraped = await scrapeUrls(newUrls.slice(0, 5), chLog); // Max 5 per query
        allScraped.push(...scraped);
        // Add to global set so other chapters don't re-scrape
        newUrls.forEach((u) => globalUrls.add(u));
      }

      // Small delay between queries
      await new Promise((r) => setTimeout(r, 300));
    }

    const validScraped = allScraped.filter(
      (r) => r.status === "success" && r.length > 500,
    );
    chLog.ok(
      `Scraped: ${validScraped.length}/${allScraped.length} valid sources`,
    );

    if (validScraped.length === 0) {
      chLog.warn(
        "No valid sources — chapter will use global research + Claude knowledge",
      );
      return emptyResult;
    }

    // ── Step 3: Claude selects 2-3 best for THIS chapter ──
    const selection = await claudeSelectForChapter(
      bookTopic,
      chapter,
      language,
      validScraped,
      chLog,
    );

    let selectedSources = selection.map((idx) => ({
      ...validScraped[idx],
      lang: language,
    }));

    // ── Step 4: English supplement if language != en and sources thin ──
    if (language !== "en" && selectedSources.length < 2) {
      chLog.step("Thin sources — trying English supplement...");
      const enQuery = await generateSimpleQuery(
        `${chapter.title} ${bookTopic}`,
        "en",
        chLog,
      );
      const enResults = await searchGoogle(enQuery, "en", chLog);
      const enNewUrls = enResults
        .map((r) => r.link)
        .filter((u) => !globalUrls.has(u));

      if (enNewUrls.length > 0) {
        const enScraped = await scrapeUrls(enNewUrls.slice(0, 4), chLog);
        const enValid = enScraped.filter(
          (r) => r.status === "success" && r.length > 500,
        );

        if (enValid.length > 0) {
          const enSelection = await claudeSelectForChapter(
            bookTopic,
            chapter,
            "en",
            enValid,
            chLog,
          );
          const enSources = enSelection.map((idx) => ({
            ...enValid[idx],
            lang: "en",
          }));
          selectedSources.push(...enSources);
          enNewUrls.forEach((u) => globalUrls.add(u));
          chLog.ok(`+${enSources.length} English sources added`);
        }
      }
    }

    // ── Finalize ──
    const totalLength = selectedSources.reduce((sum, s) => sum + s.length, 0);
    chLog.ok(
      `Final: ${selectedSources.length} sources, ${totalLength.toLocaleString()} chars`,
    );

    const result: ChapterResearchResult = {
      chapterNumber: chapter.number,
      chapterTitle: chapter.title,
      queries,
      selectedSources: selectedSources.map((s) => ({
        url: s.url,
        text: sanitizeText(s.text),
        length: s.length,
        lang: s.lang,
      })),
      totalSourcesLength: totalLength,
      researchedAt: new Date().toISOString(),
    };

    // Cache in DB
    await prisma.chapter.updateMany({
      where: { projectId, chapterNumber: chapter.number },
      data: { researchData: JSON.stringify(result) },
    });

    return result;
  } catch (error: any) {
    chLog.err("Chapter research failed", error);
    return emptyResult;
  }
}

/**
 * Generate 2 targeted search queries for a specific chapter.
 * Uses chapter title + section descriptions to create focused queries.
 */
async function generateChapterQueries(
  bookTopic: string,
  chapter: ChapterInfo,
  language: string,
  log?: any,
): Promise<string[]> {
  const langName = LANGUAGE_NAMES[language] || "English";
  const sectionsList = chapter.sections
    .map((s) => `- ${s.title}: ${s.description.substring(0, 100)}`)
    .join("\n");

  const prompt = `Generate exactly 2 Google search queries to find SPECIFIC DATA for this book chapter.

BOOK TOPIC: ${bookTopic}
CHAPTER: "${chapter.title}"
CHAPTER DESCRIPTION: ${chapter.description}
SECTIONS:
${sectionsList}

RULES:
- Queries MUST be in ${langName}
- 2-5 words each — simple, direct
- Query 1: focus on the MAIN topic of the chapter
- Query 2: focus on a SPECIFIC subtopic, case study, or data angle
- DO NOT repeat the book topic verbatim — get specific to THIS chapter
- Think: what data/stats/case studies would make this chapter excellent?
- Examples of GOOD queries: "ROI content marketing 2024", "OBI ecommerce SEO case study", "AI copywriting tools pricing"
- Examples of BAD queries: "AI copywriting comprehensive guide best practices overview"

Output ONLY 2 queries, one per line, nothing else:`;

  log?.claudeReq?.("ch-queries", prompt);
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 100,
    temperature: 0.3,
    messages: [{ role: "user", content: prompt }],
  });

  const text =
    message.content[0].type === "text" ? message.content[0].text.trim() : "";
  log?.claudeRes?.("ch-queries", text);

  const queries = text
    .split("\n")
    .map((line) =>
      line
        .replace(/^\d+[\.\)]\s*/, "")
        .replace(/^[-•]\s*/, "")
        .replace(/^["'"]|["'"]$/g, "")
        .replace(/^(Query|Zapytanie)\s*\d*[:：]\s*/i, "")
        .trim(),
    )
    .filter((q) => q.length > 2 && q.length < 80)
    .slice(0, 2);

  // Fallback: generate from chapter title
  if (queries.length === 0) {
    const words = chapter.title.split(/\s+/).slice(0, 4).join(" ");
    return [words];
  }

  return queries;
}

/**
 * Claude selects 2-3 best sources specifically for a chapter.
 */
async function claudeSelectForChapter(
  bookTopic: string,
  chapter: ChapterInfo,
  language: string,
  scraped: Array<{ url: string; text: string; length: number }>,
  log: any,
): Promise<number[]> {
  const PREVIEW_CHARS = 15000;

  const sourcePreviews = scraped
    .map((result, index) => {
      const preview = result.text.substring(0, PREVIEW_CHARS);
      return `── SOURCE ${index} ── ${result.url} (${result.length.toLocaleString()} chars)\n${preview}\n── END ${index} ──`;
    })
    .join("\n\n");

  const sectionsList = chapter.sections.map((s) => s.title).join(", ");

  const prompt = `Select 2-3 BEST sources for this specific book chapter.

BOOK: "${bookTopic}"
CHAPTER: "${chapter.title}" — ${chapter.description}
SECTIONS: ${sectionsList}

Pick sources with the most CONCRETE, USABLE content for THIS chapter:
- Specific numbers, stats, case studies relevant to "${chapter.title}"
- Named companies, tools, or examples that fit the chapter's angle
- Data that the chapter's sections can directly reference

STRICT RELEVANCE FILTER — REJECT sources that:
- Cover a different subject than this chapter (e.g. medical recruitment for a chapter about Polish exam criteria)
- Are only tangentially related (e.g. university admissions when chapter is about exam structure)
- Contain generic/boilerplate content with no specific data for this chapter's topic
- Are advertisements, course listings, or product pages without substantive content

Quality over quantity: return [] if NO source directly addresses this chapter's topic.
It is BETTER to return 0 sources than to include off-topic ones — the chapter has global research as fallback.

AVAILABLE (${scraped.length}):
${sourcePreviews}

Respond with ONLY a JSON array of source numbers (0-indexed), e.g.: [0, 2, 4]
Pick 2-3 sources. Return [] if none are directly relevant.`;

  log?.claudeReq?.("ch-select", prompt);
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 100,
    temperature: 0.2,
    messages: [{ role: "user", content: prompt }],
  });

  const responseText =
    message.content[0].type === "text" ? message.content[0].text.trim() : "[]";
  log?.claudeRes?.("ch-select", responseText);
  log.api?.(
    "claude-sonnet-4-6",
    message.usage?.input_tokens || 0,
    message.usage?.output_tokens || 0,
  );

  const selectionResult = parseLLMJson(responseText, z.array(z.any()), {
    kind: "array",
  });
  if (!selectionResult.ok) return fallbackSelection(scraped);
  // Claude explicitly returned [] — respect it, no fallback
  if (selectionResult.data.length === 0) return [];
  const indices = selectionResult.data
    .map((n: any) => parseInt(n))
    .filter((n: number) => !isNaN(n) && n >= 0 && n < scraped.length);
  return indices.length > 0 ? indices.slice(0, 3) : [];
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Load & Format (updated for chapter-level research)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function loadResearch(
  projectId: string,
): Promise<ResearchResult | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { researchData: true },
  });
  if (!project?.researchData) return null;
  try {
    return JSON.parse(project.researchData) as ResearchResult;
  } catch {
    return null;
  }
}

export async function loadChapterResearch(
  projectId: string,
  chapterNumber: number,
): Promise<ChapterResearchResult | null> {
  const chapter = await prisma.chapter.findUnique({
    where: {
      projectId_chapterNumber: { projectId, chapterNumber },
    },
    select: { researchData: true },
  });
  if (!chapter?.researchData) return null;
  try {
    return JSON.parse(chapter.researchData) as ChapterResearchResult;
  } catch {
    return null;
  }
}

/**
 * Format sources for prompt — works for both global and chapter research.
 */
export function formatSourcesForPrompt(
  research: ResearchResult | ChapterResearchResult | null,
  maxCharsPerSource: number = 25000,
): string {
  if (!research || research.selectedSources.length === 0) return "";

  const sources = research.selectedSources
    .map((s, i) => {
      const text =
        s.text.length > maxCharsPerSource
          ? s.text.substring(0, maxCharsPerSource) + "\n[... TRUNCATED ...]"
          : s.text;
      const langTag = s.lang ? ` [${s.lang.toUpperCase()}]` : "";
      return `\n═══ SOURCE ${i + 1}${langTag}: ${s.url} (${s.length.toLocaleString()} chars) ═══\n\n${text}\n\n═══ END SOURCE ${i + 1} ═══`;
    })
    .join("\n\n");

  return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RESEARCH SOURCES (${research.selectedSources.length} sources, ${research.totalSourcesLength.toLocaleString()} total chars)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${sources}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HOW TO USE THESE SOURCES — THIS IS YOUR COMPETITIVE ADVANTAGE:
- EXTRACT every specific number, percentage, company name, tool name, date, and price
- BUILD your arguments around source data — a claim without a data point is filler
- COMPARE sources when they discuss the same topic — note agreements and contradictions
- SYNTHESIZE insights across sources — don't just summarize each one separately
- ADD your expert interpretation — what do these data points MEAN for the reader?
- NEVER copy text verbatim — rewrite everything in your own voice
- If a source mentions a case study, extract the key metrics and reconstruct it as narrative
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
}

/**
 * Merge global + chapter research into a single formatted block.
 * Chapter-specific sources come first (higher priority).
 */
export function mergeResearchForPrompt(
  globalResearch: ResearchResult | null,
  chapterResearch: ChapterResearchResult | null,
  maxCharsPerSource: number = 30000,
  maxTotalChars: number = 120000, // ~30k tokens — safe limit for research block
): { text: string; hasResearch: boolean } {
  const chapterSources = chapterResearch?.selectedSources || [];
  const globalSources = globalResearch?.selectedSources || [];

  if (chapterSources.length === 0 && globalSources.length === 0) {
    return { text: "", hasResearch: false };
  }

  // Deduplicate: chapter sources take priority, remove global dupes by URL
  const chapterUrls = new Set(chapterSources.map((s) => s.url));
  const dedupedGlobal = globalSources.filter((s) => !chapterUrls.has(s.url));

  // Build combined list: chapter-specific first, then relevant global
  const allSources = [
    ...chapterSources.map((s) => ({ ...s, priority: "CHAPTER-SPECIFIC" })),
    ...dedupedGlobal.map((s) => ({ ...s, priority: "BOOK-LEVEL" })),
  ];

  // Smart budget: distribute maxTotalChars across sources
  // Chapter-specific sources get priority (more chars each)
  const numSources = allSources.length;
  const effectivePerSource = Math.min(
    maxCharsPerSource,
    Math.floor(maxTotalChars / Math.max(1, numSources)),
  );

  let usedChars = 0;
  const sources = allSources
    .map((s, i) => {
      const budget = Math.min(effectivePerSource, maxTotalChars - usedChars);
      if (budget <= 0) return null; // Budget exhausted
      const text =
        s.text.length > budget
          ? s.text.substring(0, budget) + "\n[... TRUNCATED ...]"
          : s.text;
      usedChars += text.length;
      const langTag = s.lang ? ` [${s.lang.toUpperCase()}]` : "";
      const priorityTag =
        s.priority === "CHAPTER-SPECIFIC" ? " ★ CHAPTER-SPECIFIC" : "";
      return `\n═══ SOURCE ${i + 1}${langTag}${priorityTag}: ${s.url} (${s.length.toLocaleString()} chars) ═══\n\n${text}\n\n═══ END SOURCE ${i + 1} ═══`;
    })
    .filter(Boolean)
    .join("\n\n");

  const totalLength = usedChars;

  const text = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RESEARCH SOURCES (${allSources.length} total: ${chapterSources.length} chapter-specific + ${dedupedGlobal.length} book-level)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PRIORITY: Sources marked ★ CHAPTER-SPECIFIC are the most relevant for this chapter.
Use them FIRST. Book-level sources provide broader context.

${sources}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HOW TO USE THESE SOURCES:
- PRIORITIZE ★ CHAPTER-SPECIFIC sources — they were found specifically for this chapter
- EXTRACT every specific number, percentage, company name, tool name, date, and price
- BUILD your arguments around source data — a claim without a data point is filler
- COMPARE sources when they discuss the same topic
- SYNTHESIZE insights across sources — don't just summarize each one separately
- NEVER copy text verbatim — rewrite everything in your own voice
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;

  return { text, hasResearch: true };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Internal: Query generation
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function generateSimpleQuery(
  topic: string,
  language: string,
  log?: any,
): Promise<string> {
  const langName = LANGUAGE_NAMES[language] || "English";

  const prompt = `Generate a simple Google search query for finding articles about this topic.

TOPIC: ${topic}
LANGUAGE: ${langName}

RULES:
- Query MUST be in ${langName}
- 2-4 words MAXIMUM — keep it BROAD
- Use the most basic, common terms for this topic
- Do NOT add qualifiers like "case study", "ROI", "data", "best practices"
- Think: what would a normal person type into Google?
- Output ONLY the query, nothing else

Query:`;

  log?.claudeReq?.("simple-query", prompt);
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 50,
    temperature: 0.2,
    messages: [{ role: "user", content: prompt }],
  });

  let query =
    message.content[0].type === "text" ? message.content[0].text.trim() : topic;
  log?.claudeRes?.("simple-query", query);
  query = query
    .replace(/^(Query|Zapytanie|Recherche|Búsqueda)[:：]\s*/i, "")
    .replace(/^["'"]|["'"]$/g, "")
    .replace(/\n/g, " ")
    .trim();

  const words = query.split(/\s+/);
  if (words.length > 5) query = words.slice(0, 4).join(" ");

  return query;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Internal: Google search
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function searchGoogle(
  query: string,
  language: string,
  log: any,
): Promise<Array<{ title: string; link: string; snippet: string }>> {
  const langCode = LANGUAGE_CODES[language] || "en";
  const allItems: any[] = [];

  for (let start = 1; start <= 11; start += 10) {
    if (allItems.length >= 10) break;
    try {
      log.step?.(`  Google API: start=${start}, hl=${langCode}, q="${query}"`);
      const response = await axios.get(
        "https://www.googleapis.com/customsearch/v1",
        {
          params: {
            key: GOOGLE_API_KEY,
            cx: GOOGLE_CX,
            q: query,
            num: 10,
            hl: langCode,
            start,
          },
          timeout: 10000,
        },
      );
      const items = response.data.items || [];
      log.step?.(`  → ${items.length} results (page ${Math.ceil(start / 10)})`);
      allItems.push(...items);
      if (items.length < 10) break;
      await new Promise((r) => setTimeout(r, 500));
    } catch (error: any) {
      log.err?.(`Google API error: ${error.message}`);
      break;
    }
  }

  return allItems.slice(0, 15).map((item: any) => ({
    title: item.title || "",
    link: item.link || "",
    snippet: item.snippet || "",
  }));
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Internal: Scraping
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function scrapeUrls(
  urls: string[],
  log: any,
): Promise<
  Array<{ url: string; text: string; length: number; status: string }>
> {
  const results: Array<{
    url: string;
    text: string;
    length: number;
    status: string;
  }> = [];
  const MAX_TOTAL = 300000;
  let currentTotal = 0;

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];

    // Skip blocked domains
    try {
      const hostname = new URL(url).hostname;
      if (
        BLOCKED_DOMAINS.some(
          (d) => hostname === d || hostname.endsWith(`.${d}`),
        )
      ) {
        log.warn?.(
          `  ⛔ [${i + 1}/${urls.length}] BLOCKED: ${url.substring(0, 70)}...`,
        );
        results.push({ url, text: "", length: 0, status: "blocked" });
        continue;
      }
    } catch {}

    const timer = log.timer?.();

    try {
      log.step?.(`  🕷️ [${i + 1}/${urls.length}] ${url.substring(0, 70)}...`);
      const response = await axios.post(
        `${SCRAPER_URL}/scrape`,
        { url, paginated: true },
        {
          headers: {
            "Content-Type": "application/json",
            ...(SCRAPER_API_KEY ? { "X-API-Key": SCRAPER_API_KEY } : {}),
          },
          timeout: 20000,
        },
      );

      if (
        response.status === 200 &&
        response.data.text &&
        response.data.text.length > 0
      ) {
        // Paginated PDFs → interleave "=== STRONA N ===" markers so the writer
        // can ground footnotes to a real page and the citation guard can verify
        // them. Non-PDF / unresolved pagination falls back to plain text.
        const d = response.data;
        const rawText =
          Array.isArray(d.pages) && d.page_numbering?.resolved
            ? d.pages
                .map(
                  (pg: { printed_page: number | null; text: string }) =>
                    (pg.printed_page != null
                      ? `=== STRONA ${pg.printed_page} ===\n`
                      : "") + (pg.text || ""),
                )
                .join("\n\n")
                .trim()
            : d.text;
        let text = sanitizeText(rawText);
        const remaining = Math.max(1, urls.length - i);
        const maxForThis = Math.floor((MAX_TOTAL - currentTotal) / remaining);
        if (text.length > maxForThis && maxForThis > 0)
          text = text.substring(0, maxForThis);

        currentTotal += text.length;
        results.push({ url, text, length: text.length, status: "success" });
        log.ok?.(
          `  ${text.length.toLocaleString()} chars (total: ${currentTotal.toLocaleString()}) ${timer?.() || ""}`,
        );
      } else {
        results.push({ url, text: "", length: 0, status: "failed" });
        log.warn?.(
          `  Empty response (HTTP ${response.status}) ${timer?.() || ""}`,
        );
      }

      await new Promise((r) => setTimeout(r, 1500));
    } catch (error: any) {
      results.push({ url, text: "", length: 0, status: "failed" });
      log.err?.(`  Scrape failed: ${error.message} ${timer?.() || ""}`);
    }
  }

  return results;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Internal: Claude source selection
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface SelectionResult {
  selectedIndices: number[];
  sufficient: boolean;
  reasoning: string;
}

async function claudeSelectAndEvaluate(
  topic: string,
  language: string,
  scrapedResults: Array<{ url: string; text: string; length: number }>,
  log: any,
): Promise<SelectionResult> {
  const PREVIEW_CHARS = 20000;

  const sourcePreviews = scrapedResults
    .map((result, index) => {
      const preview = result.text.substring(0, PREVIEW_CHARS);
      return `\n── SOURCE ${index} ── ${result.url} (${result.length.toLocaleString()} chars total)\n${preview}\n── END ${index} ──`;
    })
    .join("\n\n");

  const prompt = `You are a research librarian selecting the BEST sources for writing an expert-level book.

BOOK TOPIC: "${topic}"
LANGUAGE: ${language}

YOUR TASK (two parts):

PART 1 — SELECT 3-5 BEST SOURCES
From the sources below, pick the ones with the most CONCRETE, USABLE content:
- Specific numbers, stats, percentages, benchmarks
- Named case studies with measurable results
- Tool/product comparisons with pricing and features
- Industry data, research findings

PART 2 — EVALUATE QUALITY
Sufficient means:
- At least 2 sources with concrete data/numbers
- At least 1 source with a case study or real-world example
- Sources cover the topic from different angles

AVAILABLE SOURCES (${scrapedResults.length}):
${sourcePreviews}

RESPOND IN THIS EXACT JSON FORMAT (no other text):
{
  "selected": [0, 3, 5],
  "sufficient": true,
  "reasoning": "Brief explanation"
}`;

  log.claudeReq?.("global-select", prompt);
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 500,
    temperature: 0.2,
    messages: [{ role: "user", content: prompt }],
  });

  const responseText =
    message.content[0].type === "text" ? message.content[0].text.trim() : "";
  log.claudeRes?.("global-select", responseText);
  log.api(
    "claude-sonnet-4-6",
    message.usage?.input_tokens || 0,
    message.usage?.output_tokens || 0,
  );

  const globalSelectResult = parseLLMJson(
    responseText,
    z
      .object({
        selected: z.array(z.any()).default([]),
        sufficient: z.boolean().default(true),
        reasoning: z.string().default("No reasoning provided"),
      })
      .passthrough(),
  );
  if (!globalSelectResult.ok) {
    return {
      selectedIndices: fallbackSelection(scrapedResults),
      sufficient: false,
      reasoning: `Parse error (${globalSelectResult.error}) — defaulting to longest sources`,
    };
  }

  const indices = globalSelectResult.data.selected
    .map((n: any) => parseInt(n))
    .filter((n: number) => !isNaN(n) && n >= 0 && n < scrapedResults.length);

  return {
    selectedIndices:
      indices.length > 0 ? indices : fallbackSelection(scrapedResults),
    sufficient: globalSelectResult.data.sufficient,
    reasoning: globalSelectResult.data.reasoning,
  };
}

async function claudeSelectEnglishSupplement(
  topic: string,
  enScraped: Array<{ url: string; text: string; length: number }>,
  existingSources: Array<{ url: string; text: string; length: number }>,
  log: any,
): Promise<number[]> {
  const PREVIEW_CHARS = 20000;

  const existingPreview = existingSources
    .map(
      (s, i) =>
        `Already selected #${i + 1}: ${s.url} (${s.length.toLocaleString()} chars)`,
    )
    .join("\n");

  const newPreviews = enScraped
    .map((result, index) => {
      const preview = result.text.substring(0, PREVIEW_CHARS);
      return `\n── EN SOURCE ${index} ── ${result.url} (${result.length.toLocaleString()} chars)\n${preview}\n── END ${index} ──`;
    })
    .join("\n\n");

  const prompt = `You are supplementing book research with English-language sources.

BOOK TOPIC: "${topic}"

ALREADY SELECTED SOURCES (in target language):
${existingPreview}

Pick 1-3 English sources that ADD NEW INFORMATION not covered by existing sources.

AVAILABLE ENGLISH SOURCES (${enScraped.length}):
${newPreviews}

RESPOND with ONLY a JSON array of source numbers (0-indexed), e.g.: [0, 2]
Pick 1-3 sources. If none add value, respond with: []`;

  log.claudeReq?.("en-supplement", prompt);
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 100,
    temperature: 0.2,
    messages: [{ role: "user", content: prompt }],
  });

  const responseText =
    message.content[0].type === "text" ? message.content[0].text.trim() : "[]";
  log.claudeRes?.("en-supplement", responseText);
  log.api(
    "claude-sonnet-4-6",
    message.usage?.input_tokens || 0,
    message.usage?.output_tokens || 0,
  );

  const supplementResult = parseLLMJson(responseText, z.array(z.any()), {
    kind: "array",
  });
  if (!supplementResult.ok) return [];
  const indices = supplementResult.data
    .map((n: any) => parseInt(n))
    .filter((n: number) => !isNaN(n) && n >= 0 && n < enScraped.length);
  return indices.slice(0, 3);
}

// ━━━ Helpers ━━━

function hasApiKeys(): boolean {
  return !!GOOGLE_API_KEY && !!GOOGLE_CX && !!SCRAPER_URL;
}

function fallbackSelection(scraped: Array<{ length: number }>): number[] {
  return scraped
    .map((r, idx) => ({ idx, length: r.length }))
    .filter((r) => r.length > 1000)
    .sort((a, b) => b.length - a.length)
    .slice(0, 3)
    .map((r) => r.idx);
}

function sanitizeText(text: string): string {
  if (!text) return "";
  return text.replace(/\x00/g, "").replace(/[\x01-\x08\x0B\x0C\x0E-\x1F]/g, "");
}

function emptyResearch(): ResearchResult {
  return {
    googleQuery: "",
    searchResults: [],
    allScraped: [],
    selectedSources: [],
    totalSourcesLength: 0,
    researchedAt: new Date().toISOString(),
  };
}
