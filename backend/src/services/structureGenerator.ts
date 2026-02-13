// backend/src/services/structureGenerator.ts

import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "../lib/prisma";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function generateStructure(projectId: string) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new Error("Project not found");

  console.log(`📖 Generating structure for project ${projectId}...`);

  await prisma.project.update({
    where: { id: projectId },
    data: { generationStatus: "GENERATING_STRUCTURE" },
  });

  const prompt = `You are a professional book editor. Create a detailed table of contents for an eBook.

Topic: ${project.topic}
${project.title ? `Title: ${project.title}` : ""}
Target pages: ${project.targetPages}
Language: ${project.language}
Style: ${project.stylePreset}
${project.guidelines ? `Author guidelines: ${project.guidelines}` : ""}

Generate a JSON structure with chapters and sections. Allocate pages proportionally.
The total of all chapter targetPages should equal approximately ${project.targetPages}.

Respond ONLY with valid JSON in this exact format:
{
  "suggestedTitle": "Book Title Here",
  "chapters": [
    {
      "id": "ch1",
      "number": 1,
      "title": "Chapter Title",
      "description": "Brief description of what this chapter covers",
      "targetPages": 5,
      "sections": [
        {
          "id": "ch1-s1",
          "title": "Section Title",
          "description": "What this section covers",
          "targetPages": 2,
          "order": 0
        }
      ]
    }
  ]
}

Rules:
- Write all titles and descriptions in ${project.language === "pl" ? "Polish" : project.language === "de" ? "German" : project.language === "es" ? "Spanish" : project.language === "fr" ? "French" : "English"}
- For ${project.targetPages} pages, create ${Math.max(3, Math.min(15, Math.ceil(project.targetPages / 10)))} chapters
- Each chapter should have 2-5 sections
- Page allocations must sum to approximately ${project.targetPages}
- Make the structure logical and comprehensive for the topic`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 4000,
      messages: [{ role: "user", content: prompt }],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";

    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found in response");

    const structure = JSON.parse(jsonMatch[0]);

    // Update title if not set
    if (!project.title && structure.suggestedTitle) {
      await prisma.project.update({
        where: { id: projectId },
        data: { title: structure.suggestedTitle },
      });
    }

    // Save structure
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

    console.log(`✅ Structure generated for project ${projectId}`);
  } catch (error) {
    console.error(`❌ Structure generation failed for ${projectId}:`, error);
    await prisma.project.update({
      where: { id: projectId },
      data: { currentStage: "ERROR", generationStatus: "ERROR" },
    });
    throw error;
  }
}
