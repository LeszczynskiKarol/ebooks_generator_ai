// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BookForge — Research Service v2
// Simple query → Scrape all → Claude selects best →
// Optional English round if sources insufficient
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import Anthropic from "@anthropic-ai/sdk";
import axios from "axios";
import { prisma } from "../lib/prisma";
import { createPipelineLogger } from "../lib/logger";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || "";
const GOOGLE_CX = process.env.GOOGLE_CX || "";
const SCRAPER_URL = process.env.SCRAPER_URL || "";

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

// ━━━ Public interface ━━━

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

/**
 * Main research pipeline v2.
 *
 * Flow:
 * 1. Generate SIMPLE query in target language (2-4 words)
 * 2. Google search → scrape ALL results
 * 3. Send 20k char previews to Claude → select 3-5 best
 * 4. Claude evaluates: are sources sufficient?
 *    YES → done
 *    NO  → generate English query → search+scrape → Claude picks 1-3 more
 * 5. Return only selected sources
 */
export async function conductResearch(
  projectId: string,
): Promise<ResearchResult> {
  const log = createPipelineLogger("RESEARCH", projectId);
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new Error("Project not found");

  log.header("Research Pipeline v2", {
    Topic: project.topic,
    Language: project.language,
    Guidelines: (project.guidelines || "none").substring(0, 100),
  });

  // Check API keys
  const missingKeys: string[] = [];
  if (!GOOGLE_API_KEY) missingKeys.push("GOOGLE_API_KEY");
  if (!GOOGLE_CX) missingKeys.push("GOOGLE_CX");
  if (!SCRAPER_URL) missingKeys.push("SCRAPER_URL");

  if (missingKeys.length > 0) {
    log.warn(`Research SKIPPED — missing env vars: ${missingKeys.join(", ")}`);
    log.footer("SUCCESS", "Skipped — no API keys");
    return emptyResearch();
  }

  log.ok(
    `API keys: GOOGLE_API_KEY=${GOOGLE_API_KEY.substring(0, 8)}..., CX=${GOOGLE_CX.substring(0, 8)}..., SCRAPER=${SCRAPER_URL.substring(0, 40)}...`,
  );

  try {
    // ════════════════════════════════════════════════════════
    // PHASE 1: Simple query in target language
    // ════════════════════════════════════════════════════════
    log.phase(1, "Generate Simple Search Query");
    const queryTimer = log.timer();
    const googleQuery = await generateSimpleQuery(
      project.topic,
      project.language,
    );
    log.ok(`Query: "${googleQuery}" (${queryTimer()})`);

    // ════════════════════════════════════════════════════════
    // PHASE 2: Google search + scrape ALL
    // ════════════════════════════════════════════════════════
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

    // ════════════════════════════════════════════════════════
    // PHASE 3: Claude selects 3-5 best + evaluates quality
    // ════════════════════════════════════════════════════════
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
    log.data(
      "Quality verdict",
      selection.sufficient
        ? "✅ SUFFICIENT"
        : "❌ INSUFFICIENT — will search English",
    );
    log.data("Reasoning", selection.reasoning.substring(0, 200));

    let selectedSources = selection.selectedIndices.map((idx) => ({
      ...validScraped[idx],
      lang: project.language,
    }));

    for (const [i, s] of selectedSources.entries()) {
      log.step(
        `  ${i + 1}. [${s.lang}] ${s.url.substring(0, 70)} (${s.length.toLocaleString()} chars)`,
      );
    }

    // ════════════════════════════════════════════════════════
    // PHASE 4 (conditional): English supplement
    // ════════════════════════════════════════════════════════
    let englishQuery: string | undefined;
    let englishSearchResults:
      | Array<{ title: string; link: string; snippet: string }>
      | undefined;

    if (!selection.sufficient && project.language !== "en") {
      log.phase(4, "English Supplement Search");

      const enQueryTimer = log.timer();
      englishQuery = await generateSimpleQuery(project.topic, "en");
      log.ok(`English query: "${englishQuery}" (${enQueryTimer()})`);

      const enSearchTimer = log.timer();
      englishSearchResults = await searchGoogle(englishQuery, "en", log);
      log.ok(
        `Google EN: ${englishSearchResults.length} results (${enSearchTimer()})`,
      );

      if (englishSearchResults.length > 0) {
        // Filter out URLs we already scraped
        const existingUrls = new Set(allScraped.map((s) => s.url));
        const newUrls = englishSearchResults
          .map((r) => r.link)
          .filter((u) => !existingUrls.has(u));
        log.step(
          `New URLs to scrape: ${newUrls.length} (filtered ${englishSearchResults.length - newUrls.length} duplicates)`,
        );

        if (newUrls.length > 0) {
          const enScrapeTimer = log.timer();
          const enScraped = await scrapeUrls(newUrls, log);
          const enValid = enScraped.filter(
            (r) => r.status === "success" && r.length > 500,
          );
          log.ok(
            `EN Scraped: ${enValid.length}/${enScraped.length} valid (${enScrapeTimer()})`,
          );

          // Add to allScraped for reference
          allScraped.push(...enScraped);

          if (enValid.length > 0) {
            const enSelectTimer = log.timer();
            const enSelection = await claudeSelectEnglishSupplement(
              project.topic,
              enValid,
              selectedSources,
              log,
            );
            log.ok(
              `EN supplement: +${enSelection.length} sources (${enSelectTimer()})`,
            );

            const enSources = enSelection.map((idx) => ({
              ...enValid[idx],
              lang: "en",
            }));

            for (const s of enSources) {
              log.step(
                `  + [en] ${s.url.substring(0, 70)} (${s.length.toLocaleString()} chars)`,
              );
            }

            selectedSources.push(...enSources);
          }
        }
      }
    } else if (project.language === "en") {
      log.step("Language is already English — skipping supplement");
    } else {
      log.step("Sources sufficient — skipping English supplement");
    }

    // ════════════════════════════════════════════════════════
    // FINALIZE
    // ════════════════════════════════════════════════════════
    const totalLength = selectedSources.reduce((sum, s) => sum + s.length, 0);
    log.data(
      "Final sources",
      `${selectedSources.length} (${selectedSources.filter((s) => s.lang !== "en").length} native + ${selectedSources.filter((s) => s.lang === "en").length} English)`,
    );
    log.data("Total content", `${totalLength.toLocaleString()} chars`);

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

    log.step("Saving research data to database...");
    await prisma.project.update({
      where: { id: projectId },
      data: { researchData: JSON.stringify(result) },
    });
    log.ok("Saved to project.researchData");

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
// Load & Format (unchanged public API)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function loadResearch(
  projectId: string,
): Promise<ResearchResult | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { researchData: true },
  });
  if (!project?.researchData) {
    console.log(
      `  📚 [RESEARCH] No researchData in DB for project ${projectId.substring(0, 8)}`,
    );
    return null;
  }
  try {
    const data = JSON.parse(project.researchData) as ResearchResult;
    console.log(
      `  📚 [RESEARCH] Loaded: ${data.selectedSources.length} sources, ${data.totalSourcesLength.toLocaleString()} chars, query: "${data.googleQuery}"${data.englishQuery ? ` + EN: "${data.englishQuery}"` : ""}`,
    );
    return data;
  } catch (err) {
    console.log(`  📚 [RESEARCH] Failed to parse researchData: ${err}`);
    return null;
  }
}

