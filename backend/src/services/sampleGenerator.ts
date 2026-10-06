// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Free pre-payment STYLE SAMPLE — the opening of chapter 1, written and
// typeset by the same machinery as the paid book, shown as 2-3 page images.
//
//   brief      generateAuthorBrief (same generator; NOT persisted — the paid
//              pipeline makes its own with research)
//   text       contentGenerator.writeSampleOpening (same system prompt,
//              macros, sanitizers; no research → no hard numbers)
//   typeset    bookCompiler.assembleLatexDocument (customer's preset, format,
//              colours, language) → LuaLaTeX ×2 → pdftoppm
//
// Runs async (start + poll): text + typesetting can exceed the 60 s
// CloudFront origin timeout. One job at a time, so samples never compete
// with each other for the CPU the paid books need.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { prisma } from "../lib/prisma";
import { createPipelineLogger } from "../lib/logger";
import { getWordsPerPage, footnotesEnabled } from "../lib/types";
import { resolveNumbering } from "../lib/numbering";
import { generateAuthorBrief } from "./briefGenerator";
import { writeSampleOpening } from "./contentGenerator";
import { assembleLatexDocument } from "./bookCompiler";
import { normalizePreview, previewCostUsd } from "./previewGenerator";
import { resolveAutoDesign } from "./designPicker";

const execAsync = promisify(exec);

export const SAMPLE_DIR = path.join(process.cwd(), "tmp", "samples");
export const SAMPLE_MAX_PAGES = 2;
const MAX_ATTEMPTS = 2; // one retry after a failure, never more
export const SAMPLE_GLOBAL_DAY = (() => {
  const n = parseInt(process.env.SAMPLE_GLOBAL_DAY || "", 10);
  return Number.isFinite(n) && n >= 0 ? n : 100;
})();

export interface SampleState {
  status: "RUNNING" | "READY" | "FAILED";
  attempts: number;
  pages?: number;
  costUsd?: number;
  error?: string;
  /** cache-buster for the page images */
  rev?: number;
}

export function readSample(raw: unknown): SampleState | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as SampleState;
  return s.status ? s : null;
}

export function canStartSample(s: SampleState | null): boolean {
  if (!s) return true;
  if (s.status === "FAILED") return s.attempts < MAX_ATTEMPTS;
  return false;
}

// ── single-slot queue ──
let chain: Promise<unknown> = Promise.resolve();
function enqueue(job: () => Promise<void>) {
  chain = chain.then(job).catch(() => {});
}

/** Marks the sample RUNNING and queues the job; returns immediately. */
export async function startSample(projectId: string, userId: string, ip: string | null) {
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
  const prev = readSample(project.sample);
  const state: SampleState = {
    status: "RUNNING",
    attempts: (prev?.attempts ?? 0) + 1,
  };
  await prisma.project.update({
    where: { id: projectId },
    data: { sample: state as any },
  });
  enqueue(() => runSample(projectId, userId, ip, state.attempts));
  return state;
}

