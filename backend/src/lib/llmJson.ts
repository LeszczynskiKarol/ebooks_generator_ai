// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// LLM JSON parsing — single place for extracting, repairing and
// schema-validating JSON returned by the LLM. Every service that
// parses model output should go through parseLLMJson() instead of
// raw regex + JSON.parse, so malformed/partial output fails loudly
// (or falls back deliberately) instead of corrupting the pipeline.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { z } from "zod";

/**
 * Best-effort repair of JSON truncated mid-stream (max_tokens cut).
 * Rewinds to the last completed element and balances open brackets.
 */
export function repairTruncatedJson(text: string): string {
  const objStart = text.indexOf("{");
  const arrStart = text.indexOf("[");
  const start =
    objStart === -1
      ? arrStart
      : arrStart === -1
        ? objStart
        : Math.min(objStart, arrStart);
  if (start === -1) return text;
  const json = text.substring(start);

  const stack: string[] = [];
  let inString = false;
  let escaped = false;
  let safeIdx = -1; // index of the last char of a completed element
  let safeStack: string[] = []; // bracket stack still open at safeIdx

  for (let i = 0; i < json.length; i++) {
    const ch = json[i];
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

    if (ch === "{" || ch === "[") {
      stack.push(ch);
    } else if (ch === "}" || ch === "]") {
      stack.pop();
      // An element just closed and we're not inside a string → safe rewind point.
      safeIdx = i;
      safeStack = [...stack];
    }
  }

  // Clean tail (ended cleanly, just balance whatever is open).
  const closeFor = (s: string[]) =>
    s
      .slice()
      .reverse()
      .map((b) => (b === "{" ? "}" : "]"))
      .join("");

  if (!inString && stack.length === 0) return json; // already valid

  if (inString || stack.length > 0) {
    // Prefer rewinding to the last completed element (handles mid-string cut).
    if (safeIdx !== -1) {
      const body = json.substring(0, safeIdx + 1).replace(/,\s*$/, "");
      return body + closeFor(safeStack);
    }
    // Nothing completed yet — best effort: close string + balance.
    let body = json;
    if (inString) body += '"';
    body = body.replace(/,\s*$/, "");
    return body + closeFor(stack);
  }

  return json;
}

export type LLMJsonResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/**
 * Extract the JSON block from LLM prose, parse it (repairing truncation
 * if needed) and validate against a zod schema.
 */
export function parseLLMJson<S extends z.ZodTypeAny>(
  text: string,
  schema: S,
  opts: { kind?: "object" | "array" } = {},
): LLMJsonResult<z.infer<S>> {
  const re = opts.kind === "array" ? /\[[\s\S]*\]/ : /\{[\s\S]*\}/;
  let block = text.match(re)?.[0];
  if (!block) {
    // Truncation can cut the closing bracket entirely — repair first, rematch.
    block = repairTruncatedJson(text).match(re)?.[0];
    if (!block) return { ok: false, error: "No JSON found in LLM response" };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(block);
  } catch (parseErr: any) {
    try {
      raw = JSON.parse(repairTruncatedJson(block));
    } catch {
      return { ok: false, error: `Invalid JSON: ${parseErr.message}` };
    }
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues
      .slice(0, 3)
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; ");
    return { ok: false, error: `Schema validation failed: ${issues}` };
  }
  return { ok: true, data: result.data };
}

// ━━━ Shared domain schemas ━━━

/** Book structure as produced by the structure generator (and edited by users). */
export const StructureSectionSchema = z
  .object({
    title: z.string().min(1),
    description: z.string().default(""),
    targetPages: z.coerce.number().positive().optional(),
  })
  .passthrough();

export const StructureChapterSchema = z
  .object({
    number: z.coerce.number().int().positive(),
    title: z.string().min(1),
    description: z.string().default(""),
    targetPages: z.coerce.number().positive(),
    sections: z.array(StructureSectionSchema).default([]),
  })
  .passthrough();

export const BookStructureSchema = z
  .object({
    suggestedTitle: z.string().optional(),
    chapters: z.array(StructureChapterSchema).min(1),
  })
  .passthrough();

/** Per-chapter content registry (dedup context between chapters). */
export const ChapterRegistrySchema = z
  .object({
    summary: z.string().default(""),
    usedExamples: z.array(z.string()).default([]),
    usedStats: z.array(z.string()).default([]),
    keyTerms: z.array(z.string()).default([]),
    closingTopic: z.string().default(""),
  })
  .passthrough();
