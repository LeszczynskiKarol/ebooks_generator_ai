import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "../lib/prisma";
import { getWordsPerPage } from "../lib/types";
import { createPipelineLogger } from "../lib/logger";
import { loadResearch, formatSourcesForPrompt } from "./researchService";

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

  // ── Load research sources ──
  log.phase(1, "Load Research Data");
  const research = await loadResearch(projectId);
  const sourcesText = formatSourcesForPrompt(research, 15000);
  const hasResearch = !!research && research.selectedSources.length > 0;

  if (hasResearch) {
    log.ok(
      `Research loaded: ${research!.selectedSources.length} sources, ${research!.totalSourcesLength.toLocaleString()} chars`,
    );
    log.data("Google query was", `"${research!.googleQuery}"`);
    for (const [i, s] of research!.selectedSources.entries()) {
      log.step(
        `  Source ${i + 1}: ${s.url.substring(0, 70)} (${s.length.toLocaleString()} chars)`,
      );
    }
    log.data(
      "Formatted sources for prompt",
      `${sourcesText.length.toLocaleString()} chars`,
    );
  } else {
    log.warn(
      "No research data — chapters will be generated from Claude's knowledge only",
    );
  }

  // ── Create chapter records ──
  log.phase(2, "Initialize Chapter Records");
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
    log.step(
      `  Ch.${ch.number}: "${ch.title}" — ${ch.targetPages}p, ~${ch.targetPages * wpp}w, ${ch.sections.length} sections`,
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

  // ── Generate chapters ──
  log.phase(3, "Generate Chapter Content");
  const previousSummaries: string[] = [];
  let lastChapterEnding = "";
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
        lastChapterEnding,
        allChapters: chapters,
        sourcesText,
        hasResearch,
        wpp,
        log,
      });

      totalTokens += result.tokensUsed;
      previousSummaries.push(
        `Ch${chapter.number} "${chapter.title}": ${result.summary}`,
      );
      lastChapterEnding = result.latexContent.slice(-2000);

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
      previousSummaries.push(`Ch${chapter.number}: [failed]`);
    }
  }

  // ── Finalize ──
  log.phase(4, "Compilation");
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
  lastChapterEnding: string;
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
- Extract SPECIFIC facts: names, numbers, dates, percentages, tool names, pricing
- Build arguments AROUND source data — don't just mention it, ANALYZE it
- Contrast different sources when they disagree
- Cite companies, products, regulations BY NAME with specifics
- DO NOT copy verbatim — synthesize, compare, and add your expert interpretation
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`
    : ""
}

═══════════════════════════════════════════════════════════════
WRITING QUALITY RULES — READ CAREFULLY
═══════════════════════════════════════════════════════════════

VOICE & TONE:
- Write as a confident practitioner sharing hard-won knowledge, NOT as a lecturer
- Use direct, concise sentences. Prefer "X does Y" over "It is worth noting that X has the capability to do Y"
- Vary sentence length: mix short punchy statements with longer analytical ones
- Address the reader directly with "you" when giving advice
- Show opinions and take positions — experts have viewpoints, not just summaries

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

CONTENT DEPTH — what separates expert content from filler:
- Every claim must have a SPECIFIC example, number, or case study backing it
- BAD: "AI can significantly improve productivity" → GOOD: "Teams using Cursor report 40% faster code reviews, with junior developers seeing the biggest gains"
- BAD: "Many companies are adopting AI" → GOOD: "Shopify cut its workforce by 20% in 2023, with CEO Tobi Lütke stating AI would replace roles, not just assist them"
- When listing tools/methods: include PRICING, LIMITATIONS, and WHEN NOT to use them
- Don't pad with obvious statements. If a section says "email marketing is important" — skip that, go straight to the HOW and WITH WHAT
- Minimum 3 concrete data points per section (numbers, percentages, company names, dates)
- When describing a process, include a realistic scenario: "A 5-person marketing team at a B2B SaaS company generating 12 blog posts/month would..."

STRUCTURE WITHIN SECTIONS:
- Open each section with a specific insight, stat, or contrarian take — NOT a definition
- BAD opening: "Content marketing is a strategic approach..." → GOOD: "The average B2B company wastes 60-70% of its content budget on assets that never get used (SiriusDecisions)"
- Close each section with a practical takeaway or decision framework
- Use \\begin{itemize} sparingly — prefer flowing prose with embedded specifics
- Tables and comparisons are welcome when they ADD information (not just format existing text)
- NEVER pad content with long lists of example prompts, templates, or filler content that the reader could generate themselves

ANTI-FILLER RULES:
- Every paragraph must contain at least one SPECIFIC fact, number, or named example
- If you catch yourself writing a paragraph of pure generalization — delete it and replace with analysis
- Do NOT write "There are many tools available" and then list them — instead, compare their trade-offs
- Do NOT repeat the same point in different words across paragraphs
- Aim for INFORMATION DENSITY: a reader should learn something new in every paragraph

═══════════════════════════════════════════════════════════════

LATEX OUTPUT RULES:
- Output ONLY the chapter body — NO preamble, NO \\documentclass, NO \\begin{document}
- Start with \\chapter{${p.chapter.title}}
- Use \\section{} for main sections, \\subsection{} for subsections
- Use \\textbf{}, \\textit{}, \\emph{} for emphasis (sparingly — not every other sentence)
- Use \\begin{itemize}/\\begin{enumerate} for lists (max 1-2 per section, keep them short)
- Use \\begin{quote} for notable quotes, \\footnote{} for asides
- Escape special chars: \\%, \\&, \\#, \\$, \\_, \\{, \\}
- Use --- for em-dash, -- for en-dash
- NO undefined custom commands, NO \\usepackage
- ALL text in ${lang}
- NEVER leave a section or sentence unfinished — complete every thought`;

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

  if (p.previousSummaries.length > 0) {
    userPrompt += `\n\nPREVIOUS CHAPTERS (avoid repeating these points):\n${p.previousSummaries.map((s) => `- ${s}`).join("\n")}`;
  }
  if (p.lastChapterEnding && p.chapterIndex > 0) {
    userPrompt += `\n\nLAST CHAPTER ENDED WITH:\n"""\n${p.lastChapterEnding.slice(-800)}\n"""\nContinue with a natural transition — don't repeat the ending.`;
  }
  userPrompt += `\n\nBegin LaTeX output now. Start with \\chapter{${p.chapter.title}}. Write exactly ${targetWords} words (±10%), entirely in ${lang}. Remember: expert voice, concrete data, no AI filler.`;

  // ── Log ──
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

  const maxTok = Math.max(4096, Math.min(16000, targetWords * 2));
  p.log.step(`Calling Claude API (max_tokens: ${maxTok})...`);

  // ── Main API call ──
  const apiTimer = p.log.timer();
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

  // ── Continuation if too short ──
  const wc = latex.replace(/\\[a-zA-Z]+(\{[^}]*\})?/g, "").split(/\s+/).length;
  p.log.data(
    "Word count (main)",
    `${wc}/${targetWords} (${Math.round((wc / targetWords) * 100)}%)`,
  );

  if (wc < targetWords * 0.7 && p.chapter.targetPages > 2) {
    p.log.warn(
      `Too short! ${wc}/${targetWords} words — requesting continuation...`,
    );

    const contPrompt = `You wrote ${wc} of ${targetWords} target words. Continue writing the remaining ${targetWords - wc}+ words.

RULES FOR CONTINUATION:
- Pick up EXACTLY where you left off — do NOT repeat any content
- Maintain the same expert voice and quality level
- Add NEW data points, examples, and analysis — don't pad with filler
- Complete any unfinished sections from the outline
- COMPLETE every sentence — never stop mid-thought
- Output only LaTeX body (no preamble). All text in ${lang}.
- Remember: banned AI phrases still apply. Write like a human expert.`;

    prompts.push({
      step: "continuation",
      role: "continuation",
      content: contPrompt,
      timestamp: ts(),
    });

    const contTimer = p.log.timer();
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

  // ── Summary ──
  const summary = await chapterSummary(latex, p.language);
  p.log.step(`Summary: ${summary.substring(0, 100)}...`);

  return {
    latexContent: latex,
    tokensUsed: tokens,
    summary,
    prompts,
    responses,
  };
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

async function chapterSummary(content: string, lang: string): Promise<string> {
  try {
    const plain = content
      .replace(/\\[a-zA-Z]+(\[[^\]]*\])?(\{[^}]*\})?/g, " ")
      .replace(/[{}]/g, "")
      .slice(0, 3000);
    const r = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 200,
      messages: [
        {
          role: "user",
          content: `2-sentence summary in ${getLangName(lang)}:\n\n${plain}`,
        },
      ],
    });
    for (const b of r.content) {
      if (b.type === "text") return b.text;
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
      } as any
    )[c] || "English"
  );
}
