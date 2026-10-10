// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// AI edit of a FINISHED book — one customer instruction at a time.
//
// Same shape as smart-edu.ai (edit-runner / edit-gate / edit-scope):
//   scope    one chapter, or one \section of it — never the whole book, so an
//            instruction cannot spill over text the customer did not point at
//   sandbox  the edited copy lives in EditJob.contentAfter; Chapter.latexContent
//            stays untouched until the customer ACCEPTS the preview
//   gate     machine check that the edit broke nothing the customer paid for:
//            LaTeX still balanced, no invented footnotes, no lost or added
//            illustrations, no preamble/file commands, bounded growth.
//            It does not judge whether the text is BETTER — the customer does,
//            in the preview.
//   undo     contentBefore is kept, so an accepted edit can be reverted
//
// The model gets no research material: an edit rewrites what is already in the
// book. That is why the gate blocks NEW footnotes — a source added here would
// be one nobody has seen.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
import { prisma } from "../lib/prisma";
import { createLLMClient, SONNET_MODEL } from "../lib/llm";
import { withCost, llmCostUsd } from "../lib/costTracker";
import { repairControlCharLatex, repairEditorArtifacts } from "../lib/latexFixes";
import { latexToXhtml } from "../lib/latexHtml";
import { llmLangName, variantNote, typographyNote, quoteHint } from "../lib/languages";

const anthropic = createLLMClient();

/** Edits per book. Fixed, not renewable — every edit is a paid model call. */
export const AI_EDIT_LIMIT = Number(process.env.AI_EDIT_LIMIT || 3);
/**
 * Failed attempts are free for the customer (the edit was refused or broke),
 * but each one still cost a model call. Past this many per book the feature
 * closes — otherwise deliberately failing edits would be an unmetered way to
 * burn calls.
 */
export const AI_EDIT_MAX_FAILED = Number(process.env.AI_EDIT_MAX_FAILED || 5);
/** Edit starts per account per hour, across all of its books. */
export const AI_EDIT_HOURLY = Number(process.env.AI_EDIT_HOURLY || 12);
/** Largest fragment (chars) one instruction may cover. */
export const AI_EDIT_MAX_FRAGMENT = Number(process.env.AI_EDIT_MAX_FRAGMENT_CHARS || 60000);
/** How many chars an edit may ADD — "expand this" must not write half a book. */
const MAX_GROWTH = Number(process.env.AI_EDIT_MAX_GROWTH_CHARS || 12000);
/** A running job older than this was orphaned by a restart. */
const STALE_MS = 12 * 60 * 1000;

export const COUNTED_STATUSES = ["running", "preview", "accepted", "rejected", "reverted"];
export const ACTIVE_STATUSES = ["running", "preview"];

// ── Scope ─────────────────────────────────────────────────────────────

export interface SectionScope {
  index: number;
  title: string;
  start: number;
  end: number;
  chars: number;
}

