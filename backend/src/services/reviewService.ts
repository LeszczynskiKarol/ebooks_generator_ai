// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BookForge — Book Review & Revision Service
// Post-generation quality pass: review → targeted edits
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import Anthropic from "@anthropic-ai/sdk";
import { createPipelineLogger } from "../lib/logger";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Models ──
const REVIEW_MODEL = "claude-haiku-4-5"; // cheap — review & scoring
const REVISION_MODEL = "claude-sonnet-4-5"; // quality — content generation

// ── Interfaces ──

interface ReviewResult {
  missing_topics: string[];
  redundancies: Array<{ chapters: number[]; description: string }>;
  removals: Array<{ chapter: number; description: string }>;
  score: number; // 1-10
  needs_revision: boolean;
  summary: string;
}

interface InsertEdit {
  target_chapter: number;
  insert_after: string; // unique LaTeX string to locate insertion point
  new_content: string; // LaTeX to insert
}

interface RemovalEdit {
  target_chapter: number;
  remove_start: string; // unique LaTeX string marking start of section to remove
  remove_end: string; // unique LaTeX string marking end of section to remove
}

interface ChapterData {
  number: number;
  title: string;
  latex: string;
}

interface ReviewStats {
  reviewTokens: number;
  revisionTokens: number;
  editsApplied: number;
  originalScore: number;
  finalScore: number;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Main entry — call this from contentGenerator.ts
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function reviewAndReviseBook(
  chapters: ChapterData[],
  bookTopic: string,
  bookTitle: string,
  guidelines: string,
  language: string,
  log: ReturnType<typeof createPipelineLogger>,
): Promise<{ chapters: ChapterData[]; stats: ReviewStats }> {
  const stats: ReviewStats = {
    reviewTokens: 0,
    revisionTokens: 0,
    editsApplied: 0,
    originalScore: 0,
    finalScore: 0,
  };

  // ── Step 1: Review ──
  log.step("📋 Reviewing book completeness...");
  const reviewTimer = log.timer();

  const review = await reviewBook(
    chapters,
    bookTopic,
    bookTitle,
    guidelines,
    language,
    log,
  );
  stats.originalScore = review.score;
  stats.reviewTokens += review._tokens || 0;

  log.ok(`Review score: ${review.score}/10 (${reviewTimer()})`);
  log.step(
    `  Missing topics: ${review.missing_topics.length > 0 ? review.missing_topics.join(", ") : "none"}`,
  );
  log.step(`  Redundancies: ${review.redundancies.length}`);
  log.step(`  Suggested removals: ${review.removals.length}`);

  // ── Early exit if score is good enough ──
  if (!review.needs_revision || review.score >= 8) {
    log.ok(`Score ${review.score}/10 — no revision needed`);
    stats.finalScore = review.score;
    return { chapters, stats };
  }

  log.step("✏️  Starting targeted revisions...");

  // ── Step 2: Handle removals (redundant content) ──
  for (const removal of review.removals.slice(0, 3)) {
    // Max 3 removals to avoid over-editing
    const ch = chapters.find((c) => c.number === removal.chapter);
    if (!ch) continue;

    log.step(
      `  🗑️  Removing from Ch.${removal.chapter}: ${removal.description.substring(0, 60)}...`,
    );
    const removalResult = await generateRemoval(
      ch,
      removal.description,
      language,
      log,
    );
    stats.revisionTokens += removalResult._tokens || 0;

    if (removalResult.remove_start && removalResult.remove_end) {
      const startIdx = ch.latex.indexOf(removalResult.remove_start);
      const endIdx = ch.latex.indexOf(removalResult.remove_end);

      if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
        ch.latex =
          ch.latex.substring(0, startIdx) +
          ch.latex.substring(endIdx + removalResult.remove_end.length);
        stats.editsApplied++;
        log.ok(`    Removed ${endIdx - startIdx} chars`);
      } else {
        log.warn(`    Could not locate removal boundaries — skipping`);
      }
    }
  }

