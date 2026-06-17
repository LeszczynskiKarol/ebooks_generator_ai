// backend/src/services/visualReviewService.ts
// ─────────────────────────────────────────────────────────────────────────────
// VISUAL verification pass. After the book compiles, render EVERY page to PNG and
// have a vision model (Haiku) look at each page the way a human proof-reader
// would — catching defects that are invisible to text/LaTeX linting but obvious
// on the page: raw LaTeX commands printed as text (e.g. "\concept{...}"),
// text overflowing the margin, clipped/giant images, broken tables, blank pages,
// overlapping elements. Haiku QUOTES the offending on-page text; Sonnet then
// locates that text in the chapter LaTeX and patches it. Caller recompiles and
// (optionally) re-reviews — a bounded loop.
//
// In the cloud routine (subscription) the same job is done by the agent itself
// (it is multimodal) — this module is the production backend-API equivalent.
// ─────────────────────────────────────────────────────────────────────────────
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { createLLMClient } from "../lib/llm";
import { parseLLMJson } from "../lib/llmJson";
import { createPipelineLogger } from "../lib/logger";

const execAsync = promisify(exec);
const anthropic = createLLMClient();

type PLog = ReturnType<typeof createPipelineLogger>;

// Log one LLM call in the standard pipeline format (📤 REQ / 📥 RES / 🤖 usage).
function logLLM(
  log: PLog | undefined,
  label: string,
  model: string,
  reqPreview: string,
  resp: any,
  startedAt: number,
) {
  const text = resp?.content?.[0]?.type === "text" ? resp.content[0].text : "";
  log?.claudeReq?.(label, reqPreview);
  log?.claudeRes?.(label, text);
  log?.api?.(
    model,
    resp?.usage?.input_tokens ?? 0,
    resp?.usage?.output_tokens ?? 0,
    Date.now() - startedAt,
  );
  return text;
}

const VISION_MODEL = "claude-haiku-4-5-20251001"; // cheap per-page visual check
const FIX_MODEL = "claude-sonnet-4-6"; // LaTeX repair (quality)
const PAGES_PER_CALL = 4; // images per Haiku request
const DEFAULT_DPI = 110; // legible enough for the model, small enough to be cheap

const IssueSchema = z.object({
  page: z.number(),
  type: z.string(), // raw_latex | overflow | clipped_image | broken_table | blank_page | overlap | other
  severity: z.enum(["high", "low"]).default("high"),
  quote: z.string().default(""), // exact on-page text the problem touches (for locating in source)
  description: z.string(),
});
type Issue = z.infer<typeof IssueSchema>;
const PageReviewSchema = z.object({ issues: z.array(IssueSchema).default([]) });
// Small, surgical patches — NOT full-chapter rewrites (those truncate & fail to
// parse). `find` is an exact substring of the chapter's LaTeX, `replace` its fix.
const PatchSchema = z.object({
  patches: z
    .array(
      z.object({
        chapterNumber: z.number(),
        find: z.string(),
        replace: z.string(),
        reason: z.string().default(""),
      }),
    )
    .default([]),
});

function imgBlock(filePath: string) {
  return {
    type: "image" as const,
    source: {
      type: "base64" as const,
      media_type: "image/png" as const,
      data: fs.readFileSync(filePath).toString("base64"),
    },
  };
}

/** Render every PDF page to PNG. Returns absolute paths in page order. */
export async function renderPages(
  buildDir: string,
  pdfName = "book.pdf",
  dpi = DEFAULT_DPI,
): Promise<string[]> {
  // clear any previous render
  for (const f of fs.readdirSync(buildDir)) {
    if (/^vr-page-\d+\.png$/.test(f)) fs.unlinkSync(path.join(buildDir, f));
  }
  await execAsync(`pdftoppm -png -r ${dpi} "${pdfName}" vr-page`, {
    timeout: 180000,
    cwd: buildDir,
  });
  return fs
    .readdirSync(buildDir)
    .filter((f) => /^vr-page-\d+\.png$/.test(f))
    .sort(
      (a, b) =>
        parseInt(a.match(/\d+/)![0], 10) - parseInt(b.match(/\d+/)![0], 10),
    )
    .map((f) => path.join(buildDir, f));
}

