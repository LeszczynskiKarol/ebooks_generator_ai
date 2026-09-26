// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BookForge — customer materials (files attached in the order form)
//
// Two ways the files reach the model:
//  1. DIGEST — one LLM pass over all files BEFORE the author brief. It
//     classifies each file (guidelines / examples / sources / inspiration)
//     and distils binding instructions, style cues and content to cover.
//     The digest is appended to the customer guidelines, so it lands in the
//     brief, structure, chapter and review prompts with the same authority.
//  2. RAW TEXT — every chapter prompt gets the material itself (whole, if it
//     fits the budget; otherwise the passages most relevant to that chapter),
//     so facts, examples and wording cues survive beyond the digest.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { z } from "zod";
import { createLLMClient, SONNET_MODEL } from "../lib/llm";
import { prisma } from "../lib/prisma";
import { parseLLMJson } from "../lib/llmJson";

const anthropic = createLLMClient();
const DIGEST_MODEL = SONNET_MODEL;

/** Upper bound of material text sent to the digest call (~70k tokens). */
const DIGEST_INPUT_CHARS = 280_000;
/** Material text injected into ONE chapter prompt (~9k tokens). */
const CHAPTER_MATERIAL_CHARS = 36_000;
const CHUNK_CHARS = 2_400;
/** Files up to this size go into every chapter whole (typically instructions). */
const SHORT_FILE_CHARS = 6_000;

export type MaterialRole = "guidelines" | "examples" | "sources" | "inspiration";

export interface MaterialForPrompt {
  id: string;
  fileName: string;
  role: MaterialRole | null;
  text: string;
}

const DigestSchema = z.object({
  files: z
    .array(
      z.object({
        file: z.string(),
        role: z.enum(["guidelines", "examples", "sources", "inspiration"]),
        summary: z.string(),
      }),
    )
    .default([]),
  binding: z.array(z.string()).default([]),
  style: z.string().default(""),
  mustCover: z.array(z.string()).default([]),
  keyFacts: z.array(z.string()).default([]),
  avoid: z.array(z.string()).default([]),
});
type Digest = z.infer<typeof DigestSchema>;

export async function loadProjectMaterials(
  projectId: string,
): Promise<MaterialForPrompt[]> {
  const rows = await prisma.projectMaterial.findMany({
    where: { projectId },
    orderBy: { createdAt: "asc" },
    select: { id: true, fileName: true, role: true, text: true },
  });
  return rows.map((r) => ({ ...r, role: (r.role as MaterialRole) || null }));
}

// ━━━ Digest ━━━

function buildDigestPrompt(
  p: { topic: string; title: string | null; language: string; guidelines: string | null },
  materials: MaterialForPrompt[],
): string {
  const total = materials.reduce((s, m) => s + m.text.length, 0);
  const scale = total > DIGEST_INPUT_CHARS ? DIGEST_INPUT_CHARS / total : 1;
  const blocks = materials
    .map((m, i) => {
      const cap = Math.floor(m.text.length * scale);
      const body =
        m.text.length > cap ? m.text.slice(0, cap) + "\n[... TRUNCATED ...]" : m.text;
      return `═══ FILE ${i + 1}: ${m.fileName} ═══\n${body}\n═══ END FILE ${i + 1} ═══`;
    })
    .join("\n\n");

  return `A customer ordered a book and attached reference files. Before any writing starts, read them and turn them into instructions for the writer.

BOOK ORDER:
Topic: ${p.topic}
${p.title ? `Title: ${p.title}` : ""}
Language of the book: ${p.language}
${p.guidelines ? `Customer's typed guidelines: ${p.guidelines}` : "Customer's typed guidelines: none."}

ATTACHED FILES:
${blocks}

YOUR TASK:
1. Classify EACH file by what the customer most likely meant it for:
   - "guidelines": instructions, requirements, briefs, style guides, outlines the book must follow
   - "examples": sample texts whose form, tone, structure or level the book should resemble
   - "sources": factual material (articles, papers, notes, data, reports) the book should draw facts from
   - "inspiration": loose ideas, mood, angles — use freely, nothing binding
2. binding — every concrete, checkable requirement found in the files (structure, chapters to include, terminology, audience, length rules, things to mention, format of exercises...). Quote numbers and names exactly. Empty if none.
3. style — what the examples say about voice, register, sentence rhythm, formatting and level of detail, as directives for the writer (2-5 sentences). Empty if there are no examples.
4. mustCover — topics, arguments, cases, methods from the files that the book should contain.
5. keyFacts — the most important concrete facts, figures, definitions and named entities from source files, each with the file it came from. At most 40.
6. avoid — anything the files explicitly reject or that would contradict them.

RULES:
- Report ONLY what is in the files; never add your own ideas.
- If files conflict with the typed guidelines, the typed guidelines win — note the conflict in "binding".
- Write all values in ENGLISH (they are injected into English prompts); keep quoted names, terms and titles in their original language.

Respond with RAW JSON ONLY:
{
  "files": [{ "file": "exact file name", "role": "guidelines|examples|sources|inspiration", "summary": "1-2 sentences" }],
  "binding": ["..."],
  "style": "...",
  "mustCover": ["..."],
  "keyFacts": ["... (file.pdf)"],
  "avoid": ["..."]
}`;
}

function formatDigest(d: Digest): string {
  const list = (title: string, items: string[]) =>
    items.length ? `${title}\n${items.map((x) => `- ${x}`).join("\n")}\n` : "";
  return [
    `CUSTOMER-SUPPLIED FILES (${d.files.length}):`,
    ...d.files.map((f) => `- ${f.file} [${f.role}]: ${f.summary}`),
    "",
    list("BINDING REQUIREMENTS FROM THE FILES:", d.binding),
    d.style ? `STYLE TO MATCH (from the customer's example texts): ${d.style}\n` : "",
    list("CONTENT THE BOOK SHOULD COVER (from the files):", d.mustCover),
    list("KEY FACTS FROM THE CUSTOMER'S SOURCES:", d.keyFacts),
    list("AVOID (per the files):", d.avoid),
  ]
    .filter(Boolean)
    .join("\n")
    .trim();
}