export function formatSourcesForPrompt(
  research: ResearchResult | null,
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
Query: "${research.googleQuery}"${research.englishQuery ? ` | EN: "${research.englishQuery}"` : ""}
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

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Internal: Query generation
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function generateSimpleQuery(
  topic: string,
  language: string,
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
- Examples of GOOD queries: "storytelling copywriting", "AI marketing tools", "SEO optimization 2025"
- Examples of BAD queries: "storytelling copywriting case study ROI conversion data analysis"
- Output ONLY the query, nothing else

Query:`;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 50,
    temperature: 0.2,
    messages: [{ role: "user", content: prompt }],
  });

  let query =
    message.content[0].type === "text" ? message.content[0].text.trim() : topic;
  query = query
    .replace(/^(Query|Zapytanie|Recherche|Búsqueda)[:：]\s*/i, "")
    .replace(/^["'"]|["'"]$/g, "")
    .replace(/\n/g, " ")
    .trim();

  // Hard limit: max 5 words
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
      log.step(`  Google API: start=${start}, hl=${langCode}, q="${query}"`);
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
      log.step(`  → ${items.length} results (page ${Math.ceil(start / 10)})`);
      allItems.push(...items);
      if (items.length < 10) break;
      await new Promise((r) => setTimeout(r, 500));
    } catch (error: any) {
      log.err(`Google API error: ${error.message}`);
      if (error.response)
        log.err(
          `  HTTP ${error.response.status}: ${error.response.data?.error?.message || ""}`,
        );
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
    const timer = log.timer();

    try {
      log.step(`  🕷️ [${i + 1}/${urls.length}] ${url.substring(0, 70)}...`);
      const response = await axios.post(
        `${SCRAPER_URL}/scrape`,
        { url },
        { headers: { "Content-Type": "application/json" }, timeout: 120000 },
      );

      if (
        response.status === 200 &&
        response.data.text &&
        response.data.text.length > 0
      ) {
        let text = sanitizeText(response.data.text);
        const remaining = Math.max(1, urls.length - i);
        const maxForThis = Math.floor((MAX_TOTAL - currentTotal) / remaining);
        if (text.length > maxForThis && maxForThis > 0)
          text = text.substring(0, maxForThis);

        currentTotal += text.length;
        results.push({ url, text, length: text.length, status: "success" });
        log.ok(
          `  ${text.length.toLocaleString()} chars (total: ${currentTotal.toLocaleString()}) ${timer()}`,
        );
      } else {
        results.push({ url, text: "", length: 0, status: "failed" });
        log.warn(`  Empty response (HTTP ${response.status}) ${timer()}`);
      }

      await new Promise((r) => setTimeout(r, 1500));
    } catch (error: any) {
      results.push({ url, text: "", length: 0, status: "failed" });
      log.err(`  Scrape failed: ${error.message} ${timer()}`);
    }
  }

  return results;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Internal: Claude source selection + quality evaluation
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

  log.step(
    `Sending ${scrapedResults.length} sources to Claude (${sourcePreviews.length.toLocaleString()} chars preview)...`,
  );

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
- Expert analysis (not generic overviews)

REJECT sources that are:
- Generic "what is X" intro articles
- Mostly ads or navigation text
- Thin content (<500 useful words)
- Paywalled / 403 / error pages
- Duplicate of another source

PART 2 — EVALUATE QUALITY
After selecting, evaluate: Do these 3-5 sources provide ENOUGH depth to write an expert-level book chapter?

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
  "reasoning": "Brief explanation: why these sources, and whether they provide enough depth. If insufficient, explain what's missing."
}

Remember: "selected" values are the SOURCE NUMBERS (0-indexed) from above.`;

  const timer = log.timer();
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 500,
    temperature: 0.2,
    messages: [{ role: "user", content: prompt }],
  });

  const responseText =
    message.content[0].type === "text" ? message.content[0].text.trim() : "";
  log.api(
    "claude-sonnet-4-5",
    message.usage?.input_tokens || 0,
    message.usage?.output_tokens || 0,
  );
  log.step(`Claude response (${timer()}): ${responseText.substring(0, 300)}`);

  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in response");
    const parsed = JSON.parse(jsonMatch[0]);

    const indices = (parsed.selected || [])
      .map((n: any) => parseInt(n))
      .filter((n: number) => !isNaN(n) && n >= 0 && n < scrapedResults.length);

    return {
      selectedIndices:
        indices.length > 0 ? indices : fallbackSelection(scrapedResults),
      sufficient: parsed.sufficient !== false, // default true if missing
      reasoning: parsed.reasoning || "No reasoning provided",
    };
  } catch (err: any) {
    log.warn(`Failed to parse Claude response: ${err.message}`);
    return {
      selectedIndices: fallbackSelection(scrapedResults),
      sufficient: false,
      reasoning:
        "Parse error — defaulting to longest sources, marking as insufficient",
    };
  }
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

  log.step(
    `Sending ${enScraped.length} EN sources to Claude for supplement selection...`,
  );

  const prompt = `You are supplementing book research with English-language sources.

BOOK TOPIC: "${topic}"

ALREADY SELECTED SOURCES (in target language):
${existingPreview}

YOUR TASK: Pick 1-3 English sources that ADD NEW INFORMATION not covered by existing sources.
Prioritize:
- Data/stats not found in existing sources
- Different perspective or angle
- More recent or authoritative information
- Case studies from international markets

AVAILABLE ENGLISH SOURCES (${enScraped.length}):
${newPreviews}

RESPOND with ONLY a JSON array of source numbers (0-indexed), e.g.: [0, 2]
Pick 1-3 sources. If none add value, respond with: []`;

  const timer = log.timer();
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 100,
    temperature: 0.2,
    messages: [{ role: "user", content: prompt }],
  });

  const responseText =
    message.content[0].type === "text" ? message.content[0].text.trim() : "[]";
  log.api(
    "claude-sonnet-4-5",
    message.usage?.input_tokens || 0,
    message.usage?.output_tokens || 0,
  );
  log.step(`EN supplement response (${timer()}): ${responseText}`);

  try {
    const jsonMatch = responseText.match(/\[[\s\S]*?\]/);
    if (!jsonMatch) return [];
    const indices = JSON.parse(jsonMatch[0])
      .map((n: any) => parseInt(n))
      .filter((n: number) => !isNaN(n) && n >= 0 && n < enScraped.length);
    return indices.slice(0, 3);
  } catch {
    log.warn("Failed to parse EN supplement response — skipping");
    return [];
  }
}

// ━━━ Helpers ━━━

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