async function runSample(projectId: string, userId: string, ip: string | null, attempts: number) {
  const log = createPipelineLogger("SAMPLE", projectId);
  // Capture every model call's tokens for the cost ledger.
  const usage: Array<{ model: string; inTok: number; outTok: number }> = [];
  const origApi = log.api.bind(log);
  (log as any).api = (model: string, inTok: number, outTok: number) => {
    usage.push({ model, inTok, outTok });
    origApi(model, inTok, outTok);
  };
  const cost = () =>
    usage.reduce((a, u) => a + previewCostUsd(u.model, u.inTok, u.outTok), 0);

  const dir = path.join(SAMPLE_DIR, projectId);
  try {
    await resolveAutoDesign(projectId, log);
    const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
    const preview = normalizePreview(project.preview);
    if (!preview || preview.rejected || !preview.chapters.length) {
      throw new Error("no preview to sample");
    }

    // 1. Brief — same generator as the paid book, not persisted.
    const brief = await generateAuthorBrief({
      topic: project.topic,
      title: project.title,
      language: project.language,
      stylePreset: project.stylePreset,
      guidelines: project.guidelines,
      targetPages: project.targetPages,
      bookFormat: project.bookFormat,
      sourcesDigest: "",
      log,
    });
    const numbering = resolveNumbering({
      language: project.language,
      numberingMode: project.numberingMode,
      numberingLabel: project.numberingLabel,
      authorBrief: JSON.stringify(brief),
    });

    // 2. Text — the opening of chapter 1, ~2.5 pages of this format.
    const wpp = getWordsPerPage(project.bookFormat);
    const latex = await writeSampleOpening({
      bookTitle: preview.suggestedTitle || project.title || project.topic,
      topic: project.topic,
      language: project.language,
      stylePreset: project.stylePreset,
      guidelines: project.guidelines || "",
      brief,
      bookFormat: project.bookFormat,
      chapters: preview.chapters,
      allowFootnotes: footnotesEnabled(project),
      numbering,
      // Enough to fill both shown pages: the chapter band eats half of page
      // 1 and models undershoot word targets by ~25% (eval 2026-10-06: at
      // 2.6× wpp the A5 samples left page 2 two-thirds empty).
      words: Math.round(wpp * 4.7),
      log,
    });

    // 3. Typeset with the customer's look, chapter pages only.
    let customColors: string[] | undefined;
    try {
      customColors = project.customColors ? JSON.parse(project.customColors) : undefined;
    } catch {
      customColors = undefined;
    }
    const pages = await typesetSample(dir, {
      title: preview.suggestedTitle || project.title || project.topic,
      chapterTitle: preview.chapters[0].title,
      latex,
      language: project.language,
      format: project.bookFormat,
      stylePreset: project.stylePreset,
      customColors,
      stripFootnotes: !footnotesEnabled(project),
      numbering,
    });

    const costUsd = cost();
    await prisma.previewLog.create({
      data: {
        userId,
        projectId,
        ip,
        model: "sample",
        inputTokens: usage.reduce((a, u) => a + u.inTok, 0),
        outputTokens: usage.reduce((a, u) => a + u.outTok, 0),
        costUsd,
      },
    });
    await prisma.project.update({
      where: { id: projectId },
      data: {
        sample: {
          status: "READY",
          attempts,
          pages,
          costUsd,
          rev: Date.now(),
        } as any,
        totalCostUsd: { increment: costUsd },
      },
    });
    log.ok(`Sample ready: ${pages} pages, $${costUsd.toFixed(4)}`);
  } catch (err: any) {
    log.err(`Sample failed: ${err?.message}`);
    const costUsd = cost();
    await prisma.previewLog
      .create({
        data: { userId, projectId, ip, model: "sample", costUsd, ok: false },
      })
      .catch(() => {});
    await prisma.project
      .update({
        where: { id: projectId },
        data: {
          sample: {
            status: "FAILED",
            attempts,
            error: String(err?.message || err).slice(0, 300),
          } as any,
        },
      })
      .catch(() => {});
  }
}

/**
 * Typesets chapter-1 LaTeX exactly as the book would look (preset, format,
 * colours, language) and renders the first pages to page-N.png in `dir`.
 * Returns the number of page images. No LLM — also used by the local
 * smoke test scripts/sample-typeset-test.ts.
 */
export interface SampleTexInput {
  title: string;
  chapterTitle: string;
  latex: string;
  language: string;
  format: string;
  stylePreset: string;
  customColors?: string[];
  stripFootnotes: boolean;
  numbering: ReturnType<typeof resolveNumbering>;
}

/** The sample's complete .tex: the book's preamble, chapter 1 only. */
export function buildSampleTex(a: SampleTexInput): string {
  return assembleLatexDocument({
    title: a.title,
    language: a.language,
    format: a.format,
    stylePreset: a.stylePreset,
    customColors: a.customColors,
    coverType: "sample", // anything but NONE: no internal title page
    stripFootnotes: a.stripFootnotes,
    numbering: a.numbering,
    skipToc: true,
    chapters: [{ chapterNumber: 1, title: a.chapterTitle, latexContent: a.latex }],
  });
}

export async function typesetSample(dir: string, a: SampleTexInput): Promise<number> {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "sample.tex"), buildSampleTex(a), "utf8");
  const pdf = path.join(dir, "sample.pdf");
  // The chapter band (tikz overlay) needs two passes.
  for (let pass = 0; pass < 2; pass++) {
    await execAsync(
      `lualatex -interaction=nonstopmode -output-directory="${dir}" "${path.join(dir, "sample.tex")}"`,
      { cwd: dir, timeout: 120_000, maxBuffer: 10 * 1024 * 1024 },
    ).catch((e) => {
      // nonstopmode exits non-zero on recoverable errors; judge by the PDF.
      if (!fs.existsSync(pdf)) throw e;
    });
  }
  if (!fs.existsSync(pdf)) throw new Error("no PDF");

  // 170 dpi: sharp enough to read when the customer pinch-zooms a page.
  await execAsync(`pdftoppm -png -r 170 -f 1 -l ${SAMPLE_MAX_PAGES} sample.pdf page`, {
    cwd: dir,
    timeout: 60_000,
  });
  const files = fs
    .readdirSync(dir)
    .filter((f) => /^page-\d+\.png$/.test(f))
    .sort();
  if (!files.length) throw new Error("no page images");
  // Stable names page-1.png… regardless of pdftoppm's zero padding.
  files.forEach((f, i) => fs.renameSync(path.join(dir, f), path.join(dir, `_p${i + 1}.png`)));
  files.forEach((_, i) =>
    fs.renameSync(path.join(dir, `_p${i + 1}.png`), path.join(dir, `page-${i + 1}.png`)),
  );
  return files.length;
}