/**
 * Load the stored digest, or build it (one LLM call) and persist it together
 * with each file's role. Returns "" for projects without materials. Fail-open:
 * if the call fails, a plain file list is returned so the pipeline goes on and
 * the chapters still get the raw material.
 */
export async function getOrCreateMaterialsDigest(
  project: {
    id: string;
    topic: string;
    title: string | null;
    language: string;
    guidelines: string | null;
    materialsDigest?: string | null;
  },
  log?: any,
): Promise<string> {
  if (project.materialsDigest) return project.materialsDigest;
  const materials = await loadProjectMaterials(project.id);
  if (materials.length === 0) return "";

  let digestText: string;
  try {
    const response = await anthropic.messages.create({
      model: DIGEST_MODEL,
      max_tokens: 8000,
      messages: [{ role: "user", content: buildDigestPrompt(project, materials) }],
    });
    const text = response.content
      .filter((b: any) => b.type === "text")
      .map((b: any) => b.text)
      .join("");
    const parsed = parseLLMJson(text, DigestSchema);
    if (!parsed.ok) throw new Error(parsed.error);
    digestText = formatDigest(parsed.data);

    const norm = (s: string) => s.trim().toLowerCase();
    for (const f of parsed.data.files) {
      const m = materials.find((x) => norm(x.fileName) === norm(f.file));
      if (m) {
        await prisma.projectMaterial.update({
          where: { id: m.id },
          data: { role: f.role },
        });
      }
    }
    log?.ok?.(
      `Materials digest: ${materials.length} files → ${digestText.length.toLocaleString()} chars`,
    );
  } catch (err: any) {
    log?.warn?.(`Materials digest failed (${err.message}) — using file list only`);
    digestText = `CUSTOMER-SUPPLIED FILES (${materials.length}): ${materials
      .map((m) => m.fileName)
      .join(", ")} — their content is given with each chapter as AUTHOR-PROVIDED MATERIALS.`;
  }

  await prisma.project.update({
    where: { id: project.id },
    data: { materialsDigest: digestText },
  });
  return digestText;
}

/** Customer guidelines + materials digest — what every prompt that takes
 *  "guidelines" should see. */
export function mergeGuidelinesWithDigest(
  guidelines: string | null,
  digest: string,
): string | null {
  if (!digest) return guidelines;
  return `${guidelines ? guidelines.trim() + "\n\n" : ""}${digest}`;
}

// ━━━ Per-chapter material selection ━━━

/** Crude cross-language stem: lowercase letters only, first 6 chars. Good
 *  enough to match Polish inflections ("motywacji"/"motywacja"). */
function stems(s: string): Set<string> {
  const out = new Set<string>();
  for (const w of s.toLowerCase().match(/\p{L}{4,}/gu) || []) out.add(w.slice(0, 6));
  return out;
}