const HEADING = /^[ \t]*\\(?:section|itemsection)\*?\{/gm;

/** Text of the brace group that opens at `open` (the index of "{"). */
function braceGroup(s: string, open: number): string {
  let depth = 0;
  for (let i = open; i < s.length; i++) {
    if (s[i] === "\\") {
      i++;
      continue;
    }
    if (s[i] === "{") depth++;
    else if (s[i] === "}") {
      depth--;
      if (depth === 0) return s.slice(open + 1, i);
    }
  }
  return s.slice(open + 1, Math.min(s.length, open + 120));
}

const plainTitle = (t: string) =>
  t
    .replace(/\\[a-zA-Z]+\*?/g, "")
    .replace(/[{}~]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** The \section / \itemsection blocks of a chapter, each up to the next one. */
export function chapterSections(latex: string): SectionScope[] {
  const starts: { at: number; title: string }[] = [];
  for (const m of latex.matchAll(HEADING)) {
    const at = m.index!;
    starts.push({ at, title: plainTitle(braceGroup(latex, at + m[0].length - 1)) });
  }
  return starts.map((s, i) => {
    const end = i + 1 < starts.length ? starts[i + 1].at : latex.length;
    return { index: i, title: s.title, start: s.at, end, chars: end - s.at };
  });
}

/** [start, end) of the scope inside the chapter; null when it does not exist. */
export function scopeRange(latex: string, sectionIndex: number | null): { start: number; end: number } | null {
  if (sectionIndex == null) return { start: 0, end: latex.length };
  const s = chapterSections(latex)[sectionIndex];
  return s ? { start: s.start, end: s.end } : null;
}

// ── Gate ──────────────────────────────────────────────────────────────

export interface GateResult {
  ok: boolean;
  /** reasons the edit was refused (machine-readable codes) */
  violations: string[];
  wordsBefore: number;
  wordsAfter: number;
  footnotesBefore: number;
  footnotesAfter: number;
  imagesBefore: number;
  imagesAfter: number;
}

const count = (s: string, re: RegExp) => (s.match(re) || []).length;
const words = (latex: string) =>
  latex
    .replace(/\\[a-zA-Z]+\*?(\[[^\]]*\])?/g, " ")
    .replace(/[{}\\]/g, " ")
    .split(/\s+/)
    .filter((w) => /\p{L}/u.test(w)).length;
const images = (s: string) => (s.match(/\\includegraphics[^{]*\{[^}]+\}/g) || []).sort();

function bracesBalanced(s: string): boolean {
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "\\") {
      i++;
      continue;
    }
    if (s[i] === "%") {
      // a comment runs to the end of the line
      const nl = s.indexOf("\n", i);
      i = nl === -1 ? s.length : nl;
      continue;
    }
    if (s[i] === "{") depth++;
    else if (s[i] === "}") {
      depth--;
      if (depth < 0) return false;
    }
  }
  return depth === 0;
}

function environmentsBalanced(s: string): boolean {
  const stack: string[] = [];
  for (const m of s.matchAll(/\\(begin|end)\{([^}]+)\}/g)) {
    if (m[1] === "begin") stack.push(m[2]);
    else if (stack.pop() !== m[2]) return false;
  }
  return stack.length === 0;
}

// Preamble, file access, shell and macro definitions have no place in an edit.
const FORBIDDEN =
  /\\(documentclass|usepackage|input|include|includeonly|write18|immediate|openout|openin|read|newcommand|renewcommand|providecommand|def|let|catcode|csname|directlua|luaexec|begin\{document\}|end\{document\})\b/;

export function checkEdit(before: string, after: string): GateResult {
  const violations: string[] = [];
  const r: GateResult = {
    ok: false,
    violations,
    wordsBefore: words(before),
    wordsAfter: words(after),
    footnotesBefore: count(before, /\\footnote\b/g),
    footnotesAfter: count(after, /\\footnote\b/g),
    imagesBefore: images(before).length,
    imagesAfter: images(after).length,
  };
  if (r.wordsAfter < Math.max(5, Math.floor(r.wordsBefore * 0.1))) violations.push("too_short");
  if (after.length - before.length > MAX_GROWTH) violations.push("too_long");
  if (!bracesBalanced(after)) violations.push("braces");
  if (!environmentsBalanced(after)) violations.push("environments");
  if (FORBIDDEN.test(after) && !FORBIDDEN.test(before)) violations.push("forbidden_command");
  // A new footnote would cite a source the model never saw.
  if (r.footnotesAfter > r.footnotesBefore) violations.push("new_footnotes");
  if (images(before).join("\n") !== images(after).join("\n")) violations.push("images_changed");
  r.ok = violations.length === 0;
  return r;
}

// ── Preview diff ──────────────────────────────────────────────────────

export interface DiffBlock {
  type: "same" | "added" | "removed";
  text: string;
}