  // ── Step 3: Handle missing topics (insert new content) ──
  for (const missingTopic of review.missing_topics.slice(0, 3)) {
    // Max 3 additions
    log.step(`  ➕ Adding: "${missingTopic}"...`);
    const insertTimer = log.timer();

    const edit = await generateInsertion(
      chapters,
      missingTopic,
      bookTopic,
      bookTitle,
      language,
      log,
    );
    stats.revisionTokens += edit._tokens || 0;

    if (!edit.insert_after || !edit.new_content) {
      log.warn(`    Claude returned empty edit — skipping`);
      continue;
    }

    const targetCh = chapters.find((c) => c.number === edit.target_chapter);
    if (!targetCh) {
      log.warn(
        `    Target chapter ${edit.target_chapter} not found — skipping`,
      );
      continue;
    }

    // Find the insertion point
    const insertIdx = targetCh.latex.indexOf(edit.insert_after);
    if (insertIdx === -1) {
      // Fallback: try to insert before the last \section or at the end
      log.warn(
        `    Could not find "${edit.insert_after.substring(0, 40)}..." — appending to chapter end`,
      );
      targetCh.latex += "\n\n" + edit.new_content;
    } else {
      targetCh.latex =
        targetCh.latex.substring(0, insertIdx + edit.insert_after.length) +
        "\n\n" +
        edit.new_content +
        "\n\n" +
        targetCh.latex.substring(insertIdx + edit.insert_after.length);
    }

    stats.editsApplied++;
    const wcAdded = edit.new_content.split(/\s+/).length;
    log.ok(
      `    +${wcAdded} words in Ch.${edit.target_chapter} (${insertTimer()})`,
    );
  }

  // ── Step 4: Post-revision score ──
  if (stats.editsApplied > 0) {
    const postReview = await reviewBook(
      chapters,
      bookTopic,
      bookTitle,
      guidelines,
      language,
      log,
    );
    stats.finalScore = postReview.score;
    stats.reviewTokens += postReview._tokens || 0;
    log.ok(
      `Post-revision score: ${postReview.score}/10 (was ${stats.originalScore}/10)`,
    );
  } else {
    stats.finalScore = stats.originalScore;
    log.step("No edits applied — score unchanged");
  }