function chunk(text: string): string[] {
  const paras = text.split(/\n{2,}/);
  const chunks: string[] = [];
  let cur = "";
  for (const p of paras) {
    if (cur && cur.length + p.length > CHUNK_CHARS) {
      chunks.push(cur);
      cur = "";
    }
    if (p.length > CHUNK_CHARS * 1.5) {
      for (let i = 0; i < p.length; i += CHUNK_CHARS) chunks.push(p.slice(i, i + CHUNK_CHARS));
    } else {
      cur = cur ? `${cur}\n\n${p}` : p;
    }
  }
  if (cur) chunks.push(cur);
  return chunks;
}

const ROLE_NOTE: Record<MaterialRole, string> = {
  guidelines: "GUIDELINES — customer instructions, follow them",
  examples: "EXAMPLE — match its form, tone and level; do NOT copy its sentences",
  sources: "SOURCE — draw facts, data and examples from it",
  inspiration: "INSPIRATION — borrow ideas and angles freely, nothing binding",
};

/**
 * The material block for one chapter prompt. When everything fits the budget
 * the files go in whole; otherwise each file is cut into passages, and the
 * ones sharing the most vocabulary with the chapter plan win (kept in file
 * order). Short files (usually instructions) always go in whole.
 */
export function formatMaterialsForChapter(
  materials: MaterialForPrompt[],
  chapter: { title: string; sections?: Array<{ title: string; description?: string }> },
): string {
  if (materials.length === 0) return "";

  const total = materials.reduce((s, m) => s + m.text.length, 0);
  let picked: Array<{ m: MaterialForPrompt; text: string; partial: boolean }>;

  if (total <= CHAPTER_MATERIAL_CHARS) {
    picked = materials.map((m) => ({ m, text: m.text, partial: false }));
  } else {
    const query = stems(
      [chapter.title, ...(chapter.sections || []).map((s) => `${s.title} ${s.description || ""}`)].join(" "),
    );
    const isShort = (m: MaterialForPrompt) => m.text.length <= SHORT_FILE_CHARS;
    let budget =
      CHAPTER_MATERIAL_CHARS -
      materials.filter(isShort).reduce((sum, m) => sum + m.text.length, 0);
    const chosen = new Map<string, Set<number>>();
    const scored: Array<{ id: string; idx: number; len: number; score: number }> = [];
    for (const m of materials) {
      if (isShort(m)) continue;
      chunk(m.text).forEach((c, idx) => {
        const cs = stems(c);
        let hits = 0;
        for (const q of query) if (cs.has(q)) hits++;
        // Normalise by chunk vocabulary so long chunks don't win by size alone;
        // the customer's instructions outrank plain sources on a tie.
        const boost = m.role === "guidelines" ? 1.3 : 1;
        scored.push({ id: m.id, idx, len: c.length, score: (boost * hits) / Math.sqrt(cs.size + 1) });
      });
    }
    scored.sort((a, b) => b.score - a.score);
    for (const s of scored) {
      if (s.len > budget) continue;
      budget -= s.len;
      if (!chosen.has(s.id)) chosen.set(s.id, new Set());
      chosen.get(s.id)!.add(s.idx);
    }
    picked = [];
    for (const m of materials) {
      if (isShort(m)) {
        picked.push({ m, text: m.text, partial: false });
        continue;
      }
      const idxs = chosen.get(m.id);
      if (!idxs) continue;
      const chunks = chunk(m.text);
      const text = chunks
        .map((c, i) => (idxs.has(i) ? c : null))
        .reduce<string[]>((acc, c) => {
          if (c) acc.push(c);
          else if (acc[acc.length - 1] !== "[…]") acc.push("[…]");
          return acc;
        }, [])
        .join("\n\n");
      picked.push({ m, text, partial: idxs.size < chunks.length });
    }
  }

  const blocks = picked
    .map(({ m, text, partial }, i) => {
      const role = m.role ? ` [${ROLE_NOTE[m.role]}]` : "";
      const part = partial ? " (passages most relevant to this chapter)" : "";
      return `═══ MATERIAL ${i + 1}: ${m.fileName}${role}${part} ═══\n\n${text}\n\n═══ END MATERIAL ${i + 1} ═══`;
    })
    .join("\n\n");

  return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AUTHOR-PROVIDED MATERIALS (files the customer attached to the order — HIGHEST PRIORITY)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${blocks}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HOW TO USE THE AUTHOR-PROVIDED MATERIALS:
- The customer chose these files on purpose — where they are relevant to this chapter, prefer them over web research
- Facts, figures and examples from them may be used freely; when you footnote one, cite the work by the author/title stated INSIDE the document, never by its file name — if the document names no author or title, don't footnote it
- Example texts show the expected form and tone — imitate the approach, never copy sentences
- Do not mention to the reader that materials were "uploaded" or "provided"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
}
