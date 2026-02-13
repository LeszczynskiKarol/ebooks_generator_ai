import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "../lib/prisma";
import { WORDS_PER_PAGE } from "../lib/types";

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

  console.log(`\n📚 Starting LaTeX generation for "${bookTitle}"`);
  console.log(`   ${chapters.length} chapters, ${project.targetPages} pages\n`);

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
        targetWords: ch.targetPages * WORDS_PER_PAGE,
        status: "PENDING",
      },
      update: {
        title: ch.title,
        targetPages: ch.targetPages,
        targetWords: ch.targetPages * WORDS_PER_PAGE,
        status: "PENDING",
        latexContent: null,
        writerPrompts: null,
        writerResponses: null,
      },
    });
  }

  await prisma.project.update({
    where: { id: projectId },
    data: {
      generationStatus: "GENERATING_CONTENT",
      currentStage: "GENERATING",
      generationProgress: 0,
    },
  });

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

    console.log(
      `  ✍️  Ch ${chapter.number}/${chapters.length}: "${chapter.title}" (${chapter.targetPages}p)...`,
    );
    await prisma.chapter.update({
      where: { id: rec.id },
      data: { status: "GENERATING" },
    });

    try {
      const result = await generateChapterLatex({
        bookTitle,
        bookTopic: project.topic,
        language: project.language,
        stylePreset: project.stylePreset,
        guidelines: project.guidelines || "",
        chapter,
        chapterIndex: i,
        totalChapters: chapters.length,
        previousSummaries,
        lastChapterEnding,
        allChapters: chapters,
      });

      totalTokens += result.tokensUsed;
      previousSummaries.push(
        `Ch${chapter.number} "${chapter.title}": ${result.summary}`,
      );
      lastChapterEnding = result.latexContent.slice(-2000);

      const wordCount = result.latexContent
        .replace(/\\[a-zA-Z]+(\{[^}]*\})?/g, "")
        .split(/\s+/).length;

      await prisma.chapter.update({
        where: { id: rec.id },
        data: {
          latexContent: result.latexContent,
          actualWords: wordCount,
          actualPages: wordCount / WORDS_PER_PAGE,
          status: "LATEX_READY",
          writerPrompts: JSON.stringify(result.prompts),
          writerResponses: JSON.stringify(result.responses),
        },
      });

      await prisma.project.update({
        where: { id: projectId },
        data: { generationProgress: (i + 1) / chapters.length },
      });

      console.log(
        `  ✅ Ch ${chapter.number} — ~${wordCount} words, ${result.tokensUsed} tokens`,
      );
    } catch (error) {
      console.error(`  ❌ Ch ${chapter.number} failed:`, error);
      await prisma.chapter.update({
        where: { id: rec.id },
        data: { status: "ERROR" },
      });
      previousSummaries.push(`Ch${chapter.number}: [failed]`);
    }
  }

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

  console.log(
    `\n📚 LaTeX done. Tokens: ${totalTokens}, ~$${estimatedCost.toFixed(2)}\n📖 Compiling...\n`,
  );

  const { compileBook } = await import("./bookCompiler");
  await compileBook(projectId);

  return { totalTokens, estimatedCost };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Generate single chapter — logs all prompts/responses
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface GenParams {
  bookTitle: string;
  bookTopic: string;
  language: string;
  stylePreset: string;
  guidelines: string;
  chapter: ChapterStructure;
  chapterIndex: number;
  totalChapters: number;
  previousSummaries: string[];
  lastChapterEnding: string;
  allChapters: ChapterStructure[];
}

async function generateChapterLatex(p: GenParams): Promise<{
  latexContent: string;
  tokensUsed: number;
  summary: string;
  prompts: PromptLog[];
  responses: ResponseLog[];
}> {
  const targetWords = p.chapter.targetPages * WORDS_PER_PAGE;
  const lang = getLangName(p.language);
  const prompts: PromptLog[] = [];
  const responses: ResponseLog[] = [];
  const model = "claude-sonnet-4-5";

  const sectionsOutline = p.chapter.sections
    .map(
      (s, i) =>
        `  ${i + 1}. "${s.title}" — ${s.description} (~${s.targetPages * WORDS_PER_PAGE} words)`,
    )
    .join("\n");

  const toc = p.allChapters
    .map(
      (c) =>
        `  ${c.number === p.chapter.number ? "→" : " "} Ch.${c.number}: ${c.title}`,
    )
    .join("\n");

  const systemPrompt = `You are a professional book author outputting LaTeX code.

Book: "${p.bookTitle}" | Topic: ${p.bookTopic} | Language: ${lang} | Style: ${p.stylePreset}
${p.guidelines ? `Guidelines: ${p.guidelines}` : ""}

LATEX OUTPUT RULES:
- Output ONLY the chapter body — NO preamble, NO \\documentclass, NO \\begin{document}
- Start with \\chapter{${p.chapter.title}}
- Use \\section{} for main sections, \\subsection{} for subsections
- Use \\textbf{}, \\textit{}, \\emph{} for formatting
- Use \\begin{itemize}/\\begin{enumerate} for lists
- Use \\begin{quote} for blockquotes, \\footnote{} for footnotes
- Escape special chars: \\%, \\&, \\#, \\$, \\_, \\{, \\}
- Use --- for em-dash, -- for en-dash
- NO undefined custom commands, NO \\usepackage
- ALL text in ${lang}

CONTENT RULES:
- Write ${targetWords}+ words. Critical — do not write less.
- Professional, engaging prose with examples and case studies
- Smooth transitions between sections
- Start with compelling intro paragraph before first \\section{}`;

  let userPrompt = `Write Chapter ${p.chapter.number}/${p.totalChapters}: "${p.chapter.title}"
Description: ${p.chapter.description}

Sections:
${sectionsOutline}

TOC:
${toc}

Target: ${targetWords} words, ${p.chapter.targetPages} pages.`;

  if (p.previousSummaries.length > 0) {
    userPrompt += `\n\nPrevious chapters:\n${p.previousSummaries.map((s) => `- ${s}`).join("\n")}`;
  }
  if (p.lastChapterEnding && p.chapterIndex > 0) {
    userPrompt += `\n\nLast chapter ended:\n"""\n${p.lastChapterEnding.slice(-800)}\n"""\nContinue naturally.`;
  }
  userPrompt += `\n\nOutput LaTeX now. Start: \\chapter{${p.chapter.title}}. Min ${targetWords} words, all ${lang}.`;

  // ── Log prompts ──
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

  const maxTok = Math.max(4096, Math.min(16000, targetWords * 2));

  // ── Main API call ──
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
  if (wc < targetWords * 0.7 && p.chapter.targetPages > 2) {
    console.log(`    ↻ ${wc}/${targetWords} words — continuing...`);

    const contPrompt = `Continue. ${wc}/${targetWords} words written. Write ${targetWords - wc}+ more words. Don't repeat content. Only LaTeX body. ${lang}.`;
    prompts.push({
      step: "continuation",
      role: "continuation",
      content: contPrompt,
      timestamp: ts(),
    });

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

    responses.push({
      step: "continuation",
      content: contLatex,
      inputTokens: cont.usage?.input_tokens || 0,
      outputTokens: cont.usage?.output_tokens || 0,
      model,
      timestamp: ts(),
    });
  }

  // ── Summary call ──
  const summary = await chapterSummary(latex, p.language);

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
      model: "claude-sonnet-4-5",
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