/** LaTeX → readable paragraphs (the customer reads prose, not markup). */
export function latexParagraphs(latex: string, language: string): string[] {
  let html: string;
  try {
    html = latexToXhtml(latex, "", language);
  } catch {
    html = latex;
  }
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
    .replace(/<\/(p|h[1-6]|li|tr|div|blockquote|figcaption|table|ul|ol)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/t[dh]>/gi, " | ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").replace(/(\s\|)+\s*$/, "").trim())
    .filter(Boolean);
}

/** Paragraph-level diff (LCS): what stayed, what went, what is new. */
export function diffParagraphs(a: string[], b: string[]): DiffBlock[] {
  const n = a.length;
  const m = b.length;
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
  const out: DiffBlock[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ type: "same", text: a[i] });
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) out.push({ type: "removed", text: a[i++] });
    else out.push({ type: "added", text: b[j++] });
  }
  while (i < n) out.push({ type: "removed", text: a[i++] });
  while (j < m) out.push({ type: "added", text: b[j++] });
  return out;
}

// ── Runner ────────────────────────────────────────────────────────────

function cleanModelOutput(text: string): string {
  let t = text.trim();
  // a fenced answer despite the instruction
  t = t.replace(/^```(?:latex|tex)?\s*\n?/i, "").replace(/\n?```\s*$/i, "");
  return repairEditorArtifacts(repairControlCharLatex(t)).trim();
}

function buildPrompts(p: {
  language: string;
  bookTitle: string;
  chapterTitle: string;
  wholeChapter: boolean;
  readerAddress: string | null;
  instruction: string;
  fragment: string;
}): { system: string; user: string } {
  const lang = llmLangName(p.language);
  const system = `You are a professional book editor revising one passage of a finished, typeset non-fiction book on the author's instruction. The passage is LaTeX; you return LaTeX.

LANGUAGE — NON-NEGOTIABLE:
The book is written in ${lang}. Everything you write must be correct, natural ${lang}, as a native ${lang} editor would write it. Never insert words or phrases from another language. The author's instruction may be in any language — follow it, but write the book text in ${lang} only.
${variantNote(p.language)}
${p.readerAddress ? `READER ADDRESS (keep it): ${p.readerAddress}` : ""}

HARD RULES — breaking any of them voids the whole edit:
1. Do ONLY what the instruction asks, and only inside this passage. Leave every sentence the instruction does not concern exactly as it is, character for character.
2. Footnotes: keep every \\footnote{...} you keep the sentence of, EXACTLY as written. NEVER add a new \\footnote — you have no sources, any new one would be invented. When you cut text, cut whole sentences together with their footnotes.
3. Never add facts, figures, statistics, quotations, names of people, studies or institutions that are not already in the passage. You may rephrase, reorder, shorten, simplify, clarify, and add explanation or examples that need no new factual claims.
4. Keep the LaTeX intact: the same macros and environments the passage already uses, every \\begin{...} closed by its \\end{...}, braces balanced. Keep every \\includegraphics line and its figure environment exactly as it is. No preamble, no \\usepackage, no new command definitions, no \\input.
5. ${p.wholeChapter ? "Keep the \\chapter{...} line exactly as it is." : "Keep the heading the passage starts with."} Do not add or remove \\chapter headings.
6. Escape special characters (\\%, \\&, \\#, \\$, \\_). Quotes: ${quoteHint(p.language)} — never the straight " character.
${typographyNote(p.language)}

OUTPUT: the COMPLETE revised passage and nothing else — no explanations, no comments, no code fences. If the instruction cannot be carried out without breaking a rule above, return the passage unchanged.`;

  const user = `BOOK: ${p.bookTitle}
CHAPTER: ${p.chapterTitle}
SCOPE: ${p.wholeChapter ? "the whole chapter" : "one section of the chapter"}

AUTHOR'S INSTRUCTION:
${p.instruction}

PASSAGE TO REVISE:
${p.fragment}`;
  return { system, user };
}