const REVIEW_PROMPT = `Jesteś korektorem składu książki. Oglądasz WYRENDEROWANE strony PDF gotowej książki i wykrywasz WYŁĄCZNIE defekty WIDOCZNE NA STRONIE — nie oceniasz treści merytorycznej.

Szukaj:
- raw_latex: widoczny SUROWY kod/komenda LaTeX wydrukowana jako tekst (np. "\\concept{...}", "\\stepflow{...}", "\\pullquote{...}", "\\bignumber{...}", samotne "\\textbackslash", widoczne nawiasy {} z komendą) — to ZAWSZE high.
- overflow: tekst/tabela wychodzą poza margines lub są ucięte na krawędzi strony.
- clipped_image / giant_image: obraz ucięty, zdeformowany, gigantyczny, nachodzący na tekst, albo pusty/szary prostokąt.
- broken_table: rozjechane kolumny, tabela wychodzi poza stronę, puste/zlane komórki.
- blank_page: strona pusta lub prawie pusta (poza celową stroną tytułową/przerywnikiem).
- overlap: nakładające się elementy, tekst na tekście, nagłówek/stopka zlane z treścią.

Dla KAŻDEGO problemu podaj: numer strony, type (jeden z powyższych), severity ("high" psuje odbiór / "low" kosmetyka), quote = DOKŁADNY fragment tekstu widoczny na stronie przy problemie (kilka słów — posłuży do odnalezienia w źródle; pusty gdy nie dotyczy), description (po polsku, zwięźle).

Jeśli strona jest poprawna — nie zgłaszaj nic dla niej. Zwróć WYŁĄCZNIE JSON: {"issues":[{"page":N,"type":"...","severity":"high|low","quote":"...","description":"..."}]}`;

/** Review a batch of pages with the vision model. */
async function reviewBatch(
  pngs: string[],
  startPage: number,
  log?: PLog,
): Promise<Issue[]> {
  const content: any[] = [
    {
      type: "text",
      text: `${REVIEW_PROMPT}\n\nOceniasz ${pngs.length} stron. Pierwszy obraz = STRONA ${startPage}, kolejne to ${startPage + 1}, ${startPage + 2}, ...`,
    },
  ];
  pngs.forEach((p, i) => {
    content.push({ type: "text", text: `STRONA ${startPage + i}:` });
    content.push(imgBlock(p));
  });
  const startedAt = Date.now();
  const resp = (await anthropic.messages.create({
    model: VISION_MODEL,
    max_tokens: 1500,
    messages: [{ role: "user", content }],
  } as any)) as any;
  const text = logLLM(
    log,
    `visual-review s.${startPage}-${startPage + pngs.length - 1}`,
    VISION_MODEL,
    `[${pngs.length} page images] ${REVIEW_PROMPT.slice(0, 120)}...`,
    resp,
    startedAt,
  );
  const parsed = parseLLMJson(text, PageReviewSchema);
  return parsed.ok ? parsed.data.issues : [];
}

/** Review every page; returns all high+low issues found. */
export async function reviewPdf(
  buildDir: string,
  pdfName = "book.pdf",
  log?: PLog,
): Promise<Issue[]> {
  const pages = await renderPages(buildDir, pdfName);
  log?.step?.(`Visual review: ${pages.length} pages rendered`);
  const all: Issue[] = [];
  for (let i = 0; i < pages.length; i += PAGES_PER_CALL) {
    const batch = pages.slice(i, i + PAGES_PER_CALL);
    try {
      const issues = await reviewBatch(batch, i + 1, log);
      all.push(...issues);
    } catch (e: any) {
      log?.warn?.(`Visual review batch @${i + 1} failed: ${e?.message}`);
    }
  }
  return all;
}

