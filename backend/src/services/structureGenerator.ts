// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BookForge — Structure Generator
// Research → Structure generation with real-world data
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "../lib/prisma";
import { getWordsPerPage, getPageSizeTier } from "../lib/types";
import { createPipelineLogger } from "../lib/logger";
import { conductResearch, formatSourcesForPrompt } from "./researchService";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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

  // ━━━ Phase 2: Generate structure ━━━
  log.phase(2, "Claude Structure Generation");

  const tier = getPageSizeTier(project.targetPages);
  const wpp = getWordsPerPage(project.bookFormat);
  const totalWords = project.targetPages * wpp;

  log.data(
    "Tier",
    `${tier.label} (${tier.chapters} chapters, ${tier.sectionsPerChapter} sections each)`,
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
    chapters: tier.chapters,
    sectionsPerChapter: tier.sectionsPerChapter,
    totalWords,
    wpp,
    sourcesText,
    hasResearch,
  });

  log.data("Prompt length", `${prompt.length.toLocaleString()} chars`);
  log.step("Calling Claude API...");

  try {
    const apiTimer = log.timer();
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 8000,
      messages: [{ role: "user", content: prompt }],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";
    const stopReason = response.stop_reason;
    log.api(
      "claude-haiku-4-5",
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

    // Extract JSON
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      log.err("No JSON found in Claude response!");
      log.step(`Response preview: ${text.substring(0, 500)}`);
      throw new Error("No JSON found in response");
    }

    let structure: any;
    try {
      structure = JSON.parse(jsonMatch[0]);
    } catch (parseErr: any) {
      log.warn(`JSON parse failed: ${parseErr.message} — attempting repair...`);
      const repaired = repairTruncatedJson(jsonMatch[0]);
      try {
        structure = JSON.parse(repaired);
        log.ok("JSON repair successful!");
      } catch {
        log.err("JSON repair also failed");
        log.step(`Last 300 chars: ...${jsonMatch[0].slice(-300)}`);
        throw new Error(`Invalid JSON from Claude: ${parseErr.message}`);
      }
    }

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
  chapters: number;
  sectionsPerChapter: string;
  totalWords: number;
  wpp: number;
  sourcesText: string;
  hasResearch: boolean;
}

function buildStructurePrompt(p: StructurePromptParams): string {
  const langInstruction = getLangInstruction(p.language);

  return `You are an expert book editor planning a professional, data-rich eBook. Your job is to create a structure that will FORCE the writer to produce expert-level content — not generic AI filler.

BOOK SPECS:
Topic: ${p.topic}
${p.title ? `Title: ${p.title}` : ""}
Target: ${p.targetPages} pages (${p.bookFormat.toUpperCase()}, ~${p.wpp} words/page = ~${p.totalWords} total words)
Language: ${p.language} | Style: ${p.stylePreset}
${p.guidelines ? `Author guidelines: ${p.guidelines}` : ""}

${
  p.hasResearch
    ? `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RESEARCH SOURCES — USE THESE TO BUILD A DATA-DRIVEN STRUCTURE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Your structure MUST be grounded in what the research reveals:
- Identify the most substantive topics covered across sources
- Note specific tools, companies, regulations, and case studies mentioned
- Build chapters around REAL findings, not hypothetical topics
- If sources reveal industry data/stats, plan sections that analyze them
- Prioritize topics where sources provide enough depth for expert-level writing

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
- BAD chapter: "Introduction to AI Tools" → GOOD: "Why 80% of AI Tool Adoption Fails — And What the 20% Do Differently"
- Chapters should BUILD on each other: foundational → applied → advanced → strategic
- Avoid the trap of Chapter 1 = "What is X" / Chapter 2 = "Why X matters" — readers know what they bought

SECTION DESCRIPTIONS — these are INSTRUCTIONS for the writer. Make them specific:
- BAD: "Overview of popular AI writing tools" → The writer will produce a generic list
- GOOD: "Compare GPT-4, Claude, and Gemini for long-form content: pricing per 1M tokens, context window limits, output quality for Polish/multilingual text. Include a decision matrix: when to use which model based on task type (blog posts vs technical docs vs ad copy). Reference the Stanford HAI benchmark data."
- Each description should NAME specific things to include: companies, tools, frameworks, data sources
- Include the ANGLE or argument the section should make, not just the topic

WHAT TO AVOID IN STRUCTURE:
- Generic "introduction" chapters that waste 25% of the book on basics
- Sections that are just lists of tools without analysis
- "Future trends" sections that speculate without substance
- Padding sections: "Best practices" or "Tips and tricks" without specific frameworks
- Mirror chapters: two sections that cover the same ground from slightly different angles

CRITICAL FORMATTING RULES:
- Create EXACTLY ${p.chapters} chapters
- Each chapter: ${p.sectionsPerChapter} sections
- Total pages MUST equal approximately ${p.targetPages}
- ${langInstruction}
- suggestedTitle should be specific and compelling — avoid generic titles

Respond ONLY with valid JSON:
{
  "suggestedTitle": "Specific, Compelling Book Title",
  "chapters": [
    {
      "id": "ch1",
      "number": 1,
      "title": "Specific Chapter Title With Clear Angle",
      "description": "2-3 sentence brief: what thesis/argument this chapter makes, what concrete topics it covers, what the reader will be able to DO after reading it",
      "targetPages": ${Math.round(p.targetPages / p.chapters)},
      "sections": [
        {
          "id": "ch1-s1",
          "title": "Section Title",
          "description": "Detailed writing instructions: name specific tools/companies/data to include, the argument to make, concrete examples to use. This description drives content quality — be specific.",
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

/**
 * Attempt to repair truncated JSON by closing open brackets/braces.
 * Works when Claude's response is cut off mid-JSON by max_tokens.
 */
function repairTruncatedJson(text: string): string {
  // Find the start of JSON
  const jsonStart = text.indexOf("{");
  if (jsonStart === -1) return text;

  let json = text.substring(jsonStart);

  // Remove any trailing incomplete string (cut mid-value)
  // If ends with unclosed quote, close it
  const lastQuote = json.lastIndexOf('"');
  const afterLastQuote = json.substring(lastQuote + 1).trim();

  // If we're in the middle of a string value, truncate to last complete property
  if (afterLastQuote === "" || afterLastQuote === ":") {
    // Cut back to the last complete key-value pair
    const lastComma = json.lastIndexOf(",");
    const lastBrace = Math.max(json.lastIndexOf("}"), json.lastIndexOf("]"));
    const cutPoint = Math.max(lastComma, lastBrace);
    if (cutPoint > jsonStart) {
      json = json.substring(0, cutPoint + 1);
    }
  }

  // Count open brackets and close them
  let openBraces = 0;
  let openBrackets = 0;
  let inString = false;
  let escaped = false;

  for (const ch of json) {
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === "{") openBraces++;
    if (ch === "}") openBraces--;
    if (ch === "[") openBrackets++;
    if (ch === "]") openBrackets--;
  }

  // Remove trailing comma before we close
  json = json.replace(/,\s*$/, "");

  // Close any open structures
  while (openBrackets > 0) {
    json += "]";
    openBrackets--;
  }
  while (openBraces > 0) {
    json += "}";
    openBraces--;
  }

  return json;
}
