// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BookForge — Structure Generator
// Research → Structure generation with real-world data
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { createLLMClient } from "../lib/llm";
import { prisma } from "../lib/prisma";
import { getWordsPerPage, getPageSizeTier } from "../lib/types";
import { createPipelineLogger } from "../lib/logger";
import { conductResearch, formatSourcesForPrompt } from "./researchService";
import {
  getOrCreateAuthorBrief,
  formatBriefForPrompt,
  BookBrief,
} from "./briefGenerator";
import {
  resolveNumbering,
  formatNumberingForPrompt,
  NumberingSpec,
} from "../lib/numbering";
import {
  parseLLMJson,
  repairTruncatedJson,
  BookStructureSchema,
} from "../lib/llmJson";

const anthropic = createLLMClient();

export async function generateStructure(projectId: string) {
  const log = createPipelineLogger("STRUCTURE", projectId);
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new Error("Project not found");

  log.header("Structure Generation Pipeline", {
    Topic: project.topic,
    Title: project.title || "(auto-generate)",
    Pages: `${project.targetPages} (${project.bookFormat})`,
    Language: project.language,
    Style: project.stylePreset,
    Guidelines: (project.guidelines || "none").substring(0, 100),
  });

  await prisma.project.update({
    where: { id: projectId },
    data: { generationStatus: "GENERATING_STRUCTURE" },
  });

  // ━━━ Phase 1: Conduct research ━━━
  log.phase(1, "Web Research");
  const researchTimer = log.timer();
  const research = await conductResearch(projectId);
  const sourcesText = formatSourcesForPrompt(research, 20000);
  const hasResearch = research.selectedSources.length > 0;

  if (hasResearch) {
    log.ok(
      `Research complete: ${research.selectedSources.length} sources, ${research.totalSourcesLength.toLocaleString()} chars (${researchTimer()})`,
    );
  } else {
    log.warn(
      `No research sources available — using Claude knowledge only (${researchTimer()})`,
    );
  }

  // ━━━ Phase 1.5: Author brief — the creative contract for this book ━━━
  log.phase(1.5, "Author Brief");
  const briefTimer = log.timer();
  const brief = await getOrCreateAuthorBrief(
    project,
    formatSourcesForPrompt(research, 8000),
    log,
  );
  log.ok(`Author brief ready (${briefTimer()})`);
  // The brief was just (re)generated or loaded — resolve numbering against
  // the persisted JSON so a project-level override still wins.
  const numbering = resolveNumbering({
    ...project,
    authorBrief: project.authorBrief || JSON.stringify(brief),
  });
  log.data("Numbering", `${numbering.mode}${numbering.itemLabel ? ` (${numbering.itemLabel}${numbering.itemCount ? ` × ${numbering.itemCount}` : ""})` : ""} — from ${numbering.source}`);

  // ━━━ Phase 2: Generate structure ━━━
  log.phase(2, "Claude Structure Generation");

  const tier = getPageSizeTier(project.targetPages);
  const wpp = getWordsPerPage(project.bookFormat);
  const totalWords = project.targetPages * wpp;

  // Draft-based structure: the chapter count EMERGES from the material the
  // model drafts, not from the tier. We only pass a soft typical range so the
  // draft stays proportional to the page budget.
  const chLo = Math.min(10, Math.max(3, Math.round(project.targetPages / 18)));
  const chHi = Math.min(14, Math.max(chLo + 1, Math.round(project.targetPages / 8)));

  log.data(
    "Tier",
    `${tier.label} (pricing) — chapter count decided from draft, typical ${chLo}-${chHi}`,
  );
  log.data("Words/page", wpp);
  log.data("Total target words", totalWords.toLocaleString());

  const prompt = buildStructurePrompt({
    topic: project.topic,
    title: project.title,
    targetPages: project.targetPages,
    language: project.language,
    stylePreset: project.stylePreset,
    guidelines: project.guidelines,
    bookFormat: project.bookFormat,
    chaptersLo: chLo,
    chaptersHi: chHi,
    totalWords,
    wpp,
    sourcesText,
    hasResearch,
    brief,
    numbering,
  });

  log.data("Prompt length", `${prompt.length.toLocaleString()} chars`);
  log.step("Calling Claude API...");

  try {
    const apiTimer = log.timer();
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 16000, // struktura to zwięzły JSON — duży zapas, by NIGDY nie uciąć
      messages: [{ role: "user", content: prompt }],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";
    const stopReason = response.stop_reason;
    log.api(
      "claude-sonnet-4-6",
      response.usage?.input_tokens || 0,
      response.usage?.output_tokens || 0,
    );
    log.ok(
      `API response: ${text.length.toLocaleString()} chars, stop: ${stopReason} (${apiTimer()})`,
    );

    // If truncated, warn
    let jsonText = text;
    if (stopReason === "max_tokens") {
      log.warn(
        "Response TRUNCATED (max_tokens hit) — attempting JSON repair...",
      );
      jsonText = repairTruncatedJson(text);
    }

    // Extract + validate JSON (parseLLMJson repairs truncation internally)
    const parsed = parseLLMJson(jsonText, BookStructureSchema);
    if (!parsed.ok) {
      log.err(`Structure JSON invalid: ${parsed.error}`);
      log.step(`Response preview: ${text.substring(0, 500)}`);
      log.step(`Last 300 chars: ...${jsonText.slice(-300)}`);
      throw new Error(`Invalid structure from LLM: ${parsed.error}`);
    }
    const structure = parsed.data;

    // Log structure
    if (structure.suggestedTitle) {
      log.ok(`Title: "${structure.suggestedTitle}"`);
    }
    if (structure.chapters) {
      log.ok(`Chapters: ${structure.chapters.length}`);
      let totalPages = 0;
      for (const ch of structure.chapters) {
        const sectionCount = ch.sections?.length || 0;
        totalPages += ch.targetPages || 0;
        log.step(
          `  Ch.${ch.number}: "${ch.title}" — ${ch.targetPages}p, ${sectionCount} sections`,
        );
        for (const s of ch.sections || []) {
          log.step(
            `    → ${s.title} (${s.targetPages}p): ${s.description.substring(0, 80)}...`,
          );
        }
      }
      log.data("Total allocated pages", totalPages);
      if (Math.abs(totalPages - project.targetPages) > 5) {
        log.warn(
          `Page allocation mismatch: ${totalPages} vs target ${project.targetPages}`,
        );
      }
    }

    // Update title if not set
    if (!project.title && structure.suggestedTitle) {
      await prisma.project.update({
        where: { id: projectId },
        data: { title: structure.suggestedTitle },
      });
      log.ok(`Project title set to: "${structure.suggestedTitle}"`);
    }

    // Save structure
    log.step("Saving structure to database...");
    await prisma.projectStructure.upsert({
      where: { projectId },
      create: {
        projectId,
        structureJson: JSON.stringify(structure),
        generationPrompt: prompt,
        generationResponse: text,
      },
      update: {
        structureJson: JSON.stringify(structure),
        generationPrompt: prompt,
        generationResponse: text,
        version: { increment: 1 },
      },
    });

    // Autopilot (admin unattended run): skip the human STRUCTURE_REVIEW gate —
    // auto-approve the freshly saved structure and chain straight into content
    // (mirrors the manual /structure/approve endpoint). Content then auto-runs
    // compile, so the whole pipeline completes with no further input.
    const proj = await prisma.project.findUnique({
      where: { id: projectId },
      select: { autoPilot: true, structure: { select: { id: true } } },
    });
    if (proj?.autoPilot && proj.structure) {
      await prisma.projectStructure.update({
        where: { id: proj.structure.id },
        data: { approvedAt: new Date() },
      });
      await prisma.project.update({
        where: { id: projectId },
        data: {
          currentStage: "GENERATING",
          generationStatus: "GENERATING_CONTENT",
        },
      });
      const { enqueueGeneration } = await import("../lib/jobQueue");
      await enqueueGeneration("content", projectId);
      log.ok("Autopilot: structure auto-approved, content generation enqueued");
      log.footer(
        "SUCCESS",
        `${structure.chapters?.length || 0} chapters, ${totalWords.toLocaleString()} target words (autopilot)`,
      );
      return;
    }

    await prisma.project.update({
      where: { id: projectId },
      data: {
        currentStage: "STRUCTURE_REVIEW",
        generationStatus: "STRUCTURE_READY",
      },
    });

    log.ok("Structure saved, stage → STRUCTURE_REVIEW");
    log.footer(
      "SUCCESS",
      `${structure.chapters?.length || 0} chapters, ${totalWords.toLocaleString()} target words`,
    );
  } catch (error: any) {
    log.err("Structure generation failed", error);
    await prisma.project.update({
      where: { id: projectId },
      data: { currentStage: "ERROR", generationStatus: "ERROR" },
    });
    log.footer("ERROR", error.message);
    throw error;
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Build the structure prompt
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface StructurePromptParams {
  topic: string;
  title: string | null;
  targetPages: number;
  language: string;
  stylePreset: string;
  guidelines: string | null;
  bookFormat: string;
  /** soft typical chapter-count range for this page budget (guidance, not a rule) */
  chaptersLo: number;
  chaptersHi: number;
  totalWords: number;
  wpp: number;
  sourcesText: string;
  hasResearch: boolean;
  brief: BookBrief;
  numbering: NumberingSpec;
}

/**
 * Capitalization convention for titles/headings. Capitalizing every word
 * (Title Case) is an ENGLISH convention; other languages use sentence case
 * (German additionally capitalizes nouns). Getting this wrong is a tell-tale
 * sign of a machine-translated/English-authored book.
 */
function getCapitalizationRule(lang: string): string {
  if (lang === "en")
    return "CAPITALIZATION: use Title Case for the book title and all headings (capitalize the principal words).";
  if (lang === "de")
    return "CAPITALIZATION: follow German orthography — capitalize the first word, all nouns and proper nouns; do NOT apply English-style Title Case to verbs, adjectives, articles or prepositions.";
  return `CAPITALIZATION: the book title and ALL headings use SENTENCE CASE — capitalize ONLY the first word, proper nouns, and the first word after a colon. Capitalizing every word is an English convention and is INCORRECT in this language. Example: "Architektura rozproszenia" (correct), NOT "Architektura Rozproszenia".`;
}

function buildStructurePrompt(p: StructurePromptParams): string {
  const langInstruction = getLangInstruction(p.language);

  return `You are an expert book editor planning a professional eBook. Your job is to create a structure that will FORCE the writer to produce expert-level content true to the author brief below — not generic AI filler.

BOOK SPECS:
Topic: ${p.topic}
${p.title ? `Title: ${p.title}` : ""}
Target: ${p.targetPages} pages (${p.bookFormat.toUpperCase()}, ~${p.wpp} words/page = ~${p.totalWords} total words)
Language: ${p.language} | Style: ${p.stylePreset}
${p.guidelines ? `Author guidelines: ${p.guidelines}` : ""}

${formatBriefForPrompt(p.brief)}

${formatNumberingForPrompt(p.numbering)}
${
  p.numbering.mode === "items"
    ? `STRUCTURE RULE FOR A COLLECTION BOOK: every "section" you plan below is ONE item (one recipe / project / exercise) — its title is the item's name, its description says what makes it distinct. Group items into chapters by theme. ${
        p.numbering.itemCount
          ? `Plan EXACTLY ${p.numbering.itemCount} item-sections in total across all chapters (the title promises that number) — distribute them across the chapters by theme.`
          : "Plan as many item-sections as the page budget allows (roughly one per 1-1.5 pages)."
      } A chapter may additionally open with at most ONE short non-item section (technique, ingredients, tools) — mark it by starting its description with "[intro]".`
    : ""
}

The structure must SERVE this brief: chapter angles, section topics and the kind of
material each section promises must match the genre, evidence policy and narrative
strategy above. Do not plan data-analysis sections for a narrative book, and do not
plan mood pieces for a data-driven guide.

${
  p.hasResearch
    ? `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RESEARCH SOURCES — GROUND THE STRUCTURE IN REALITY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Your structure MUST be grounded in what the research reveals:
- Identify the most substantive topics covered across sources
- Note the specific material the sources offer (tools, regulations, case studies,
  techniques, recipes, stories — whatever the genre calls for)
- Build chapters around REAL findings, not hypothetical topics
- Prioritize topics where sources provide enough depth for expert-level writing
- Use the sources in the way the EVIDENCE POLICY above prescribes

${p.sourcesText}
`
    : `
No web research sources available. Plan structure based on your expert knowledge.
Focus on topics where you can provide SPECIFIC, verifiable information — not vague overviews.
`
}

═══════════════════════════════════════════════════════════════
STRUCTURE QUALITY RULES
═══════════════════════════════════════════════════════════════

CHAPTER DESIGN PRINCIPLES:
- Each chapter should have a CLEAR THESIS or argument, not just "about topic X"
- BAD chapter: "Introduction to AI Tools" → GOOD: "Why 80% of AI Tool Adoption Fails — And What the 20% Do Differently" (adapt this pattern to the book's genre — a cookbook's "clear thesis" is a culinary idea, not a business claim)
- Chapters should BUILD on each other: foundational → applied → advanced → strategic
- Avoid the trap of Chapter 1 = "What is X" / Chapter 2 = "Why X matters" — readers know what they bought

SECTION DESCRIPTIONS — short writing briefs, NOT essays:
- 1–2 sentences, MAX ~35 words each. Hard limit — do NOT write paragraphs or multi-step plans.
- Still be concrete: name 1–3 specific things to cover (tools, companies, data, examples) + the angle/argument.
- BAD (too vague): "Overview of popular AI writing tools"
- BAD (too long): a multi-sentence plan with "Poziom 1/2/3", decision matrices, benchmark citations
- GOOD: "Compare GPT-4, Claude i Gemini do długich tekstów: cena za 1M tokenów, okno kontekstu, jakość po polsku. Wskaż, kiedy użyć którego."
- The "1-3 specific things" must fit the EVIDENCE POLICY: in a data-driven guide name tools/data; in a cookbook name ingredients/techniques/dishes; in a narrative book name scenes/stories/questions

WHAT TO AVOID IN STRUCTURE:
- Generic "introduction" chapters that waste 25% of the book on basics
- Sections that are just lists of tools without analysis
- "Future trends" sections that speculate without substance
- Padding sections: "Best practices" or "Tips and tricks" without specific frameworks
- Mirror chapters: two sections that cover the same ground from slightly different angles

TITLE STYLE — repetitive title patterns expose machine-written books:
- The antithesis pattern "X, not Y" ("wprowadzenie, nie streszczenie", "precision, not bureaucracy")
  is allowed in AT MOST ONE title in the whole book. Do not make it the default rhythm.
- Vary title shapes across chapters/sections: a plain noun phrase, a how-to, a question,
  a number-driven claim, a concrete promise — not the same template everywhere
- Not every title needs a colon with a subtitle; use the "Label: explanation" shape for
  at most half of the titles

DRAFT-FIRST PLANNING — the structure must be DERIVED from a working draft, not from a template:
- FIRST write the "workingDraft" field: a compact working draft of the whole book (10-20 lines, in the book's language) — what the reader must actually get, the real threads/items the research supports, in reading order. Think it through like an author, not like a table-of-contents generator.
- THEN derive the chapters FROM that draft. The chapter count EMERGES from the material — do NOT force a fixed number. For a ${p.targetPages}-page book that is typically ${p.chaptersLo}-${p.chaptersHi} chapters, but the material decides: merge thin threads, split rich ones.
- Sections per chapter: as many as the chapter's material needs (typically 2-5; in a collection book, one per item).

CRITICAL FORMATTING RULES:
- Total pages MUST equal approximately ${p.targetPages} — allocate targetPages per chapter/section accordingly
- ${langInstruction}
- ${getCapitalizationRule(p.language)}
- suggestedTitle should be specific and compelling — avoid generic titles

Respond with RAW JSON ONLY — no markdown, no \`\`\` fences, no commentary before or after.
Keep every "description" to 1–2 short sentences (max ~35 words). This keeps the output compact and parseable.
{
  "workingDraft": "The compact working draft (10-20 lines) you derived the structure from — write this FIRST",
  "suggestedTitle": "Specific, compelling book title (in the book's language and its correct capitalization)",
  "chapters": [
    {
      "id": "ch1",
      "number": 1,
      "title": "Specific chapter title with a clear angle",
      "description": "1–2 sentences: the chapter's thesis + what the reader will be able to DO after it.",
      "targetPages": ${Math.round(p.targetPages / Math.round((p.chaptersLo + p.chaptersHi) / 2))},
      "sections": [
        {
          "id": "ch1-s1",
          "title": "Section title",
          "description": "1–2 sentences: name 1–3 concrete things to cover + the angle. Max ~35 words.",
          "targetPages": 2,
          "order": 0
        }
      ]
    }
  ]
}`;
}

function getLangInstruction(lang: string): string {
  const map: Record<string, string> = {
    pl: "Write ALL titles and descriptions in Polish",
    de: "Write ALL titles and descriptions in German",
    es: "Write ALL titles and descriptions in Spanish",
    fr: "Write ALL titles and descriptions in French",
    it: "Write ALL titles and descriptions in Italian",
    pt: "Write ALL titles and descriptions in Portuguese",
    nl: "Write ALL titles and descriptions in Dutch",
  };
  return map[lang] || "Write all titles and descriptions in English";
}