/** Ask Sonnet for surgical find/replace patches and apply them. Returns count applied. */
async function applyFixes(
  projectId: string,
  issues: Issue[],
  log?: PLog,
): Promise<number> {
  const chapters = await prisma.chapter.findMany({
    where: { projectId },
    orderBy: { chapterNumber: "asc" },
    select: { id: true, chapterNumber: true, title: true, latexContent: true, userEditedAt: true },
  });
  const editable = chapters.filter((c) => c.latexContent && !c.userEditedAt);
  if (!editable.length) return 0;

  const issueList = issues
    .map(
      (it) =>
        `- s.${it.page} [${it.type}/${it.severity}] ${it.description}${it.quote ? ` | widoczny tekst: "${it.quote}"` : ""}`,
    )
    .join("\n");
  const chaptersBlock = editable
    .map((c) => `=== ROZDZIAŁ ${c.chapterNumber}: ${c.title} ===\n${c.latexContent}`)
    .join("\n\n");

  const prompt = `Korektor wizualny obejrzał WYRENDEROWANE strony gotowej książki i wykrył defekty SKŁADU (nie treści):\n\n${issueList}\n\nPoniżej źródłowy LaTeX rozdziałów. Dla każdego defektu zwróć MINIMALNĄ łatkę find/replace (krótki, dokładny fragment źródła do podmiany — NIE cały rozdział). Pamiętaj: "widoczny tekst" to render, a w ŹRÓDLE może wyglądać inaczej (np. render pokazuje "\\concept{X}" bo w źródle jest podwójnie zaescapowane "\\textbackslash{}concept\\{X\\}" — wtedy find=dokładny zaescapowany ciąg ze źródła, replace="\\concept{X}").\n\nTypowe naprawy:\n- raw_latex: zaescapowana komenda drukuje się jako tekst → find=zaescapowany ciąg ze źródła, replace=prawdziwa komenda.\n- overflow / broken_table: zwęź/rozbij zawartość, tabularx, krótsza kolumna.\n- clipped_image / giant_image: zmniejsz width, [ht] zamiast [h], wyjmij \\begin{figure} z ramki tcolorbox (keyinsight/tipbox/...) tuż za nią.\n- overlap / blank_page: usuń zbędne \\clearpage / puste środowisko.\n\nKAŻDY find MUSI być dokładnym, unikalnym fragmentem występującym w podanym źródle danego rozdziału. NIE zmieniaj treści merytorycznej ani stylu.\n\nZwróć WYŁĄCZNIE JSON: {"patches":[{"chapterNumber":N,"find":"...","replace":"...","reason":"..."}]}\n\n${chaptersBlock}`;

  const startedAt = Date.now();
  const resp = (await anthropic.messages.create({
    model: FIX_MODEL,
    max_tokens: 8000,
    messages: [{ role: "user", content: prompt }],
  } as any)) as any;
  const text = logLLM(
    log,
    "visual-fix",
    FIX_MODEL,
    `${issues.length} issue(s) + ${editable.length} chapters`,
    resp,
    startedAt,
  );
  const parsed = parseLLMJson(text, PatchSchema);
  if (!parsed.ok) {
    log?.warn?.("Visual fix: could not parse patches JSON");
    return 0;
  }

  // Apply patches in memory per chapter (multiple patches may hit one chapter),
  // then persist once. Skip a patch whose `find` is absent or ambiguous.
  const updated = new Map<number, string>();
  let applied = 0;
  for (const p of parsed.data.patches) {
    const ch = editable.find((c) => c.chapterNumber === p.chapterNumber);
    if (!ch || !p.find || p.find === p.replace) continue;
    const current = updated.get(p.chapterNumber) ?? ch.latexContent!;
    const idx = current.indexOf(p.find);
    if (idx === -1) {
      log?.warn?.(`Visual fix: 'find' not located in Ch.${p.chapterNumber} — skipped`);
      continue;
    }
    const next =
      current.slice(0, idx) + p.replace + current.slice(idx + p.find.length);
    updated.set(p.chapterNumber, next);
    applied++;
    log?.step?.(`Visual fix Ch.${p.chapterNumber}: ${p.reason || p.find.slice(0, 40)}`);
  }
  for (const [chapterNumber, latex] of updated) {
    const ch = editable.find((c) => c.chapterNumber === chapterNumber)!;
    await prisma.chapter.update({ where: { id: ch.id }, data: { latexContent: latex } });
  }
  return applied;
}

/**
 * Full loop: review the compiled PDF, fix chapter LaTeX, recompile, repeat.
 * `recompile` re-assembles + re-runs lualatex (provided by the caller) and must
 * leave the fresh PDF at buildDir/book.pdf. Bounded by maxRounds.
 */
export async function visualReviewAndFix(
  projectId: string,
  buildDir: string,
  recompile: () => Promise<void>,
  _log?: any,
  maxRounds = 2,
): Promise<{ rounds: number; totalIssues: number; totalFixes: number }> {
  // Dedicated pipeline logger so EVERY LLM call (vision review + fix) lands in
  // the pipeline log with 📤 REQ / 📥 RES / 🤖 model | in | out.
  const log = createPipelineLogger("VISUAL", projectId);
  let totalIssues = 0;
  let totalFixes = 0;
  let round = 0;
  for (; round < maxRounds; round++) {
    const issues = await reviewPdf(buildDir, "book.pdf", log);
    const high = issues.filter((i) => i.severity === "high");
    log.step(
      `Visual review round ${round + 1}: ${issues.length} issue(s) (${high.length} high)`,
    );
    totalIssues += issues.length;
    if (high.length === 0) break; // only re-spin for high-severity defects
    const applied = await applyFixes(projectId, high, log);
    totalFixes += applied;
    if (applied === 0) break; // nothing actionable — stop looping
    await recompile();
  }
  return { rounds: round + 1, totalIssues, totalFixes };
}