/** Run one queued edit. Never throws — the outcome is written to the job. */
export async function runEditJob(jobId: string): Promise<void> {
  const job = await prisma.editJob.findUnique({ where: { id: jobId } });
  if (!job || job.status !== "running" || job.contentBefore == null) return;
  const fail = (error: string, gateResult?: GateResult) =>
    prisma.editJob.update({
      where: { id: jobId },
      data: { status: "failed", error, finishedAt: new Date(), ...(gateResult ? { gateResult: gateResult as any } : {}) },
    });

  try {
    const project = await prisma.project.findUnique({
      where: { id: job.projectId },
      select: { title: true, topic: true, language: true, authorBrief: true },
    });
    const chapter = await prisma.chapter.findUnique({
      where: { projectId_chapterNumber: { projectId: job.projectId, chapterNumber: job.chapterNumber } },
      select: { title: true },
    });
    if (!project || !chapter) return void (await fail("not_found"));

    let readerAddress: string | null = null;
    try {
      readerAddress = project.authorBrief ? JSON.parse(project.authorBrief)?.readerAddress ?? null : null;
    } catch {}

    const before = job.contentBefore;
    const { system, user } = buildPrompts({
      language: project.language,
      bookTitle: project.title || project.topic,
      chapterTitle: chapter.title,
      wholeChapter: job.sectionIndex == null,
      readerAddress,
      instruction: job.prompt,
      fragment: before,
    });
    // LaTeX runs ~1 token per 2.5–3 chars; leave room for an allowed expansion.
    const maxTokens = Math.max(4000, Math.min(32000, Math.ceil((before.length + MAX_GROWTH) / 2.3)));

    const res = await withCost(job.projectId, "ai_edit", () =>
      anthropic.messages.create({
        model: SONNET_MODEL,
        max_tokens: maxTokens,
        system,
        messages: [{ role: "user", content: user }],
      }),
    );
    const costUsd = llmCostUsd(res.model || SONNET_MODEL, res.usage);
    await prisma.editJob.update({ where: { id: jobId }, data: { costUsd } });

    if (res.stop_reason === "max_tokens") return void (await fail("truncated"));
    const raw = res.content.find((c) => c.type === "text");
    let after = cleanModelOutput(raw && raw.type === "text" ? raw.text : "");
    if (!after) return void (await fail("empty"));

    // The \chapter line is structure (TOC, running heads) — restore it rather
    // than fail the edit over a retitled heading.
    if (job.sectionIndex == null) {
      const head = before.match(/^[ \t]*\\chapter\*?\{/m);
      if (head) {
        const origLine = before.slice(head.index!, before.indexOf("\n", head.index!) === -1 ? before.length : before.indexOf("\n", head.index!));
        const newHead = after.match(/^[ \t]*\\chapter\*?\{[^\n]*/m);
        after = newHead ? after.replace(newHead[0], origLine) : `${origLine}\n${after}`;
      }
    }

    // The fragment is spliced back between its neighbours: keep the blank
    // lines it had at both ends, or the next \section would be glued to the
    // last sentence.
    after = (before.match(/^\s*/)?.[0] ?? "") + after.trim() + (before.match(/\s*$/)?.[0] ?? "");

    if (after.trim() === before.trim()) return void (await fail("unchanged"));
    const gate = checkEdit(before, after);
    if (!gate.ok) return void (await fail(`gate:${gate.violations.join(",")}`, gate));

    await prisma.editJob.update({
      where: { id: jobId },
      data: { status: "preview", contentAfter: after, gateResult: gate as any, finishedAt: new Date() },
    });
  } catch (err: any) {
    await fail(String(err?.message || err).slice(0, 300)).catch(() => {});
  }
}

/** Jobs left "running" by a restart can never finish — fail them (uncounted). */
export async function failStaleJobs(projectId: string): Promise<void> {
  await prisma.editJob.updateMany({
    where: { projectId, status: "running", createdAt: { lt: new Date(Date.now() - STALE_MS) } },
    data: { status: "failed", error: "interrupted", finishedAt: new Date() },
  });
}