  return { chapters, stats };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Step 1: Review
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function reviewBook(
  chapters: ChapterData[],
  bookTopic: string,
  bookTitle: string,
  guidelines: string,
  language: string,
  log: any,
): Promise<ReviewResult & { _tokens: number }> {
  const langName = getLangName(language);

  // Build a readable text version (strip heavy LaTeX markup for cheaper review)
  const bookText = chapters
    .map((ch) => {
      const cleanText = ch.latex
        .replace(
          /\\begin\{(tipbox|keyinsight|warningbox|examplebox)\}\{[^}]*\}/g,
          "\n[BOX: ",
        )
        .replace(/\\end\{(tipbox|keyinsight|warningbox|examplebox)\}/g, "]\n")
        .replace(
          /\\begin\{(table|tabularx|tabular)\}[^]*?\\end\{(table|tabularx|tabular)\}/g,
          "[TABLE]",
        )
        .replace(/\\(chapter|section|subsection)\{([^}]*)\}/g, "\n## $2\n")
        .replace(/\\textbf\{([^}]*)\}/g, "$1")
        .replace(/\\textit\{([^}]*)\}/g, "$1")
        .replace(/\\emph\{([^}]*)\}/g, "$1")
        .replace(/\\footnote\{[^}]*\}/g, "")
        .replace(/\\[a-zA-Z]+/g, "")
        .replace(/[{}]/g, "")
        .replace(/\n{3,}/g, "\n\n");
      return `═══ CHAPTER ${ch.number}: "${ch.title}" ═══\n${cleanText}`;
    })
    .join("\n\n");

  const prompt = `You are an expert book editor reviewing a completed eBook.

BOOK: "${bookTitle}"
TOPIC: ${bookTopic}
LANGUAGE: ${langName}
${guidelines ? `AUTHOR GUIDELINES: ${guidelines}` : ""}

TASK: Review the complete book text below and evaluate its quality.

EVALUATE:
1. COMPLETENESS — Does it cover all essential subtopics a reader would expect? What's missing?
2. REDUNDANCY — Are there sections that repeat the same information across chapters?
3. OFF-TOPIC CONTENT — Is there anything that doesn't belong?
4. OPENING & CLOSING — Does the book have a strong start and satisfying conclusion?
5. PRACTICAL VALUE — Would a reader find this actionable and useful?

SCORING (1-10):
- 9-10: Excellent, publish-ready
- 7-8: Good, minor gaps only
- 5-6: Decent, notable missing topics
- 1-4: Major problems

RULES:
- missing_topics: Only list topics that are ESSENTIAL for the reader. Max 3 topics.
- redundancies: Only flag if the SAME specific point is made in 2+ chapters
- removals: Only flag truly off-topic or redundant content worth removing
- needs_revision: true if score < 8 AND there are actionable improvements
- Be strict but fair — a 35-page ebook can't cover everything

RESPOND ONLY with valid JSON (no markdown, no commentary):
{
  "missing_topics": ["topic1", "topic2"],
  "redundancies": [{"chapters": [1, 2], "description": "Both chapters explain X"}],
  "removals": [{"chapter": 1, "description": "Section about Y is off-topic"}],
  "score": 7,
  "needs_revision": true,
  "summary": "Brief 1-sentence assessment"
}`;

  const response = await anthropic.messages.create({
    model: REVIEW_MODEL,
    max_tokens: 800,
    temperature: 0.2,
    messages: [
      {
        role: "user",
        content: `${prompt}\n\n━━━ BOOK TEXT ━━━\n\n${bookText}`,
      },
    ],
  });

  const text =
    response.content[0].type === "text"
      ? response.content[0].text.trim()
      : "{}";
  const tokens =
    (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0);

  log.api?.(
    REVIEW_MODEL,
    response.usage?.input_tokens || 0,
    response.usage?.output_tokens || 0,
  );

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in review response");
    const parsed = JSON.parse(jsonMatch[0]);

    return {
      missing_topics: (parsed.missing_topics || []).slice(0, 3),
      redundancies: parsed.redundancies || [],
      removals: (parsed.removals || []).slice(0, 3),
      score: Math.min(10, Math.max(1, parseInt(parsed.score) || 7)),
      needs_revision: parsed.needs_revision ?? false,
      summary: parsed.summary || "",
      _tokens: tokens,
    };
  } catch (err: any) {
    log.warn(`Review JSON parse failed: ${err.message}`);
    return {
      missing_topics: [],
      redundancies: [],
      removals: [],
      score: 7,
      needs_revision: false,
      summary: "Review parse error — skipping revision",
      _tokens: tokens,
    };
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Step 2: Generate insertion for a missing topic
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function generateInsertion(
  chapters: ChapterData[],
  missingTopic: string,
  bookTopic: string,
  bookTitle: string,
  language: string,
  log: any,
): Promise<InsertEdit & { _tokens: number }> {
  const langName = getLangName(language);

  // Build chapter overview (titles + section headers only — keep prompt small)
  const chaptersOverview = chapters
    .map((ch) => {
      const sections = (ch.latex.match(/\\section\{([^}]*)\}/g) || [])
        .map((s) => s.replace(/\\section\{([^}]*)\}/, "  - $1"))
        .join("\n");
      return `Ch.${ch.number}: "${ch.title}"\n${sections}`;
    })
    .join("\n\n");

  // Find the last \end{keyinsight} or \end{section} in each chapter for insertion candidates
  const insertionPoints = chapters.map((ch) => {
    // Try to find the last keyinsight box end (natural section boundary)
    const keyinsightMatches = [...ch.latex.matchAll(/\\end\{keyinsight\}/g)];
    if (keyinsightMatches.length > 0) {
      const lastMatch = keyinsightMatches[keyinsightMatches.length - 1];
      const context = ch.latex.substring(
        Math.max(0, lastMatch.index! - 100),
        lastMatch.index! + 20,
      );
      return { chapter: ch.number, marker: "\\end{keyinsight}", context };
    }
    return { chapter: ch.number, marker: null, context: "" };
  });

  const prompt = `You are writing a MISSING section for an eBook.

BOOK: "${bookTitle}" | TOPIC: ${bookTopic} | LANGUAGE: ${langName}

THE BOOK HAS THESE CHAPTERS:
${chaptersOverview}

MISSING TOPIC TO ADD: "${missingTopic}"

YOUR TASK:
1. Decide which chapter this topic BEST fits into
2. Write a new \\subsection{} covering this topic (~150-300 words)
3. Identify a UNIQUE string from the target chapter's LaTeX to insert AFTER

WRITING RULES:
- Write in ${langName}
- Use the same LaTeX conventions: \\subsection{}, \\textbf{}, \\textit{}
- Include at least 1 concrete example, number, or named reference
- You can use \\begin{tipbox}{Title}...\\end{tipbox} or \\begin{warningbox}{Title}...\\end{warningbox}
- Do NOT include \\chapter{} or \\section{} — only \\subsection{} level
- Content must be self-contained but fit naturally into the chapter flow

RESPOND ONLY with valid JSON:
{
  "target_chapter": 2,
  "insert_after": "\\\\end{keyinsight}",
  "reasoning": "This topic fits in chapter 2 because...",
  "new_content": "\\\\subsection{Title}\\n\\nContent here..."
}

CRITICAL:
- insert_after must be a VERBATIM string that appears EXACTLY ONCE in the target chapter
- Prefer inserting after \\end{keyinsight} or \\end{tipbox} boundaries
- Escape backslashes in JSON: use \\\\ for LaTeX backslash
- new_content must be complete, valid LaTeX (all environments closed)`;

  const response = await anthropic.messages.create({
    model: REVISION_MODEL,
    max_tokens: 2000,
    temperature: 0.3,
    messages: [{ role: "user", content: prompt }],
  });

  const text =
    response.content[0].type === "text"
      ? response.content[0].text.trim()
      : "{}";
  const tokens =
    (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0);

  log.api?.(
    REVISION_MODEL,
    response.usage?.input_tokens || 0,
    response.usage?.output_tokens || 0,
  );

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON");
    const parsed = JSON.parse(jsonMatch[0]);

    // Unescape the LaTeX content from JSON
    const newContent = (parsed.new_content || "")
      .replace(/\\\\(?=[a-zA-Z])/g, "\\") // \\section → \section
      .replace(/\\n/g, "\n"); // literal \n → newline

    const insertAfter = (parsed.insert_after || "").replace(/\\\\/g, "\\");

    return {
      target_chapter: parseInt(parsed.target_chapter) || 1,
      insert_after: insertAfter,
      new_content: newContent,
      _tokens: tokens,
    };
  } catch (err: any) {
    log.warn(`Insertion JSON parse failed: ${err.message}`);
    return {
      target_chapter: 1,
      insert_after: "",
      new_content: "",
      _tokens: tokens,
    };
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Step 3: Generate removal boundaries for redundant content
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function generateRemoval(
  chapter: ChapterData,
  removalDescription: string,
  language: string,
  log: any,
): Promise<RemovalEdit & { _tokens: number }> {
  const prompt = `You need to identify the EXACT boundaries of content to remove from a LaTeX chapter.

CHAPTER ${chapter.number}: "${chapter.title}"
WHAT TO REMOVE: ${removalDescription}

Find two UNIQUE strings from the LaTeX that mark the START and END of the content to remove.

RULES:
- remove_start: First few words of the paragraph/section to remove (must be unique in the text)
- remove_end: Last few words + closing command of the content to remove
- Be PRECISE — only mark the redundant/off-topic content, not surrounding material
- Include enough context (20-40 chars) to ensure uniqueness

RESPOND ONLY with valid JSON:
{
  "remove_start": "exact string from LaTeX",
  "remove_end": "exact string from LaTeX",
  "chars_to_remove": 500
}

CHAPTER LATEX:
${chapter.latex.substring(0, 15000)}`;

  const response = await anthropic.messages.create({
    model: REVIEW_MODEL, // Haiku is enough for locating text
    max_tokens: 300,
    temperature: 0.1,
    messages: [{ role: "user", content: prompt }],
  });

  const text =
    response.content[0].type === "text"
      ? response.content[0].text.trim()
      : "{}";
  const tokens =
    (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0);

  log.api?.(
    REVIEW_MODEL,
    response.usage?.input_tokens || 0,
    response.usage?.output_tokens || 0,
  );

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON");
    const parsed = JSON.parse(jsonMatch[0]);

    return {
      target_chapter: chapter.number,
      remove_start: parsed.remove_start || "",
      remove_end: parsed.remove_end || "",
      _tokens: tokens,
    };
  } catch {
    return {
      target_chapter: chapter.number,
      remove_start: "",
      remove_end: "",
      _tokens: tokens,
    };
  }
}

// ━━━ Helpers ━━━

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
