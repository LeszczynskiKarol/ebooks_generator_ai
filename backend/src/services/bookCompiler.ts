// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BookForge — Book Compiler v2 (with PDF Versioning)
// Assemble .tex → pdflatex → version → upload S3
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { prisma } from "../lib/prisma";
import { exec } from "child_process";
import { promisify } from "util";
import { compileEpub } from "./epubCompiler";
import * as fs from "fs";
import * as path from "path";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { compileCover } from "./coverGenerator";
import {
  downloadProjectImages,
  rewriteImageUrls,
} from "../lib/projectImages";
import {
  repairControlCharLatex,
  mergeSplitTableHeaders,
} from "../lib/latexFixes";
import { footnotesEnabled } from "../lib/types";

const execAsync = promisify(exec);

import { resolveNumbering, NumberingSpec } from "../lib/numbering";

const LATEX_MAX_PASSES = 4;

// Snapshot of the auxiliary files a pass reads from the previous one. The
// build has converged when this is byte-identical between two consecutive
// passes (what latexmk does). The log's "Rerun to get ..." warning is NOT
// enough: tikz `remember picture` page positions live in .aux as
// \pgfsyspdfmark and shifting them does not trigger that warning — pass 2
// was declared converged while the chapter band was still drawn on the
// wrong page.
function auxSnapshot(buildDir: string): string {
  return ["book.aux", "book.toc", "book.out"]
    .map((f) => {
      const p = path.join(buildDir, f);
      return fs.existsSync(p) ? fs.readFileSync(p, "utf-8") : "";
    })
    .join("\u0000");
}

// True when the last lualatex run no longer asks for another pass AND the
// aux files did not change since the previous pass.
function latexConverged(
  logPath: string,
  buildDir: string,
  prevAux: string,
): boolean {
  if (!fs.existsSync(logPath)) return false;
  const log = fs.readFileSync(logPath, "utf-8");
  if (/Rerun to get|Rerun LaTeX|rerun LaTeX/i.test(log)) return false;
  return auxSnapshot(buildDir) === prevAux;
}

const BUILD_DIR = path.join(process.cwd(), "tmp", "builds");

// Bundled premium fonts (Source Serif 4 + Be Vietnam Pro) — resolved to an
// absolute path with forward slashes for fontspec's Path= option. Overridable
// via env for non-standard deployments.
const FONTS_DIR = (
  process.env.INKMAGNET_FONTS_DIR ||
  [
    path.resolve(__dirname, "../../assets/fonts"),
    path.resolve(process.cwd(), "assets/fonts"),
  ].find((d) => fs.existsSync(d)) ||
  path.resolve(process.cwd(), "assets/fonts")
).replace(/\\/g, "/");
const BABEL_LANG: Record<string, string> = {
  en: "english",
  pl: "polish",
  de: "ngerman",
  es: "spanish",
  fr: "french",
  it: "italian",
  pt: "portuguese",
  nl: "dutch",
};
const FONT_SIZE: Record<string, string> = {
  a5: "11pt",
  b5: "11pt",
  a4: "12pt",
  letter: "12pt",
};
const PAPER_SIZE: Record<string, string> = {
  a5: "a5paper",
  b5: "b5paper",
  a4: "a4paper",
  letter: "letterpaper",
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Compile: assemble .tex → pdflatex → version → upload S3
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function compileBook(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      structure: true,
      chapters: { orderBy: { chapterNumber: "asc" } },
    },
  });

  if (!project) throw new Error("Project not found");

  const readyChapters = project.chapters.filter(
    (c) => c.latexContent && c.status === "LATEX_READY",
  );
  if (readyChapters.length === 0) throw new Error("No LaTeX chapters ready");

  const bookTitle = project.title || project.topic;

  console.log(
    `\n📖 Compiling "${bookTitle}" — ${readyChapters.length} chapters`,
  );
  console.log("[COMPILE] project.title:", project.title);
  console.log("[COMPILE] project.topic:", project.topic);
  console.log("[COMPILE] bookTitle used:", bookTitle);
  await prisma.project.update({
    where: { id: projectId },
    data: { generationStatus: "COMPILING_LATEX", currentStage: "COMPILING" },
  });

  // Build directory
  const buildDir = path.join(BUILD_DIR, projectId);
  if (!fs.existsSync(buildDir)) fs.mkdirSync(buildDir, { recursive: true });
  console.log("  🖼️  Downloading project images...");
  const imageMap = await downloadProjectImages(projectId, buildDir);
  console.log(`  🖼️  ${imageMap.size} images downloaded`);
  try {
    // ── 1. Assemble full .tex document ──
    const customColors = project.customColors
      ? JSON.parse(project.customColors)
      : undefined;

    // ── 1.5 Compile the cover FIRST and include it in the main document.
    // The old flow merged it afterwards with pdfunite/pdftk, which destroyed
    // the internal TOC link destinations (links clicked but went nowhere).
    let coverPdfFile: string | undefined;
    if (project.coverType && project.coverType !== "NONE") {
      try {
        // AI-designed cover first (unique, designed+reviewed by the model);
        // the classic parametric generator remains the safety net. Uploaded
        // custom covers always go through the classic path untouched.
        let coverResult: { pdfPath: string } | null = null;
        if (
          project.coverType === "GENERATED" &&
          process.env.COVER_DESIGNER !== "off" &&
          // Routine books ship the agent's own coverLatex — compile it directly
          // (compileCover), don't run the API-billed FLUX cover designer.
          project.contentSource !== "routine"
        ) {
          try {
            const { designCover } = await import("./coverDesigner");
            coverResult = await designCover(projectId, {
              step: (m: string) => console.log(m),
              ok: (m: string) => console.log(m),
              warn: (m: string) => console.warn(m),
            });
          } catch (e: any) {
            console.warn(`  🎨 Cover designer failed (${e.message}) — falling back`);
          }
        }
        if (!coverResult) {
          coverResult = await compileCover(projectId);
        }
        if (fs.existsSync(coverResult.pdfPath)) {
          fs.copyFileSync(
            coverResult.pdfPath,
            path.join(buildDir, "cover.pdf"),
          );
          coverPdfFile = "cover.pdf";
          console.log("  📕 Cover compiled — included via pdfpages");
        }
      } catch (coverErr: any) {
        console.error(
          `  ⚠️ Cover compile failed (non-fatal): ${coverErr.message}`,
        );
      }
    }

    // Everything the document needs EXCEPT the chapters — reused verbatim when
    // the visual-review pass re-assembles after patching chapter LaTeX.
    const baseAssembleOpts = {
      title: bookTitle,
      language: project.language,
      authorName: project.authorName,
      subtitle: project.subtitle,
      format: project.bookFormat,
      imageMap,
      stylePreset: project.stylePreset,
      numbering: resolveNumbering(project),
      customColors,
      colophonText: project.colophonText,
      colophonFontSize: project.colophonFontSize,
      colophonEnabled: project.colophonEnabled ?? false,
      coverType: project.coverType,
      stripFootnotes: !footnotesEnabled(project),
      coverPdfFile,
    };

    const texContent = assembleLatexDocument({
      ...baseAssembleOpts,
      chapters: readyChapters,
    });

    const texPath = path.join(buildDir, "book.tex");
    fs.writeFileSync(texPath, texContent, "utf-8");
    console.log(
      `  📝 LaTeX assembled: ${texPath} (${texContent.length} chars)`,
    );

    // ── 2. Run pdflatex with retry + auto-fix ──
    // Passes run until the log stops asking for a rerun (min 2, max
    // LATEX_MAX_PASSES). Two fixed passes were NOT enough: the TOC is empty in
    // pass 1, so every chapter sits on an earlier page than in the final
    // layout; the tikz chapter band (remember picture/overlay) is placed from
    // the PREVIOUS pass's page positions, so in pass 2 it was drawn for the
    // wrong page and silently vanished — every prod book shipped with a blank
    // 50 mm gap where the chapter opener should be (Thermomix book, 2026-08-28).
    const pdfPath = path.join(buildDir, "book.pdf");
    const logPath = path.join(buildDir, "book.log");
    const MAX_ATTEMPTS = 3;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      let prevAux = "";
      for (let pass = 1; pass <= LATEX_MAX_PASSES; pass++) {
        console.log(
          `  🔄 pdflatex attempt ${attempt}/${MAX_ATTEMPTS}, pass ${pass}/${LATEX_MAX_PASSES}...`,
        );
        const auxBefore = auxSnapshot(buildDir);
        let passFailed = false;
        try {
          await execAsync(
            `lualatex -interaction=nonstopmode -output-directory="${buildDir}" "${texPath}"`,
            // cwd matters: \includepdf{cover.pdf} and images/ are resolved
            // relative to the process cwd, not -output-directory (TeX Live;
            // MiKTeX on the dev box searches the output dir, hence it "worked")
            { timeout: 180000, maxBuffer: 10 * 1024 * 1024, cwd: buildDir },
          );
        } catch (err: any) {
          passFailed = true;
          if (pass >= 2 && !fs.existsSync(pdfPath)) {
            if (attempt < MAX_ATTEMPTS) {
              const didFix = attemptLatexAutoFix(texPath, logPath);
              if (didFix) {
                break;
              }
            }
            if (attempt === MAX_ATTEMPTS) {
              const logContent = fs.existsSync(logPath)
                ? fs.readFileSync(logPath, "utf-8").slice(-3000)
                : "No log";
              console.error(
                `  ❌ pdflatex failed after ${MAX_ATTEMPTS} attempts. Last log:\n${logContent}`,
              );
              throw new Error("pdflatex compilation failed");
            }
          }
        }
        prevAux = auxBefore;
        if (!passFailed && pass >= 2 && latexConverged(logPath, buildDir, prevAux)) {
          console.log(`  ✅ LaTeX converged after ${pass} passes`);
          break;
        }
      }

      if (fs.existsSync(pdfPath)) {
        if (attempt > 1) {
          console.log(`  ✅ Compilation succeeded on attempt ${attempt}`);
        }
        break;
      }

      if (attempt < MAX_ATTEMPTS) {
        const didFix = attemptLatexAutoFix(texPath, logPath);
        if (!didFix) {
          console.log(`  ⚠️ No auto-fix possible, retrying anyway...`);
        }
      }
    }

    if (!fs.existsSync(pdfPath)) {
      throw new Error("PDF file not created after compilation");
    }

    const pdfSize = fs.statSync(pdfPath).size;
    console.log(`  ✅ PDF compiled: ${(pdfSize / 1024).toFixed(0)} KB`);

    // ── 2.5 Extract page count from PDF ──
    let pageCount: number | null = null;
    try {
      const { stdout } = await execAsync(
        `pdfinfo "${pdfPath}" 2>/dev/null | grep Pages | awk '{print $2}'`,
        { timeout: 5000 },
      );
      const parsed = parseInt(stdout.trim());
      if (!isNaN(parsed) && parsed > 0) pageCount = parsed;
    } catch {
      // pdfinfo might not be available — no problem
    }

    // (Cover is included via pdfpages during the main compile — no merge step.
    // pageCount from pdfinfo already includes the cover and its blank verso.)

    // A "successful" run can still produce a near-empty PDF when LaTeX aborts
    // mid-document (e.g. a missing babel language file) — a 1-page stub must
    // never reach the user as a finished book.
    const MIN_BOOK_PAGES = 4;
    if (pdfSize < 20 * 1024 || (pageCount !== null && pageCount < MIN_BOOK_PAGES)) {
      throw new Error(
        `Compiled PDF looks broken (${(pdfSize / 1024).toFixed(0)} KB, ${pageCount ?? "?"} pages) — check ${path.join(buildDir, "book.log")}`,
      );
    }

    // ── 2.6 VISUAL verification pass (vision QA → fix → recompile) ──
    // Render every page, have a vision model catch on-page defects (raw LaTeX
    // printed as text, overflow, clipped images, broken tables...), patch the
    // chapter LaTeX and recompile. Bounded; non-fatal (book ships either way).
    // Routine-authored books already had the agent's own (subscription) visual
    // QA — don't re-run the API-billed backend review on them.
    if (process.env.VISUAL_REVIEW !== "off" && project.contentSource !== "routine") {
      try {
        const { visualReviewAndFix } = await import("./visualReviewService");
        const recompile = async () => {
          const fresh = await prisma.chapter.findMany({
            where: { projectId },
            orderBy: { chapterNumber: "asc" },
          });
          const freshReady = fresh.filter(
            (c) => c.latexContent && c.status === "LATEX_READY",
          );
          const tex = assembleLatexDocument({
            ...baseAssembleOpts,
            chapters: freshReady,
          });
          fs.writeFileSync(texPath, tex, "utf-8");
          for (let pass = 1; pass <= LATEX_MAX_PASSES; pass++) {
            const auxBefore = auxSnapshot(buildDir);
            try {
              await execAsync(
                `lualatex -interaction=nonstopmode -output-directory="${buildDir}" "${texPath}"`,
                { timeout: 180000, maxBuffer: 10 * 1024 * 1024, cwd: buildDir },
              );
            } catch {
              /* judge by the PDF, like the main loop */
            }
            if (pass >= 2 && latexConverged(logPath, buildDir, auxBefore)) break;
          }
        };
        const vr = await visualReviewAndFix(projectId, buildDir, recompile, {
          step: (m: string) => console.log(`  🔍 ${m}`),
          warn: (m: string) => console.warn(`  ⚠️ ${m}`),
        });
        console.log(
          `  🔍 Visual review: ${vr.rounds} round(s), ${vr.totalIssues} issue(s), ${vr.totalFixes} fix(es) applied`,
        );
      } catch (vrErr: any) {
        console.warn(`  ⚠️ Visual review skipped (non-fatal): ${vrErr.message}`);
      }
    }

    // ── 3. Version management ──
    const newVersion = project.currentVersion + 1;
    const sanitizedTitle = sanitizeFilename(bookTitle);

    // Version-specific S3 key
    const s3Key = `books/${projectId}/v${newVersion}/${sanitizedTitle}.pdf`;
    // Also keep a "latest" key for backward compatibility
    const latestS3Key = `books/${projectId}/${sanitizedTitle}.pdf`;

    let pdfUrl: string;

    if (process.env.AWS_ACCESS_KEY_ID && process.env.S3_BUCKET) {
      // Upload versioned copy
      pdfUrl = await uploadToS3(pdfPath, s3Key);
      console.log(`  ☁️  Uploaded v${newVersion} to S3: ${s3Key}`);

      // Upload latest copy (overwrite)
      await uploadToS3(pdfPath, latestS3Key);
      console.log(`  ☁️  Updated latest: ${latestS3Key}`);
    } else {
      // Local: copy to versioned path
      const versionDir = path.join(BUILD_DIR, projectId, `v${newVersion}`);
      if (!fs.existsSync(versionDir))
        fs.mkdirSync(versionDir, { recursive: true });
      const versionPdfPath = path.join(versionDir, "book.pdf");
      fs.copyFileSync(pdfPath, versionPdfPath);
      pdfUrl = `/api/projects/${projectId}/download/pdf`;
      console.log(
        `  📁 S3 not configured — local v${newVersion}: ${versionPdfPath}`,
      );
    }

    // ── 4. Create BookVersion record ──
    await prisma.bookVersion.create({
      data: {
        projectId,
        version: newVersion,
        s3Key: s3Key,
        localPath: path.join(
          BUILD_DIR,
          projectId,
          `v${newVersion}`,
          "book.pdf",
        ),
        fileSize: pdfSize,
        pageCount,
        coverPdfS3Key: project.coverPdfS3Key || null, // ← ADD
        coverPdfLocalPath: project.coverPdfLocalPath || null, // ← ADD
        note:
          newVersion === 1 ? "Initial generation" : "Recompiled after editing",
      },
    });
    console.log(`  📋 Version ${newVersion} recorded in database`);

    // ── 4b. Save LaTeX source to version ──
    try {
      const texVersionDir = path.join(BUILD_DIR, projectId, `v${newVersion}`);
      if (!fs.existsSync(texVersionDir))
        fs.mkdirSync(texVersionDir, { recursive: true });
      const texVersionPath = path.join(texVersionDir, "book.tex");
      fs.copyFileSync(texPath, texVersionPath);

      const texSize = fs.statSync(texPath).size;

      if (process.env.AWS_ACCESS_KEY_ID && process.env.S3_BUCKET) {
        const texS3Key = `books/${projectId}/v${newVersion}/${sanitizedTitle}.tex`;
        await uploadToS3(texPath, texS3Key);

        await prisma.bookVersion.update({
          where: { projectId_version: { projectId, version: newVersion } },
          data: {
            texS3Key: texS3Key,
            texLocalPath: texVersionPath,
            texFileSize: texSize,
          },
        });
        console.log(`  📄 LaTeX source saved: ${texS3Key}`);
      } else {
        await prisma.bookVersion.update({
          where: { projectId_version: { projectId, version: newVersion } },
          data: {
            texLocalPath: texVersionPath,
            texFileSize: texSize,
          },
        });
      }
    } catch (texErr) {
      console.error(`  ⚠️ LaTeX version save failed (non-fatal):`, texErr);
    }

    // ── 5. Update project ──
    await prisma.project.update({
      where: { id: projectId },
      data: {
        outputPdfKey: latestS3Key,
        currentVersion: newVersion,
        generationStatus: "COMPLETED",
        currentStage: "COMPLETED",
      },
    });

    console.log(`\n📖 Book compiled and ready! v${newVersion} 🎉\n`);
    // ── 6// ── 6. EPUB compilation (non-blocking) ──
    try {
      console.log(`  📱 Starting EPUB compilation...`);
      await prisma.project.update({
        where: { id: projectId },
        data: { generationStatus: "COMPILING_EPUB" },
      });

      const epubResult = await compileEpub(projectId);
      console.log(
        `  📱 EPUB ready: ${epubResult.s3Key || epubResult.epubPath}`,
      );

      // Update BookVersion with EPUB info
      await prisma.bookVersion.update({
        where: { projectId_version: { projectId, version: newVersion } },
        data: {
          epubS3Key: epubResult.s3Key || null,
          epubLocalPath: epubResult.epubPath || null,
          epubFileSize: epubResult.fileSize || null,
        },
      });
      console.log(`  📱 Version ${newVersion} updated with EPUB info`);
    } catch (epubError) {
      console.error(`  ⚠️ EPUB compilation failed (non-fatal):`, epubError);
    }

    // Reset status to COMPLETED (might have been set to COMPILING_EPUB)
    await prisma.project.update({
      where: { id: projectId },
      data: {
        generationStatus: "COMPLETED",
        currentStage: "COMPLETED",
      },
    });

    return { pdfPath, pdfUrl, s3Key, version: newVersion };
  } catch (error) {
    console.error(`❌ Compilation failed:`, error);
    await prisma.project.update({
      where: { id: projectId },
      data: { generationStatus: "ERROR", currentStage: "ERROR" },
    });
    throw error;
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Assemble full LaTeX document
// (unchanged from original — keeping full function for completeness)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface AssembleParams {
  title: string;
  language: string;
  format: string;
  imageMap?: Map<string, string>;
  stylePreset: string;
  customColors?: string[];
  authorName?: string | null;
  subtitle?: string | null;
  colophonText?: string | null;
  colophonFontSize?: number | null;
  colophonEnabled?: boolean;
  coverType?: string; // when a real cover is merged, skip the internal title page
  /** popular books (footnoteMode off) — remove any \footnote the model emitted anyway */
  stripFootnotes?: boolean;
  coverPdfFile?: string; // pre-compiled cover PDF (relative to build dir) — included via pdfpages
  /** Heading numbering scheme (lib/numbering.ts). Defaults to hierarchical. */
  numbering?: NumberingSpec;
  chapters: {
    chapterNumber: number;
    title: string;
    latexContent: string | null;
  }[];
}

export function assembleLatexDocument(p: AssembleParams): string {
  const babel = BABEL_LANG[p.language] || "english";
  const fontSize = FONT_SIZE[p.format] || "11pt";
  const paperSize = PAPER_SIZE[p.format] || "a5paper";
  const isPolish = p.language === "pl";
  const styleConfig = getStyleConfig(p.stylePreset, paperSize);
  const year = new Date().getFullYear();
  const title = escapeLatex(p.title);

  // ── NEW: Author & subtitle with fallbacks ──
  const authorName = p.authorName ? escapeLatex(p.authorName) : "";
  const subtitle = p.subtitle ? escapeLatex(p.subtitle) : isPolish ? "" : "";

  const colorsBlock =
    p.customColors && p.customColors.length > 0
      ? deriveColorsFromCustom(p.customColors)
      : styleConfig.colors;

  const L: string[] = [];
  const add = (...lines: string[]) => L.push(...lines);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // PREAMBLE (unchanged except noted)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  add(
    "\\documentclass[" +
      fontSize +
      "," +
      paperSize +
      ",twoside,openany]{book}",
    "",
  );

  // LuaLaTeX + fontspec: real OTF fonts (no inputenc/fontenc needed).
  // Font pairing is chosen per Visual Style preset (see getFontSetup).
  add(
    "\\usepackage{fontspec}",
    "\\defaultfontfeatures{Ligatures=TeX}",
    "\\usepackage[" + babel + "]{babel}",
    "",
  );

  add(getFontSetup(p.stylePreset));
  add("");

  add(
    "\\usepackage[",
    "  " + paperSize + ",",
    "  inner=20mm, outer=15mm,",
    "  top=25mm, bottom=25mm,",
    "  headheight=36pt",
    "]{geometry}",
    "",
  );

  add("\\usepackage[dvipsnames,svgnames,x11names]{xcolor}");
  add(colorsBlock);
  add("");

  // ── Headers/footers: subtle, lowercase, truncated (no ugly ALL-CAPS overflow) ──
  add(
    "\\usepackage{fancyhdr}",
    "\\usepackage{truncate}",
    "\\pagestyle{fancy}",
    "\\fancyhf{}",
    // Strip the default ALL-CAPS + 'Chapter N.' prefix from running marks
    "\\renewcommand{\\chaptermark}[1]{\\markboth{#1}{}}",
    "\\renewcommand{\\sectionmark}[1]{\\markright{#1}}",
    // Chapter title (outer), section title (inner) — small sans, gray, ellipsised if long
    "\\fancyhead[LE]{\\footnotesize\\sffamily\\textcolor{headergray}{\\truncate{0.9\\headwidth}{\\leftmark}}}",
    "\\fancyhead[RO]{\\footnotesize\\sffamily\\textcolor{headergray}{\\truncate{0.9\\headwidth}{\\rightmark}}}",
    "\\fancyfoot[C]{\\small\\sffamily\\textcolor{headergray}{\\thepage}}",
    "\\renewcommand{\\headrulewidth}{0.4pt}",
    "\\renewcommand{\\headrule}{\\hbox to\\headwidth{\\color{rulecolor}\\leaders\\hrule height \\headrulewidth\\hfill}}",
    "\\fancypagestyle{plain}{",
    "  \\fancyhf{}",
    "  \\fancyfoot[C]{\\small\\sffamily\\textcolor{headergray}{\\thepage}}",
    "  \\renewcommand{\\headrulewidth}{0pt}",
    "}",
    "",
  );

  // ── titlesec: chapter + section styles in the PREAMBLE (declaring them in the
  //    document body made titlesec dump a stray "0pt" on the first page) ──
  add("\\usepackage{titlesec}");
  add(styleConfig.chapterStyle);
  // Numberless chapters (TOC heading "Spis treści", etc.) — clean block format so
  // titlesec does NOT leak the display 'sep' value (e.g. a stray "0pt") onto the page.
  add(
    "\\titleformat{name=\\chapter,numberless}{\\normalfont\\headingfont\\Huge\\bfseries\\color{chaptercolor}}{}{0pt}{}",
    "\\titlespacing*{name=\\chapter,numberless}{0pt}{30pt}{30pt}",
  );
  // Polish convention: trailing dot after the number ("1.1. Tytuł", not "1.1 Tytuł")
  add(
    styleConfig.sectionStyle
      .replace(/\\thesection(?=\})/g, "\\thesection.")
      .replace(/\\thesubsection(?=\})/g, "\\thesubsection."),
  );
  add(
    "\\titleformat{\\subsubsection}{\\normalfont\\normalsize\\bfseries\\color{sectioncolor}}{\\thesubsubsection.}{1em}{}",
  );
  add("");

  // ── Heading numbering scheme (per book — see lib/numbering.ts) ──
  const numbering = p.numbering || {
    mode: "hierarchical",
    itemLabel: null,
    itemCount: null,
    source: "default",
  };
  add(`% ── Numbering scheme: ${numbering.mode} (${numbering.source}) ──`);
  switch (numbering.mode) {
    case "chapters":
      // chapters keep their number (the band), sections/subsections don't
      add("\\setcounter{secnumdepth}{0}", "\\setcounter{tocdepth}{1}");
      break;
    case "none":
      // Keep secnumdepth at 0 so \chapter still takes the NUMBERED titlesec
      // path (= the full-bleed band); the number itself is hidden in the band
      // (\numberedchaptersfalse), blanked in running heads (\thechapter empty)
      // and dropped from the TOC (zero-width number column).
      add(
        "\\setcounter{secnumdepth}{0}",
        "\\setcounter{tocdepth}{1}",
        "\\numberedchaptersfalse",
        "\\renewcommand{\\thechapter}{}",
      );
      break;
    case "items":
      add(
        "\\setcounter{secnumdepth}{0}",
        "\\setcounter{tocdepth}{2}",
        "\\newcounter{bookitem}",
        `\\newcommand{\\itemlabel}{${escapeLatex(numbering.itemLabel || "Item")}}`,
        // One item = eyebrow line "PRZEPIS 52" in the section colour + an
        // unnumbered subsection title; TOC gets "52. Title".
        "\\newcommand{\\itemsection}[1]{%",
        "  \\par\\needspace{6\\baselineskip}%",
        "  \\refstepcounter{bookitem}%",
        "  \\vspace{1.6em}{\\noindent\\sffamily\\bfseries\\footnotesize\\color{sectioncolor}\\MakeUppercase{\\itemlabel}~\\thebookitem\\par}%",
        "  \\vspace{-1.5em}\\subsection*{#1}%",
        "  \\addcontentsline{toc}{subsection}{\\protect\\numberline{\\thebookitem}#1}}",
      );
      break;
    default:
      // hierarchical: book.cls defaults (secnumdepth 2)
      break;
  }
  if (numbering.mode !== "items") {
    // The model may still emit \itemsection in a non-items book (or the
    // owner switched the scheme after generation): degrade to a subsection.
    add("\\providecommand{\\itemsection}[1]{\\subsection{#1}}");
  }
  add("");

  // ── Page-break hygiene ──
  add(
    "\\usepackage{needspace}",
    // A section title's underline (titlerule) must not orphan onto the next page
    "\\let\\bforigsection\\section",
    "\\renewcommand{\\section}{\\needspace{4\\baselineskip}\\bforigsection}",
    // Blank verso pages inserted before chapters must not carry running heads
    "\\makeatletter",
    "\\renewcommand{\\cleardoublepage}{\\clearpage\\if@twoside\\ifodd\\c@page\\else\\hbox{}\\thispagestyle{empty}\\newpage\\fi\\fi}",
    "\\makeatother",
    "\\widowpenalty=10000",
    "\\clubpenalty=10000",
    "\\displaywidowpenalty=10000",
    "",
  );

  // ── Typography (unchanged) ──
  add(
    "\\usepackage{microtype}",
    "\\usepackage{setspace}",
    "\\onehalfspacing",
    "\\usepackage{parskip}",
    "",
  );

  // ── Lists (unchanged) ──
  add(
    "\\usepackage{enumitem}",
    "\\setlist[itemize]{",
    "  leftmargin=1.5em,",
    "  itemsep=3pt, parsep=0pt, topsep=6pt,",
    "  label=\\textcolor{accent}{\\textbullet}",
    "}",
    "\\setlist[enumerate]{",
    "  leftmargin=1.5em,",
    "  itemsep=3pt, parsep=0pt, topsep=6pt,",
    "  label=\\textcolor{accent}{\\arabic*.}",
    "}",
    "",
  );

  // ── Tables ──
  add(
    "\\usepackage{booktabs}",
    "\\usepackage{tabularx}",
    "\\usepackage{array}",
    "\\usepackage{colortbl}",
    "\\usepackage{float}",
    "\\usepackage{etoolbox}",
    "",
    "\\setlength{\\heavyrulewidth}{1.2pt}",
    "\\setlength{\\lightrulewidth}{0.6pt}",
    "\\setlength{\\aboverulesep}{8pt}",
    "\\setlength{\\belowrulesep}{8pt}",
    "",
    // Breathing room inside cells — default arraystretch/tabcolsep read as cramped
    "\\renewcommand{\\arraystretch}{1.35}",
    "\\setlength{\\tabcolsep}{7pt}",
    // X columns left-aligned: full justification in narrow columns creates
    // rivers of whitespace and the \"squeezed\" look
    "\\renewcommand{\\tabularxcolumn}[1]{>{\\raggedright\\arraybackslash}p{#1}}",
    // Slightly smaller table font — standard book typography
    "\\AtBeginEnvironment{table}{\\small}",
    // Eager float placement — without this an unbreakable table defers to the
    // next page and leaves a mostly-empty page behind it
    "\\renewcommand{\\topfraction}{0.9}",
    "\\renewcommand{\\bottomfraction}{0.6}",
    "\\renewcommand{\\textfraction}{0.07}",
    "\\renewcommand{\\floatpagefraction}{0.85}",
    "",
  );

  add("\\usepackage{graphicx}");
  add("\\usepackage{wrapfig}");
  add("\\usepackage{pdfpages}");

  // ── Drop caps (lettrine) for chapter openings ──
  add(
    "\\usepackage{lettrine}",
    "\\setcounter{DefaultLines}{2}",
    "\\renewcommand{\\LettrineFontHook}{\\color{chaptercolor}\\headingfont}",
    "",
  );

  // ── TikZ + tcolorbox (unchanged) ──
  add(
    "\\usepackage{tikz}",
    "\\usetikzlibrary{shadows.blur, chains, arrows.meta, positioning}",
    "\\usepackage[skins,breakable]{tcolorbox}",
    "",
  );

  // ── Colored boxes: tipbox, keyinsight, warningbox, examplebox (unchanged) ──
  add(
    "\\newtcolorbox{tipbox}[1][]{",
    "  enhanced, breakable,",
    "  colback=tipbg, colframe=tipframe,",
    "  boxrule=0pt, leftrule=3.5pt,",
    "  arc=2pt, outer arc=2pt, drop fuzzy shadow={black!18},",
    // top=14pt: the attached title dips ~2mm into the box — smaller padding
    // made it overlap the first body line
    "  left=10pt, right=10pt, top=14pt, bottom=8pt,",
    "  fonttitle=\\bfseries\\small\\color{tipframe},",
    "  title={#1},",
    "  before upper={\\parindent0pt\\small},",
    "  attach boxed title to top left={yshift=-2mm, xshift=4mm},",
    "  boxed title style={",
    "    colback=tipbg, colframe=tipbg,",
    "    boxrule=0pt, arc=0pt,",
    "    left=2pt, right=2pt, top=0.5pt, bottom=0.5pt",
    "  }",
    "}",
    "",
  );

  add(
    "\\newtcolorbox{keyinsight}[1][]{",
    "  enhanced, breakable,",
    "  colback=keybg, colframe=keyframe,",
    "  boxrule=0.8pt,",
    "  arc=4pt, outer arc=4pt, drop fuzzy shadow={black!18},",
    "  left=10pt, right=10pt, top=12pt, bottom=8pt,",
    "  fonttitle=\\bfseries\\small\\color{white},",
    "  title={#1},",
    "  before upper={\\parindent0pt\\small},",
    "  attach boxed title to top left={yshift=-\\tcboxedtitleheight/2, xshift=8mm},",
    "  boxed title style={",
    "    colback=keyframe, colframe=keyframe,",
    "    boxrule=0.8pt, arc=3pt,",
    "    left=4pt, right=4pt, top=2pt, bottom=2pt",
    "  }",
    "}",
    "",
  );

  add(
    "\\newtcolorbox{warningbox}[1][]{",
    "  enhanced, breakable,",
    "  colback=warnbg, colframe=warnframe,",
    "  boxrule=0pt, leftrule=3.5pt,",
    "  arc=2pt, outer arc=2pt, drop fuzzy shadow={black!18},",
    "  left=10pt, right=10pt, top=14pt, bottom=8pt,",
    "  fonttitle=\\bfseries\\small\\color{warnframe},",
    "  title={#1},",
    "  before upper={\\parindent0pt\\small},",
    "  attach boxed title to top left={yshift=-2mm, xshift=4mm},",
    "  boxed title style={",
    "    colback=warnbg, colframe=warnbg,",
    "    boxrule=0pt, arc=0pt,",
    "    left=2pt, right=2pt, top=0.5pt, bottom=0.5pt",
    "  }",
    "}",
    "",
  );

  add(
    "\\newtcolorbox{examplebox}[1][]{",
    "  enhanced, breakable,",
    "  colback=exbg, colframe=exframe,",
    "  boxrule=0.6pt,",
    "  arc=4pt, outer arc=4pt, drop fuzzy shadow={black!18},",
    "  left=10pt, right=10pt, top=14pt, bottom=8pt,",
    // exframe is a light gray — 80% black keeps the title legible on exbg
    "  fonttitle=\\bfseries\\small\\color{exframe!20!black},",
    "  title={#1},",
    "  before upper={\\parindent0pt\\small},",
    "  attach boxed title to top left={yshift=-2mm, xshift=4mm},",
    "  boxed title style={",
    "    colback=exbg, colframe=exbg,",
    "    boxrule=0pt, arc=0pt,",
    "    left=2pt, right=2pt, top=0.5pt, bottom=0.5pt",
    "  }",
    "}",
    "",
  );

  // ── checklistbox: end-of-chapter action checklist (ALL presets) ──
  // Defined with the same optional-title signature as the other boxes so the
  // brace→bracket fixer and the content prompt treat it identically.
  add(
    "\\newtcolorbox{checklistbox}[1][]{",
    "  enhanced, breakable,",
    "  colback=tipbg, colframe=tipframe,",
    "  boxrule=0pt, leftrule=3.5pt,",
    "  arc=2pt, outer arc=2pt,",
    "  left=10pt, right=10pt, top=14pt, bottom=8pt,",
    "  fonttitle=\\bfseries\\small\\color{tipframe},",
    "  title={#1},",
    "  before upper={\\parindent0pt\\small},",
    "  attach boxed title to top left={yshift=-2mm, xshift=4mm},",
    "  boxed title style={",
    "    colback=tipbg, colframe=tipbg,",
    "    boxrule=0pt, arc=0pt,",
    "    left=2pt, right=2pt, top=0.5pt, bottom=0.5pt",
    "  }",
    "}",
    "",
  );

  // ━━━ Premium visual layer — ALL presets, palette-driven ━━━
  // Flat boxes with icon tabs, branded footer, styled TOC, tight rhythm.
  // Visual layer only — environment NAMES are unchanged, so contentGenerator
  // output and the EPUB converter keep working for every preset. Colors come
  // from the preset palette (tipframe/bandcolor/accentgold/...), so each
  // preset keeps its own character.
  {
    add(
      "\\usepackage{fontawesome5}",
      "\\usepackage{titletoc}",
      "",
    );
    const premiumBox = (
      env: string,
      bg: string,
      frame: string,
      icon: string,
      extraUpper = "",
    ) =>
      [
        `\\renewtcolorbox{${env}}[1][]{`,
        "  enhanced, breakable,",
        `  colback=${bg}, colframe=${frame},`,
        "  boxrule=0pt,",
        `  borderline west={1.1mm}{0pt}{${frame}},`,
        "  arc=1.2mm, outer arc=1.2mm,",
        "  left=3.2mm, right=3.2mm, top=5.5mm, bottom=3.2mm,",
        // Chip tytułowy stoi okrakiem na górnej krawędzi (wystaje ~2mm ponad
        // ramkę), więc odstęp PRZED musi być większy niż PO — przy 5/5 chip
        // niemal dotykał tekstu powyżej.
        "  before skip=8.5mm, after skip=5mm,",
        `  before upper={\\parindent0pt\\small${extraUpper}},`,
        "  overlay unbroken and first={",
        `    \\node[anchor=west, fill=${frame}, text=white,`,
        "          font=\\headingfont\\bfseries\\scriptsize, inner xsep=2.4mm, inner ysep=1.5mm]",
        `      at ([xshift=4mm]frame.north west) {${icon}\\; #1};}`,
        "}",
        "",
      ].join("\n");
    add(
      premiumBox("tipbox", "tipbg", "tipframe", "\\faLightbulb"),
      premiumBox("keyinsight", "keybg", "keyframe", "\\faBookOpen"),
      premiumBox("warningbox", "warnbg", "warnframe", "\\faExclamationTriangle"),
      premiumBox("examplebox", "exbg", "exframe", "\\faComment"),
      premiumBox(
        "checklistbox",
        "tipbg",
        "tipframe",
        "\\faCheckSquare",
        // enumitem's global label= wins over \labelitemi — override locally
        "\\setlist[itemize]{label=\\textcolor{tipframe}{\\faSquare[regular]}, leftmargin=5.5mm, itemsep=1.5pt, topsep=2.5pt}",
      ),
    );
    // Tighter book rhythm: full parskip + 6pt list topsep read as loose on A4.
    add(
      "\\setlength{\\parskip}{5pt plus 2pt minus 1pt}",
      "\\setlist[itemize]{topsep=3pt, itemsep=2pt}",
      "\\setlist[enumerate]{topsep=3pt, itemsep=2pt}",
      "",
    );
    // Branded page tag in the outer footer corner + no header on plain pages
    add(
      "\\newcommand{\\PageTag}{\\begin{tikzpicture}[baseline=-2pt]",
      "  \\node[fill=bandcolor, text=white, font=\\headingfont\\bfseries\\scriptsize,",
      "        minimum width=8mm, minimum height=5mm, inner sep=0pt] {\\thepage};",
      "\\end{tikzpicture}}",
      "\\fancyfoot[C]{}",
      "\\fancyfoot[LE]{\\PageTag}",
      "\\fancyfoot[RO]{\\PageTag}",
      "\\renewcommand{\\headrulewidth}{0pt}",
      "\\fancypagestyle{plain}{",
      "  \\fancyhf{}",
      "  \\fancyfoot[LE]{\\PageTag}",
      "  \\fancyfoot[RO]{\\PageTag}",
      "  \\renewcommand{\\headrulewidth}{0pt}",
      "}",
      "",
    );
    // Styled table of contents: bold chapter rows, gold numbers, dotted leaders
    add(
      "\\titlecontents{chapter}[0mm]",
      "  {\\addvspace{3mm}\\headingfont\\bfseries\\small\\color{sectioncolor}}",
      "  {\\makebox[8mm][l]{\\textcolor{accentgold}{\\thecontentslabel}}}",
      "  {}{\\titlerule*[6pt]{\\textcolor{rulecolor}{.}}\\makebox[7mm][r]{\\thecontentspage}}",
      "\\titlecontents{section}[8mm]",
      "  {\\addvspace{0.8mm}\\sffamily\\footnotesize\\color{quotegray}}",
      "  {\\makebox[8mm][l]{\\thecontentslabel}}",
      "  {}{\\titlerule*[6pt]{\\textcolor{rulecolor}{.}}\\makebox[7mm][r]{\\thecontentspage}}",
      "",
    );
  }

  // ━━━ Rich visual MACROS — model supplies only data, never raw TikZ ━━━
  // These live in the template (written once, always compile), giving rich
  // graphics without exposing the model to fragile TikZ.
  add(
    "% \\pullquote{text} — large elegant pull quote",
    "\\newcommand{\\pullquote}[1]{%",
    "  \\par\\vspace{12pt}\\noindent",
    "  \\begin{tcolorbox}[blanker, breakable, left=2.2em, right=1em, top=2pt, bottom=2pt,",
    "    borderline west={2.5pt}{0pt}{accent}]",
    "    {\\color{chaptercolor}\\Large\\itshape #1}",
    "  \\end{tcolorbox}\\vspace{10pt}\\par",
    "}",
    "",
    "% \\bignumber{value}{label} — big statistic callout",
    "\\newcommand{\\bignumber}[2]{%",
    "  \\par\\vspace{8pt}\\noindent\\begin{minipage}{\\linewidth}\\centering",
    "  {\\headingfont\\bfseries\\color{accent}\\fontsize{40}{44}\\selectfont #1}\\\\[3pt]",
    "  {\\sffamily\\small\\color{sectioncolor}#2}",
    "  \\end{minipage}\\vspace{6pt}\\par",
    "}",
    "",
    "% \\stepflow{A, B, C, ...} — horizontal process flow (any number of steps)",
    "\\newcommand{\\stepflow}[1]{%",
    "  \\par\\vspace{10pt}\\begin{center}",
    "  \\resizebox{\\linewidth}{!}{%",
    "  \\begin{tikzpicture}[start chain=going right, node distance=7mm,",
    "    stepbox/.style={draw=accent, line width=0.6pt, fill=accent!8,",
    "      rounded corners=3pt, text width=2.0cm, align=center, minimum height=1.05cm,",
    "      inner sep=3pt, font=\\footnotesize\\sffamily, on chain,",
    "      join=by {-{Latex[length=2.2mm]}, accent, line width=0.7pt}}]",
    "    \\foreach \\stp in {#1} { \\node[stepbox] {\\stp}; }",
    "  \\end{tikzpicture}}",
    "  \\end{center}\\vspace{8pt}\\par",
    "}",
    "",
    "% \\concept{title}{description} — definition / concept callout",
    "\\newcommand{\\concept}[2]{%",
    "  \\par\\vspace{6pt}",
    "  \\begin{tcolorbox}[enhanced, breakable, colback=accent!6, colframe=accent,",
    "    boxrule=0pt, leftrule=3.5pt, arc=2pt, drop fuzzy shadow={black!15},",
    "    left=10pt, right=10pt, top=7pt, bottom=7pt, before upper={\\parindent0pt}]",
    "    {\\sffamily\\bfseries\\color{accent}#1}\\par\\vspace{2pt}\\small #2",
    "  \\end{tcolorbox}\\par",
    "}",
    "",
  );

  // ── Quote (unchanged) ──
  add(
    "\\usepackage{csquotes}",
    "\\renewenvironment{quote}{%",
    "  \\list{}{%",
    "    \\leftmargin=1.5em",
    "    \\rightmargin=1.5em",
    "    \\itshape",
    "    \\color{quotegray}",
    "  }%",
    "  \\item\\relax",
    "  \\hspace{-0.5em}\\textcolor{accent}{\\large\\textbf{``}}%",
    "}{%",
    "  \\endlist",
    "}",
    "",
  );

  // ── Hyperref (unchanged) ──
  add(
    "\\usepackage[hidelinks,unicode,",
    "  colorlinks=true,",
    "  linkcolor=linkcolor,",
    "  urlcolor=accent",
    "]{hyperref}",
    "",
  );

  // ── Captions (unchanged) ──
  add(
    "\\usepackage[",
    "  font={small},",
    "  labelfont={bf,color=accent},",
    "  textfont={color=captiongray},",
    "  skip=8pt",
    "]{caption}",
    "",
  );

  // ── TOC styling — entries colored, heading will be set separately ──
  add(
    "\\usepackage{tocloft}",
    "\\renewcommand{\\cftchapfont}{\\bfseries\\color{black}}",
    "\\renewcommand{\\cftchappagefont}{\\bfseries\\color{black}}",
    "\\renewcommand{\\cftsecfont}{\\color{black}}",
    "\\renewcommand{\\cftsecpagefont}{\\color{black}}",
    "\\renewcommand{\\cftchapleader}{\\cftdotfill{\\cftchapdotsep}}",
    "\\renewcommand{\\cftchapdotsep}{2.5}",
    "\\setlength{\\cftbeforechapskip}{6pt}",
    "",
    "% ── Trailing dots after section numbers (e.g. 1.2. instead of 1.2) ──",
    "\\renewcommand{\\cftchapaftersnum}{.}",
    "\\renewcommand{\\cftsecaftersnum}{.}",
    "\\renewcommand{\\cftsubsecaftersnum}{.}",
    // items scheme: the TOC subsection number is the item number ("52.") —
    // wider column, and items sit at section depth (they ARE the content)
    ...(numbering.mode === "items"
      ? [
          "\\setlength{\\cftsubsecnumwidth}{2.6em}",
          "\\setlength{\\cftsubsecindent}{\\cftsecindent}",
        ]
      : []),
    // none scheme: no chapter numbers in the TOC either
    ...(numbering.mode === "none"
      ? [
          "\\renewcommand{\\cftchapaftersnum}{}",
          "\\setlength{\\cftchapnumwidth}{0pt}",
        ]
      : []),
    "\\makeatletter",
    "\\renewcommand{\\@seccntformat}[1]{\\csname the#1\\endcsname.\\quad}",
    "\\makeatother",
    "",
  );

  add("\\graphicspath{{./images/}{./}}");
  add("");

  add("\\begin{document}", "");

  if (p.coverPdfFile) {
    add(
      "% ── Cover included natively (pdfunite/pdftk merging killed TOC links) ──",
      `\\includepdf[pages=1]{${p.coverPdfFile}}`,
      "\\null\\thispagestyle{empty}\\newpage",
      "\\setcounter{page}{1}",
      "",
    );
  }

  // ━━━ TITLE PAGE (internal) — skipped when a real cover PDF is merged in ━━━
  const includeInternalTitlePage = !p.coverType || p.coverType === "NONE";
  if (includeInternalTitlePage) {
    add(
    "\\begin{titlepage}",
    "\\thispagestyle{empty}",
    "",
    "\\begin{tikzpicture}[remember picture, overlay]",
    "",
    "  % ── Top accent bar ──",
    "  \\fill[accent] (current page.north west) rectangle",
    "    ([yshift=-5mm]current page.north east);",
    "",
    "  % ── Bottom accent bar ──",
    "  \\fill[accent] (current page.south west) rectangle",
    "    ([yshift=5mm]current page.south east);",
    "",
    "  % ── Title block (centered, upper area) ──",
    "  \\node[anchor=center, text width=0.82\\paperwidth, align=center]",
    "    at ([yshift=-0.33\\paperheight]current page.north) {",
    "      {\\fontsize{28}{34}\\selectfont\\bfseries\\color{black}\\hyphenpenalty=10000\\exhyphenpenalty=10000 " +
      title +
      "\\par}",
    "      \\vspace{0.7cm}",
    "      {\\color{accent}\\rule{5cm}{1.2pt}\\par}",
    "      \\vspace{0.5cm}",
    "      {\\large\\color{subtitlegray}" + subtitle + "\\par}",
    "    };",
    "",
  );

  // Author — absolutely positioned in lower-center area
  if (authorName) {
    add(
      "  % ── Author name ──",
      "  \\node[anchor=center] at ([yshift=0.18\\paperheight]current page.south) {",
      "    {\\Large\\color{black}" + authorName + "}",
      "  };",
    );
  }

  // Year — always at bottom
  add(
    "  % ── Year ──",
    "  \\node[anchor=center] at ([yshift=14mm]current page.south) {",
    "    {\\small\\color{subtitlegray}" + year + "}",
    "  };",
    "",
    "\\end{tikzpicture}",
    "",
    "\\end{titlepage}",
    "",
    );
  }

  // ━━━ COLOPHON / COPYRIGHT PAGE ━━━
  if (p.colophonEnabled && p.colophonText) {
    const colFontSize = p.colophonFontSize || 10;
    const latexSizeCmd: Record<number, string> = {
      8: "\\scriptsize",
      9: "\\footnotesize",
      10: "\\small",
      11: "\\normalsize",
      12: "\\large",
      14: "\\Large",
    };
    const sizeCmd = latexSizeCmd[colFontSize] || "\\small";
    const colophonLines = p.colophonText
      .split("\n")
      .map((line: string) =>
        line.trim() === ""
          ? "\\par\\vspace{0.5\\baselineskip}"
          : escapeLatex(line) + "\\par",
      )
      .join("\n    ");

    add(
      "% ── Colophon / Copyright page ──",
      "\\newpage",
      "\\thispagestyle{empty}",
      "~\\vfill",
      "\\begin{flushleft}",
      sizeCmd,
      "\\color{black}",
      "\\setlength{\\parskip}{0pt}",
      "\\setlength{\\parindent}{0pt}",
      "\\linespread{1.15}\\selectfont",
      "    " + colophonLines,
      "\\end{flushleft}",
      "\\vspace{20mm}",
      "\\clearpage",
      "",
    );
    console.log(
      "[COMPILE] Colophon page added (" + p.colophonText.length + " chars)",
    );
  } else {
    console.log(
      "[COMPILE] Colophon SKIPPED — enabled:",
      p.colophonEnabled,
      "textLen:",
      p.colophonText?.length || 0,
    );
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ★★★ TABLE OF CONTENTS — heading BLACK ★★★
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Use temporary chapter format (black) for the TOC heading,
  // then set the real colored chapter format for book content.
  add(
    "{",
    "  \\hypersetup{linkcolor=black}",
    "  \\tableofcontents",
    "}",
    "\\clearpage",
    "",
  );

  // ── Chapter content ──
  for (const ch of p.chapters) {
    if (ch.latexContent) {
      let content = sanitizeChapterLatex(ch.latexContent, p.language);
      if (p.stripFootnotes) content = removeFootnotes(content);

      // ── DEBUG: Check for image commands before rewriting ──
      const imgCmds = content.match(/\\includegraphics[^{]*\{[^}]+\}/g) || [];
      console.log(
        `  📷 Chapter ${ch.chapterNumber}: ${imgCmds.length} \\includegraphics found`,
      );
      imgCmds.forEach((cmd, i) =>
        console.log(`    [${i}] ${cmd.substring(0, 120)}`),
      );

      if (p.imageMap && p.imageMap.size > 0) {
        content = rewriteImageUrls(content, p.imageMap);

        // ── DEBUG: Verify rewriting worked ──
        const afterImgs =
          content.match(/\\includegraphics[^{]*\{[^}]+\}/g) || [];
        afterImgs.forEach((cmd, i) =>
          console.log(`    [${i}] AFTER rewrite: ${cmd.substring(0, 120)}`),
        );

        // Check if any S3 URLs survived (meaning rewrite missed them)
        for (const [url] of p.imageMap) {
          if (content.includes(url)) {
            console.error(`    ❌ URL NOT REWRITTEN: ${url.substring(0, 80)}`);
          }
        }
      }

      add(content);
      add("\\clearpage", "");
    }
  }

  add("\\end{document}");

  let assembled = L.join("\n");

  // ── Nuclear fix: strip \par from ALL sectioning/caption arguments in final output ──
  assembled = fixSectionArguments(assembled);

  // Also strip any remaining literal \par inside braced arguments of sectioning commands
  // This catches cases the brace-counting function might miss
  assembled = assembled.replace(
    /\\(section|subsection|chapter|caption)\*?(\{[^{}]*?)\\par\b/g,
    (match, cmd, before) => {
      console.log(`  🔧 Nuclear fix: stripped \\par from \\${cmd}{} argument`);
      return `\\${cmd}${before.endsWith("{") ? "{" : ""}${before.replace(/^\{/, "")} `;
    },
  );

  return assembled;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// LaTeX sanitization (unchanged)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const KNOWN_ENVS = [
  "tipbox",
  "keyinsight",
  "warningbox",
  "examplebox",
  "itemize",
  "enumerate",
  "quote",
  "table",
  "tabularx",
  "tabular",
  "center",
  "figure",
  "minipage",
  "description",
  "wrapfigure",
];

/**
 * Fix environment nesting order in LaTeX output.
 *
 * AI sometimes generates:
 *   \begin{table}
 *     \begin{tabularx}...
 *   \end{table}        ← WRONG: outer closed before inner
 *   \end{tabularx}     ← this causes "Missing \cr" fatal error
 *
 * This function detects and fixes reversed closings using:
 * 1. Direct pattern matching for known nesting pairs
 * 2. Stack-based analysis for complex/nested cases
 */
function fixEnvironmentNesting(latex: string): string {
  let result = latex;

  // ── Pass 1: Direct swap of known reversed pairs ──
  const nestingPairs: [string, string][] = [
    ["table", "tabularx"],
    ["table", "tabular"],
    ["figure", "center"],
    ["table", "center"],
  ];

  for (const [outer, inner] of nestingPairs) {
    const swappedRe = new RegExp(
      `(\\\\end\\{${outer}\\})(\\s*)(\\\\end\\{${inner}\\})`,
      "g",
    );
    result = result.replace(swappedRe, (_m, endOuter, ws, endInner) => {
      console.log(
        `  🔧 Nesting fix: swapped \\end{${outer}} / \\end{${inner}}`,
      );
      return `${endInner}${ws}${endOuter}`;
    });
  }

  // ── Pass 2: Stack-based nesting validation ──
  // Catches cases where inner \end{} is completely missing
  // e.g. \begin{table}\begin{tabularx}...\end{table} (no \end{tabularx} at all)
  const envRegex = /\\(begin|end)\{(tabularx?|table|figure|center)\}/g;
  const stack: string[] = [];
  const insertions: { pos: number; text: string }[] = [];
  let match;

  while ((match = envRegex.exec(result)) !== null) {
    const [, action, env] = match;
    if (action === "begin") {
      stack.push(env);
    } else {
      if (stack.length > 0 && stack[stack.length - 1] === env) {
        stack.pop();
      } else if (stack.length >= 2) {
        const topEnv = stack[stack.length - 1];
        const secondEnv = stack[stack.length - 2];
        if (secondEnv === env) {
          // Missing \end for inner env — insert it before this \end
          insertions.push({
            pos: match.index,
            text: `\\end{${topEnv}}\n`,
          });
          console.log(
            `  🔧 Nesting fix: inserting missing \\end{${topEnv}} before \\end{${env}}`,
          );
          stack.pop();
          stack.pop();
        }
      }
    }
  }

  // Apply in reverse to preserve positions
  for (const ins of insertions.reverse()) {
    result =
      result.substring(0, ins.pos) + ins.text + result.substring(ins.pos);
  }

  return result;
}

/**
 * Remove \par and collapse newlines inside \chapter{}, \section{}, \subsection{} arguments.
 * Handles nested braces properly (e.g. \section{\textbf{Title} with \par breaks}).
 */
function fixSectionArguments(latex: string): string {
  const cmds = ["chapter", "section", "subsection", "caption"];
  let result = latex;

  for (const cmd of cmds) {
    // Match \cmd or \cmd* followed by {
    const pattern = `\\\\${cmd}\\*?\\{`;
    const re = new RegExp(pattern, "g");

    let match;
    const replacements: { start: number; end: number; fixed: string }[] = [];

    while ((match = re.exec(result)) !== null) {
      const openBrace = match.index + match[0].length - 1; // position of {
      let depth = 1;
      let i = openBrace + 1;

      // Find matching closing brace
      while (i < result.length && depth > 0) {
        if (result[i] === "{" && result[i - 1] !== "\\") depth++;
        if (result[i] === "}" && result[i - 1] !== "\\") depth--;
        i++;
      }

      if (depth === 0) {
        const argContent = result.substring(openBrace + 1, i - 1);
        // Check if argument contains \par or multi-line content
        if (argContent.includes("\\par") || argContent.includes("\n")) {
          const cleaned = argContent
            .replace(/\\par\b/g, " ") // strip \par
            .replace(/\n+/g, " ") // collapse newlines
            .replace(/\s{2,}/g, " ") // collapse whitespace
            .trim();

          const prefix = result.substring(match.index, openBrace + 1); // e.g. \section{
          replacements.push({
            start: match.index,
            end: i,
            fixed: `${prefix}${cleaned}}`,
          });
          console.log(
            `  🔧 Section fix: cleaned \\${cmd}{} argument (${argContent.length} → ${cleaned.length} chars)`,
          );
        }
      }
    }

    // Apply replacements in reverse order to preserve positions
    for (const rep of replacements.reverse()) {
      result =
        result.substring(0, rep.start) + rep.fixed + result.substring(rep.end);
    }
  }

  return result;
}

/**
 * Strip model self-commentary that leaked into book content.
 * The continuation model sometimes explains itself in English
 * ("The previous output ended mid-table... Here is the clean continuation...").
 * Such a line is never valid book content — remove the whole paragraph.
 */
/**
 * Wrap the first letter of a chapter's opening paragraph in a \lettrine drop cap.
 * Only fires when that paragraph starts with a capital letter (never on a command
 * or a quote), so it is always safe. One drop cap per chapter.
 */
function addDropCap(latex: string): string {
  return latex.replace(
    /(\\chapter\{[^\n]*\}[ \t]*\n\s*\n[ \t]*)([A-ZŁŚŻŹĆĄĘÓŃ])([A-Za-ząćęłńóśźżĄĆĘŁŃÓŚŹŻ]+)/u,
    (_m, head, first, rest) => `${head}\\lettrine{${first}}{${rest}}`,
  );
}

export function stripModelMeta(latex: string): string {
  const META =
    /^.*\b(the previous output|clean continuation|picking up (from|where)|rewriting the (table|remainder|rest)|here is the (clean|corrected|continuation)|ended mid-(table|sentence|environment)|continuing from where|as (requested|instructed)|i(?:'ll| will) (now |)continue)\b.*$/gim;
  return latex.replace(META, "");
}

/**
 * Drop tables whose braces are unbalanced — i.e. truncated or garbled tables
 * (e.g. a cell cut off as `\textcolor{table`). A missing table is acceptable;
 * a broken one is a fatal `Missing \cr` / runaway-argument compile error.
 */
export function dropBrokenTables(latex: string): string {
  return latex.replace(
    /\\begin\{table\}[\s\S]*?\\end\{table\}\}?/g,
    (block: string) => {
      if (tabularIsBroken(block)) {
        console.log("  🔧 Dropped structurally-broken table");
        return "";
      }
      return block;
    },
  );
}

/**
 * A table is broken if a row terminator `\\` appears while a brace group is
 * still open — i.e. a cell was cut off mid-command (e.g. `\textcolor{table \\`).
 * This is robust against a stray balancing `}` elsewhere in the block.
 */
function tabularIsBroken(block: string): boolean {
  let depth = 0;
  for (let i = 0; i < block.length; i++) {
    // A row/table ending while a brace group is still open = truncated cell.
    if (block.startsWith("\\end{tabular", i)) {
      if (depth > 0) return true;
      i += "\\end{tabular".length - 1;
      continue;
    }
    const c = block[i];
    if (c === "\\") {
      if (block[i + 1] === "\\") {
        // row terminator "\\" while inside an open group → broken row
        if (depth > 0) return true;
        i++; // consume the second backslash
        continue;
      }
      i++; // escaped char / command start — skip next char (handles \{ \} \& \%)
      continue;
    }
    if (c === "{") depth++;
    else if (c === "}") depth = Math.max(0, depth - 1);
  }
  return false;
}

/**
 * Remove phantom row terminators that trigger
 * "Missing \cr before \end{tabularx}". A `\\` directly after a booktabs rule
 * or directly before `\end{tabular(x)}` creates an empty trailing row.
 */
export function fixTableRowTerminators(latex: string): string {
  return latex
    .replace(/(\\(?:top|mid|bottom)rule)\s*\\\\/g, "$1")
    .replace(/\\\\\s*(?=\s*\\end\{tabularx?\})/g, "");
}

/**
 * Normalize table float placement. Model-emitted [h]/[ht]/[H] often defers an
 * unbreakable table to the next page and leaves a near-empty page behind it.
 * [!htbp] lets LaTeX place the float at the first spot it fits.
 */
export function normalizeTablePlacement(latex: string): string {
  return latex.replace(
    /\\begin\{table\}(\[[^\]]*\])?/g,
    "\\begin{table}[!htbp]",
  );
}

/**
 * Wrap naked tabular(x) blocks (emitted outside a \begin{table} float) in a
 * [!htbp] float. A bare tabularx cannot break across pages, so when it doesn't
 * fit the remaining space it is pushed whole to the next page — leaving the
 * previous page mostly empty.
 */
export function wrapNakedTables(latex: string): string {
  const re = /\\(begin|end)\{(table|tabularx|tabular)\}/g;
  let tableDepth = 0; // depth of \begin{table} floats
  let nakedDepth = 0; // depth of tabular(x) envs inside an injected wrapper
  let wrapped = false;
  let out = "";
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = re.exec(latex)) !== null) {
    const [full, action, env] = m;
    out += latex.substring(last, m.index);
    last = m.index + full.length;

    if (env === "table") {
      tableDepth += action === "begin" ? 1 : -1;
      out += full;
      continue;
    }
    // tabular / tabularx
    if (tableDepth > 0) {
      out += full; // already inside a proper float
    } else if (action === "begin") {
      if (!wrapped) {
        out += "\\begin{table}[!htbp]\n\\centering\n" + full;
        wrapped = true;
        nakedDepth = 1;
      } else {
        nakedDepth++;
        out += full;
      }
    } else {
      // end of tabular kind outside a float
      if (wrapped) {
        nakedDepth--;
        if (nakedDepth === 0) {
          out += full + "\n\\end{table}";
          wrapped = false;
        } else {
          out += full;
        }
      } else {
        out += full;
      }
    }
  }
  out += latex.substring(last);
  if (wrapped) out += "\n\\end{table}"; // unbalanced input — close defensively
  return out;
}

/** Remove \footnote{...} with balanced-brace matching (footnotes may nest braces). */
function removeFootnotes(latex: string): string {
  let out = "";
  let i = 0;
  while (i < latex.length) {
    const idx = latex.indexOf("\\footnote{", i);
    if (idx === -1) {
      out += latex.slice(i);
      break;
    }
    out += latex.slice(i, idx);
    let depth = 0;
    let j = idx + "\\footnote".length;
    do {
      const c = latex[j];
      if (c === "{" && latex[j - 1] !== "\\") depth++;
      else if (c === "}" && latex[j - 1] !== "\\") depth--;
      j++;
    } while (j < latex.length && depth > 0);
    i = j;
  }
  return out;
}

function sanitizeChapterLatex(latex: string, language: string = "en"): string {
  let result = repairControlCharLatex(latex);
  result = mergeSplitTableHeaders(result);

  // ━━━ FIX 0: Decorative comment-separator lines ━━━
  // The model sometimes emits "% ─────" section separators. Upstream escaping
  // turns them into "\% ─────" which PRINTS (and the box-drawing glyphs are
  // missing from the text font → tofu boxes on the page). Drop such lines
  // entirely — both the escaped and the raw-comment form.
  result = result.replace(/^[ \t]*(?:\\%|%)[ \t]*[─━═—-]{3,}[ \t]*$\n?/gm, "");
  // Roundtrip corruption: \begin{tipbox}\n\textbackslash{}\{Title\textbackslash{}\}
  // Should be: \begin{tipbox}{Title}
  for (const box of [
    "tipbox",
    "keyinsight",
    "warningbox",
    "examplebox",
    "checklistbox",
  ]) {
    result = result.replace(
      new RegExp(
        `(\\\\begin\\{${box}\\})\\s*\\n\\s*(?:\\\\textbackslash\\{\\})*\\\\\\{(.+?)(?:\\\\textbackslash\\{\\})*\\\\\\}`,
        "g",
      ),
      (_match: string, begin: string, title: string) => {
        const cleanTitle = title.replace(/\\textbackslash\{\}/g, "").trim();
        console.log(
          `  🔧 Box title fix: \\begin{${box}}{${cleanTitle.substring(0, 50)}}`,
        );
        return `${begin}{${cleanTitle}}`;
      },
    );
  }

  // ━━━ FIX 1b: Box titles — brace syntax → optional-arg syntax ━━━
  // The tcolorbox envs are defined as \newtcolorbox{tipbox}[1][]{...title={#1}...},
  // i.e. the title is an OPTIONAL [arg]. The model (and the EPUB converter)
  // use \begin{tipbox}{Title} — in PDF that brace group rendered as plain body
  // text glued to the first sentence. Convert for LaTeX only.
  for (const box of [
    "tipbox",
    "keyinsight",
    "warningbox",
    "examplebox",
    "checklistbox",
  ]) {
    result = result.replace(
      new RegExp(
        `\\\\begin\\{${box}\\}\\{((?:[^{}]|\\{[^{}]*\\})*)\\}`,
        "g",
      ),
      (_m: string, title: string) =>
        `\\begin{${box}}[${title.replace(/\]/g, ")")}]`,
    );
  }

  // ━━━ FIX 2: Strip orphan \section{} content before first \chapter{} ━━━
  // Prevents sections being numbered as 0.1, 0.2, etc. in TOC
  const firstChapterIdx = result.indexOf("\\chapter{");
  if (firstChapterIdx > 0) {
    const beforeChapter = result.substring(0, firstChapterIdx);
    if (/\\section\{/.test(beforeChapter)) {
      result = result.substring(firstChapterIdx);
      console.log(
        `  🔧 Stripped ${beforeChapter.length} chars of orphan sections before first \\chapter{}`,
      );
    }
  }

  // ━━━ FIX 3: Ensure spacing around em-dashes and en-dashes ━━━
  // "word---word" → "word --- word", "word--word" → "word -- word"
  // Digits are excluded: number ranges (5--15, s.~228--229) must stay tight.
  result = result.replace(/([^\s\\{}\d-])---([^\s\\{}\d-])/g, "$1 --- $2");
  result = result.replace(/([^\s\\{}\d-])--([^\s\\{}\d-])/g, "$1 -- $2");
  // Collapse spaced number ranges the model produced itself: "228 -- 229" → "228--229"
  result = result.replace(/(\d)\s*---?\s*(\d)/g, "$1--$2");
  result = result.replace(/\b([IVX]{1,4})\s+---?\s+([IVX]{1,4})\b/g, "$1--$2");

  // ━━━ FIX 3b: Quote normalization ━━━
  // A straight `"` is an ACTIVE character under babel/polish (shorthand system):
  // `" j` eats the following space, `" -` becomes an invisible optional hyphen.
  // Normalize: closing straight quote → '' , opening straight quote → ,, (pl) / `` (else).
  result = result.replace(/(?<![\s\\])"/g, "''");
  result = result.replace(/(?<!\\)"(?=\S)/g, language === "pl" ? ",," : "``");
  // Model sometimes CLOSES a quote with ,, (opening mark) — flip to ''
  result = result.replace(/([^\s,]),,(?=$|[\s.,;:!?)\]—–-])/gm, "$1''");
  // Ensure a space after a closing quote glued to the next word: ''word → '' word
  result = result.replace(/''(?=[\p{L}\d])/gu, "'' ");
  // Polish typography: tie single-letter words (a/i/o/u/w/z) to the next
  // word with ~ so they never hang at line ends ("sierotki")
  result = result.replace(
    /(^|[\s(~])([aiouwzAIOUWZ])[ \t]+(?=[^\s\\&%—–-])/gm,
    "$1$2~",
  );

  // ━━━ FIX 4: Table header corruption — column spec leaking into \textbf{} ━━━
  // Pattern: \textbf{\{X X X\}\n\textbf{\n\textbf{Real Header}}} → \textbf{Real Header}
  result = result.replace(
    /\\textbf\{\\?\{[lcrXp|\s.{}0-9cm]+\\?\}\s*\\textbf\{\s*\\textbf\{([^}]+)\}\}\}/g,
    "\\textbf{$1}",
  );
  // Flatten remaining triple \textbf nesting: \textbf{\textbf{\textbf{X}}} → \textbf{X}
  result = result.replace(
    /\\textbf\{\\textbf\{\\textbf\{([^}]*)\}\}\}/g,
    "\\textbf{$1}",
  );

  // ━━━ FIX 5: Corrupted LaTeX commands from roundtrip escaping ━━━
  // \textbackslash{}textless\textbackslash{}\{...\} → \textless{}
  result = result.replace(/\\textbackslash\{\}textless/g, "\\textless{}");
  result = result.replace(
    /\\textless\{\}(?:\\textbackslash\{\})*\\?\{(?:\\textbackslash\{\})*\\?\}/g,
    "\\textless{}",
  );
  result = result.replace(/\\textbackslash\{\}textgreater/g, "\\textgreater{}");
  // $\textbackslash{}rightarrow$ → $\rightarrow$
  result = result.replace(
    /\$\\textbackslash\{\}rightarrow\$/g,
    "$\\rightarrow$",
  );

  // ━━━ FIX 6: Normalize quotation marks ━━━
  // Unicode Polish quotes → LaTeX notation
  result = result.replace(/\u201E/g, ",,"); // „ → ,,
  result = result.replace(/\u201D/g, "''"); // " → ''
  // ASCII straight quotes → Polish LaTeX quotes (short strings only)
  result = result.replace(/(?<!,)"([^"\n]{1,300}?)"(?!')/g, ",,$1''");

  // ━━━ FIX 6b: Table & meta-commentary hardening (compile-survival) ━━━
  // The biggest source of fatal compile errors. Robust passes:
  //   1) strip model self-talk that leaked into the book (e.g. continuation prose)
  //   2) drop tables with unbalanced braces (truncated/garbled — better gone than fatal)
  //   3) remove phantom row terminators that cause "Missing \cr before \end{tabularx}"
  //   4) wrap naked tabular(x) in a float + normalize placement to [!htbp]
  //      (prevents near-empty pages when an unbreakable table defers)
  result = stripModelMeta(result);
  result = dropBrokenTables(result);
  result = fixTableRowTerminators(result);
  result = wrapNakedTables(result);
  result = normalizeTablePlacement(result);
  result = addDropCap(result);

  // ── Escape unescaped % signs — in LaTeX % starts a comment ──
  // Chapter content should never have intentional % comments.
  // Unescaped % in \section{} titles is FATAL (hides closing brace).
  result = result.replace(/(?<!\\)%/g, "\\%");
  // ── NUCLEAR: strip \par globally from chapter content ──
  // \par in body text = blank line (no visual change). But inside \section{} it's FATAL.
  // AI never intentionally generates \par — it uses blank lines instead.
  result = result.replace(/\\par\b/g, "\n");
  // ── Fix \par and newlines inside \section{} / \chapter{} / \subsection{} ──
  // LaTeX doesn't allow \par inside section arguments — causes "Runaway argument" fatal error
  result = fixSectionArguments(result);
  // ── FIX: Strip exponential escaping corruption from round-trip bug ──
  // Pattern: \textbackslash\{\}textbackslash... repeated garbage
  // This happens when escapeLatexChars runs on already-escaped text multiple times

  // Strip massive \textbackslash\{\} chains (corruption artifacts)
  // Match sequences of \textbackslash, \{\}, \\\{\}, textbackslash without leading \
  result = result.replace(
    /(?:\\textbackslash\\?\{\}|textbackslash\\?\{\}|\\textbackslash\\\\\\?\{\}){2,}/g,
    "",
  );

  // Also catch the pattern with mixed textbackslash and \{\} \\\{\}
  result = result.replace(
    /(?:\\?textbackslash)?(?:\\{1,2}\{\\{0,2}\}){2,}(?:textbackslash)?(?:\\{1,2}\{\\{0,2}\})*/g,
    "",
  );

  // Nuclear option: any line that is >80% \textbackslash/\{\}/textbackslash gibberish → strip it
  result = result.replace(
    /^.*?(\\textbackslash|textbackslash\\?\{\}){5,}.*$/gm,
    (line) => {
      // Extract any readable text buried in the garbage
      const readable = line
        .replace(/\\textbackslash\\\{\}/g, "")
        .replace(/\\textbackslash\{\}/g, "")
        .replace(/textbackslash\\\{\}\{/g, "")
        .replace(/textbackslash\\\{\}/g, "")
        .replace(/textbackslash/g, "")
        .replace(/\\\{[^}]*\\\}/g, "")
        .replace(/\\\{/g, "")
        .replace(/\\\}/g, "")
        .replace(/\{/g, "")
        .replace(/\}/g, "")
        .trim();

      if (readable.length > 5) {
        console.log(
          `  🔧 Escape fix: recovered "${readable.substring(0, 60)}" from corrupted line`,
        );
        return readable;
      }
      console.log(
        `  🔧 Escape fix: stripped corrupted line (${line.length} chars)`,
      );
      return "";
    },
  );

  // Strip standalone column-spec lines leaked into table body
  // e.g. lines that are just "p{3cm}Xp{3cm}}" or "{lXXr}"
  result = result.replace(/^\s*\{?[lcrXp{}\d.cm\s|]+\}?\s*$/gm, (line) => {
    const t = line.trim();
    if (
      t.length > 1 &&
      t.length < 40 &&
      /[lcrXp]/.test(t) &&
      !/[a-zA-Z]{4,}/.test(t)
    ) {
      console.log(`  🔧 Table fix: removed leaked column spec: "${t}"`);
      return "";
    }
    return line;
  });

  // ── Balance known environments ──
  for (const env of KNOWN_ENVS) {
    const beginRe = new RegExp("\\\\begin\\{" + env + "\\}", "g");
    const endRe = new RegExp("\\\\end\\{" + env + "\\}", "g");
    const begins = (result.match(beginRe) || []).length;
    const ends = (result.match(endRe) || []).length;

    if (begins > ends) {
      const missing = begins - ends;
      for (let i = 0; i < missing; i++) {
        result += "\n\\end{" + env + "}";
      }
      console.log(`  🔧 LaTeX fix: added ${missing} missing \\end{${env}}`);
    } else if (ends > begins) {
      let toRemove = ends - begins;
      result = result.replace(
        new RegExp("\\\\end\\{" + env + "\\}", "g"),
        (match) => {
          if (toRemove > 0) {
            toRemove--;
            return "";
          }
          return match;
        },
      );
      console.log(
        `  🔧 LaTeX fix: removed ${ends - begins} orphan \\end{${env}}`,
      );
    }
  }

  //   // ── Fix environment nesting order ──
  result = fixEnvironmentNesting(result);

  // ── Balance braces ──
  let depth = 0;
  for (let i = 0; i < result.length; i++) {
    if (result[i] === "{" && (i === 0 || result[i - 1] !== "\\")) depth++;
    if (result[i] === "}" && (i === 0 || result[i - 1] !== "\\")) depth--;
  }
  if (depth > 0) {
    result += "}".repeat(depth);
    console.log(`  🔧 LaTeX fix: closed ${depth} unclosed braces`);
  }

  // ── Strip preamble artifacts ──
  result = result.replace(/\\documentclass[^]*?\\begin\{document\}/g, "");
  result = result.replace(/\\end\{document\}/g, "");
  result = result.replace(/\\usepackage(\[[^\]]*\])?\{[^}]*\}/g, "");

  // ── Balance tabularx specifically ──
  const tabxBegins = (result.match(/\\begin\{tabularx\}/g) || []).length;
  const tabxEnds = (result.match(/\\end\{tabularx\}/g) || []).length;
  if (tabxBegins > tabxEnds) {
    for (let i = 0; i < tabxBegins - tabxEnds; i++)
      result += "\n\\end{tabularx}";
    const tableBegins = (result.match(/\\begin\{table\}/g) || []).length;
    const tableEnds = (result.match(/\\end\{table\}/g) || []).length;
    if (tableBegins > tableEnds) {
      for (let i = 0; i < tableBegins - tableEnds; i++)
        result += "\n\\end{table}";
    }
  }

  // ── Strip prompt echo artifacts ──
  result = result.replace(/\\begin\{\.{0,3}\}/g, "");
  result = result.replace(/\\end\{\.{0,3}\}/g, "");
  result = result.replace(/^□\s+.*$/gm, "");
  result = result.replace(
    /^(QUALITY CHECKLIST|WORD COUNT TARGET|SECTIONS TO WRITE|RULES FOR CONTINUATION|Begin LaTeX output now).*$/gm,
    "",
  );
  result = result.replace(
    /^⚠️\s+(Hard limits|STRICT MAXIMUM|COMPLETE every|CONTINUITY|THIS IS THE FINAL|ENSURE every|STOP writing|Close every opened).*$/gm,
    "",
  );

  // ── TABLE SANITIZATION (safety net for converter bugs) ──

  // Replace |||MIDRULE||| markers leaked from HTML↔LaTeX converter
  result = result.replace(/\|\|\|MIDRULE\|\|\|/g, "\\midrule");

  // Clean escaped column-spec artifacts from table bodies
  // e.g. \{lXr\}, \{X X X\}, \{p{3cm} l r\}
  result = result.replace(/\\\{[lcrXp|.\s{}0-9cm]+\\\}/g, "");

  // Validate tabularx: fix column count mismatches
  result = result.replace(
    /\\begin\{tabularx\}\{[^}]*\}\{([^}]*)\}([\s\S]*?)\\end\{tabularx\}/g,
    (_match, colSpec, body) => {
      const expectedCols = (colSpec.match(/[lcrXp]/g) || []).length;
      if (expectedCols === 0) return _match;

      const lines = body.split("\n");
      const fixedLines = lines.map((line: string) => {
        const trimmed = line.trim();
        // Skip non-data lines
        if (!trimmed || /^\\(toprule|midrule|bottomrule|hline)/.test(trimmed)) {
          return line;
        }

        // If line has content but no & and no \\ — it's a broken row, add \\
        if (!trimmed.includes("&") && !trimmed.endsWith("\\\\")) {
          // Only fix if it looks like data (not a LaTeX command on its own)
          if (!/^\\[a-zA-Z]+/.test(trimmed)) {
            console.log(
              `  🔧 Table fix: added missing \\\\ to line: "${trimmed.substring(0, 50)}"`,
            );
            return line + " \\\\";
          }
          return line;
        }

        // Skip lines without & (pure commands etc.)
        if (!trimmed.includes("&")) return line;

        // A line ENDING with "&" is a continuation of a multi-line row
        // (e.g. a header written one cell per physical line — valid LaTeX).
        // Padding it with empty cells + \\ would split one logical row
        // into several broken ones (the invisible-header bug).
        if (trimmed.endsWith("&")) return line;

        // Extract row content (before \\)
        const rowMatch = trimmed.match(/^(.+?)(\s*\\\\)?\s*$/);
        if (!rowMatch) return line;

        const rowContent = rowMatch[1];
        const rowEnd = rowMatch[2] || " \\\\";
        const cells = rowContent.split("&");

        if (cells.length === expectedCols) return line;

        if (cells.length > expectedCols) {
          // Too many & — merge excess into last cell
          const fixed = [
            ...cells.slice(0, expectedCols - 1),
            cells.slice(expectedCols - 1).join(", "),
          ];
          console.log(
            `  🔧 Table fix: merged ${cells.length} cols → ${expectedCols}`,
          );
          return fixed.join(" & ") + rowEnd;
        }

        // Too few & — pad with empty cells
        const padded = [...cells];
        while (padded.length < expectedCols) padded.push(" ");
        console.log(
          `  🔧 Table fix: padded ${cells.length} cols → ${expectedCols}`,
        );
        return padded.join(" & ") + rowEnd;
      });

      return `\\begin{tabularx}{\\textwidth}{${colSpec}}${fixedLines.join("\n")}\\end{tabularx}`;
    },
  );

  // Ensure last data row before \bottomrule ends with \\
  // Ensure last data row before \bottomrule ends with \\
  result = result.replace(/([^\\])\n(\s*\\bottomrule)/g, "$1 \\\\\n$2");

  // Ensure last data row before \end{tabularx} ends with \\
  result = result.replace(/([^\\])\n(\s*\\end\{tabularx\})/g, "$1 \\\\\n$2");
  // Also handle case where \end{tabularx} is preceded by \end{table}
  result = result.replace(/([^\\])\n(\s*\\end\{tabular\})/g, "$1 \\\\\n$2");

  // ── Corrective: the three helpers above blindly add \\ before a rule/\end,
  //    which wrongly produces "\bottomrule \\" or "\\ \end{tabularx}" — a phantom
  //    empty row that triggers the fatal "Missing \cr". Strip those. ──
  result = result.replace(/(\\(?:top|mid|bottom)rule)\s*\\\\/g, "$1");
  result = result.replace(/\\\\(\s*\\end\{tabularx?\})/g, "$1");

  // ── Final cleanup ──
  result = result.replace(/\n{4,}/g, "\n\n\n");

  return result;
}

function attemptLatexAutoFix(texPath: string, logPath: string): boolean {
  if (!fs.existsSync(logPath)) return false;

  const log = fs.readFileSync(logPath, "utf-8");
  let tex = fs.readFileSync(texPath, "utf-8");
  let fixed = false;
  // ── Fix: Runaway argument — \par inside section/chapter/caption arguments ──
  if (log.includes("Runaway argument") || log.includes("@xdblarg")) {
    const before = tex;
    tex = fixSectionArguments(tex);

    // Also brute-force: find \par inside any \section{...}, \chapter{...}, \caption{...}
    // by scanning line-by-line
    const lines = tex.split("\n");
    for (let j = 0; j < lines.length; j++) {
      // If line has \section{...\par or \chapter{...\par, strip the \par
      if (/\\(section|subsection|chapter|caption)\*?\{.*\\par/.test(lines[j])) {
        lines[j] = lines[j].replace(/\\par\b/g, " ");
        console.log(
          `  🔧 Auto-fix: stripped \\par from sectioning command at line ${j + 1}`,
        );
      }
    }
    tex = lines.join("\n");

    if (tex !== before) {
      console.log(
        "  🔧 Auto-fix: removed \\par from section/chapter/caption arguments",
      );
      fixed = true;
    }
  }
  const unclosedMatch = log.match(
    /\\begin\{([^}]+)\} on input line (\d+) ended by \\end\{document\}/,
  );
  if (unclosedMatch) {
    const envName = unclosedMatch[1];
    const lineNum = parseInt(unclosedMatch[2]);
    console.log(
      `  🔧 Auto-fix: unclosed \\begin{${envName}} at line ${lineNum}`,
    );
    const lines = tex.split("\n");
    let endDocIdx = -1;
    for (let j = lines.length - 1; j >= 0; j--) {
      if (lines[j].includes("\\end{document}")) {
        endDocIdx = j;
        break;
      }
    }
    if (endDocIdx > 0) {
      lines.splice(endDocIdx, 0, `\\end{${envName}}`);
      tex = lines.join("\n");
      fixed = true;
    }
  }

  const mismatchMatch = log.match(
    /\\begin\{([^}]+)\}[^]*?ended by \\end\{([^}]+)\}/,
  );
  if (mismatchMatch && !unclosedMatch) {
    const beginEnv = mismatchMatch[1];
    const endEnv = mismatchMatch[2];
    console.log(
      `  🔧 Auto-fix: mismatch \\begin{${beginEnv}} vs \\end{${endEnv}}`,
    );
    tex = tex.replace(`\\end{${endEnv}}`, `\\end{${beginEnv}}`);
    fixed = true;
  }

  const undefMatch = log.match(
    /! Undefined control sequence\.\s*\n.*?l\.(\d+)\s*(\\[a-zA-Z]+)/,
  );
  if (undefMatch) {
    const lineNum = parseInt(undefMatch[1]);
    const cmd = undefMatch[2];
    console.log(
      `  🔧 Auto-fix: commenting out undefined ${cmd} at line ${lineNum}`,
    );
    const lines = tex.split("\n");
    if (lineNum > 0 && lineNum <= lines.length) {
      lines[lineNum - 1] = "% AUTO-FIX: " + lines[lineNum - 1];
      tex = lines.join("\n");
      fixed = true;
    }
  }

  if (log.includes("Missing \\endcsname inserted")) {
    const before = tex;
    tex = tex.replace(
      /^.*\\begin\{\.{0,3}\}.*$/gm,
      "% AUTO-FIX: removed prompt echo",
    );
    tex = tex.replace(
      /^.*\\end\{\.{0,3}\}.*$/gm,
      "% AUTO-FIX: removed prompt echo",
    );
    if (tex !== before) {
      console.log("  🔧 Auto-fix: stripped lines with empty \\begin{}/\\end{}");
      fixed = true;
    }
  }

  // ── Fix: Missing \cr at \end{tabularx} — table rows without \\ ──
  if (
    log.includes("Missing \\cr inserted") &&
    log.includes("\\end{tabularx}")
  ) {
    const lineMatch = log.match(/l\.(\d+)\s*\\end\{tabularx\}/);
    if (lineMatch) {
      const endLine = parseInt(lineMatch[1]);
      console.log(
        `  🔧 Auto-fix: Missing \\cr before \\end{tabularx} at line ${endLine}`,
      );
      const lines = tex.split("\n");

      // Find all tabularx environments and ensure every data row ends with \\
      let inTable = false;
      for (let j = 0; j < lines.length; j++) {
        if (lines[j].includes("\\begin{tabularx}")) {
          inTable = true;
          continue;
        }
        if (lines[j].includes("\\end{tabularx}")) {
          // Ensure previous non-empty line ends with \\
          for (let k = j - 1; k >= 0; k--) {
            const prev = lines[k].trim();
            if (!prev) continue;
            if (/^\\(toprule|midrule|bottomrule|hline)/.test(prev)) break;
            if (!prev.endsWith("\\\\")) {
              lines[k] = lines[k] + " \\\\";
              console.log(
                `  🔧 Auto-fix: added \\\\ to line ${k + 1}: "${prev.substring(0, 50)}"`,
              );
              fixed = true;
            }
            break;
          }
          inTable = false;
          continue;
        }
        if (inTable) {
          const trimmed = lines[j].trim();
          // Data row with & but no \\ at end
          if (
            trimmed &&
            trimmed.includes("&") &&
            !trimmed.endsWith("\\\\") &&
            !/^\\(toprule|midrule|bottomrule|hline)/.test(trimmed)
          ) {
            lines[j] = lines[j] + " \\\\";
            console.log(
              `  🔧 Auto-fix: added \\\\ to table row at line ${j + 1}`,
            );
            fixed = true;
          }
        }
      }
      if (fixed) tex = lines.join("\n");
    }
  }

  //   // Fix: reversed \end{table}/\end{tabularx} nesting
  if (log.includes("Missing \\cr inserted") || log.includes("Misplaced \\cr")) {
    const beforeSwap = tex;
    tex = tex.replace(/(\\end\{table\})(\s*)(\\end\{tabularx\})/g, "$3$2$1");
    tex = tex.replace(/(\\end\{table\})(\s*)(\\end\{tabular\})/g, "$3$2$1");
    if (tex !== beforeSwap) {
      console.log(
        "  🔧 Auto-fix: swapped reversed \\end{table}/\\end{tabularx}",
      );
      fixed = true;
    }
  }

  if (fixed) {
    fs.writeFileSync(texPath, tex, "utf-8");
    console.log(`  🔧 Auto-fix applied, retrying compilation...`);
  }

  return fixed;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Color utilities (unchanged)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return (
    "#" +
    [clamp(r), clamp(g), clamp(b)]
      .map((c) => c.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase()
  );
}

function tint(hex: string, ratio: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(
    r + (255 - r) * ratio,
    g + (255 - g) * ratio,
    b + (255 - b) * ratio,
  );
}

function shade(hex: string, ratio: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(r * (1 - ratio), g * (1 - ratio), b * (1 - ratio));
}

function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function rotateHue(hex: string, degrees: number): string {
  const [r, g, b] = hexToRgb(hex).map((c) => c / 255);
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0,
    s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  h = ((h * 360 + degrees) % 360) / 360;
  if (h < 0) h += 1;
  const hue2rgb = (p2: number, q2: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p2 + (q2 - p2) * 6 * t;
    if (t < 1 / 2) return q2;
    if (t < 2 / 3) return p2 + (q2 - p2) * (2 / 3 - t) * 6;
    return p2;
  };
  if (s === 0) {
    const v = Math.round(l * 255);
    return rgbToHex(v, v, v);
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p2 = 2 * l - q;
  return rgbToHex(
    Math.round(hue2rgb(p2, q, h + 1 / 3) * 255),
    Math.round(hue2rgb(p2, q, h) * 255),
    Math.round(hue2rgb(p2, q, h - 1 / 3) * 255),
  );
}

function stripHash(hex: string): string {
  return hex.replace("#", "");
}

function deriveColorsFromCustom(colors: string[]): string {
  const primary = colors[0];
  const secondary = colors.length >= 2 ? colors[1] : rotateHue(primary, 150);
  const tertiary = colors.length >= 3 ? colors[2] : rotateHue(primary, 210);
  // Headings, links and box frames print on white paper. A near-white pick
  // (users choose white for dark COVERS) made every heading invisible — the
  // "kuchnia śródziemnomorska" book shipped with chaptercolor=FFFFFF. For
  // "ink" roles use the darkest readable pick; fall back to a 55% shade.
  const READABLE = 0.62;
  const ink =
    [primary, secondary, tertiary].find((c) => luminance(c) <= READABLE) ??
    shade(primary, 0.55);
  const sec = luminance(secondary) <= READABLE ? secondary : ink;
  const ter = luminance(tertiary) <= READABLE ? tertiary : ink;
  const isDark = luminance(primary) < 0.4;
  return [
    "% ── Custom color palette ──",
    "\\definecolor{chaptercolor}{HTML}{" + stripHash(ink) + "}",
    "\\definecolor{sectioncolor}{HTML}{" + stripHash(shade(ink, 0.2)) + "}",
    "\\definecolor{accent}{HTML}{" + stripHash(ink) + "}",
    "\\definecolor{rulecolor}{HTML}{" + stripHash(tint(ink, 0.7)) + "}",
    "\\definecolor{headergray}{HTML}{6B7280}",
    "\\definecolor{quotegray}{HTML}{" + stripHash(shade(ink, 0.15)) + "}",
    "\\definecolor{captiongray}{HTML}{4B5563}",
    "\\definecolor{subtitlegray}{HTML}{6B7280}",
    "\\definecolor{linkcolor}{HTML}{" + stripHash(ink) + "}",
    "\\definecolor{titletextcolor}{HTML}{" +
      (isDark ? "FFFFFF" : "1F2937") +
      "}",
    "\\definecolor{tipbg}{HTML}{" + stripHash(tint(sec, 0.92)) + "}",
    "\\definecolor{tipframe}{HTML}{" + stripHash(shade(sec, 0.1)) + "}",
    "\\definecolor{keybg}{HTML}{" + stripHash(tint(ink, 0.92)) + "}",
    "\\definecolor{keyframe}{HTML}{" + stripHash(ink) + "}",
    "\\definecolor{warnbg}{HTML}{" + stripHash(tint(ter, 0.92)) + "}",
    "\\definecolor{warnframe}{HTML}{" + stripHash(shade(ter, 0.1)) + "}",
    "\\definecolor{exbg}{HTML}{" + stripHash(tint(sec, 0.95)) + "}",
    "\\definecolor{exframe}{HTML}{" + stripHash(sec) + "}",
    "\\definecolor{tableheadbg}{HTML}{" + stripHash(shade(ink, 0.15)) + "}",
    "\\definecolor{tableheadfg}{HTML}{FFFFFF}",
    // Premium-layer extras (harmless for other presets): full-bleed chapter
    // band, muted number tint on the band, fixed warm-gold accent.
    "\\definecolor{bandcolor}{HTML}{" + stripHash(ink) + "}",
    "\\definecolor{bandnum}{HTML}{" + stripHash(tint(ink, 0.45)) + "}",
    "\\definecolor{accentgold}{HTML}{B68D40}",
  ].join("\n");
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Style presets (unchanged — abbreviated for readability)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface StyleConfig {
  fontPackages: string;
  chapterStyle: string;
  sectionStyle: string;
  colors: string;
}

/**
 * fontspec font pairing per Visual Style preset (LuaLaTeX).
 * Uses only fonts that ship with MiKTeX/TeX Live (Libertinus, TeX Gyre) so
 * there are no missing-font failures. \headingfont is the display family used
 * by chapter/section titles for a serif-body / sans-heading contrast.
 */
function getFontSetup(preset: string): string {
  const setups: Record<string, string> = {
    // Premium: bundled Source Serif 4 body + Be Vietnam Pro display —
    // loaded by file path so no system font installation is required.
    premium: [
      "\\setmainfont{SourceSerif4}[",
      `  Path = ${FONTS_DIR}/, Extension = .otf,`,
      "  UprightFont = *-Regular, ItalicFont = *-It,",
      "  BoldFont = *-Semibold, BoldItalicFont = *-SemiboldIt ]",
      "\\setsansfont{BeVietnamPro}[",
      `  Path = ${FONTS_DIR}/, Extension = .ttf,`,
      "  UprightFont = *-Regular, ItalicFont = *-Italic,",
      "  BoldFont = *-SemiBold, BoldItalicFont = *-SemiBoldItalic ]",
      "\\newfontfamily\\headingfont{BeVietnamPro}[",
      `  Path = ${FONTS_DIR}/, Extension = .ttf,`,
      "  UprightFont = *-SemiBold, BoldFont = *-ExtraBold,",
      "  ItalicFont = *-SemiBoldItalic ]",
    ].join("\n"),
    // Formal scholarly: Times-like serif body, clean sans headings
    academic:
      "\\setmainfont{TeX Gyre Termes}\n\\setsansfont{TeX Gyre Heros}\n\\newfontfamily\\headingfont{TeX Gyre Heros}",
    // Bold/expressive: warm serif body, geometric sans display
    creative:
      "\\setmainfont{TeX Gyre Bonum}\n\\setsansfont{TeX Gyre Adventor}\n\\newfontfamily\\headingfont{TeX Gyre Adventor}",
    // Corporate: all sans
    business:
      "\\setmainfont{TeX Gyre Heros}\n\\setsansfont{TeX Gyre Heros}\n\\newfontfamily\\headingfont{TeX Gyre Heros}\n\\renewcommand{\\familydefault}{\\sfdefault}",
    // Clean/elegant: Libertinus serif + sans
    minimal:
      "\\setmainfont{Libertinus Serif}\n\\setsansfont{Libertinus Sans}\n\\newfontfamily\\headingfont{Libertinus Sans}",
    // Contemporary (default): Libertinus serif body, geometric sans headings
    modern:
      "\\setmainfont{Libertinus Serif}\n\\setsansfont{TeX Gyre Adventor}\n\\newfontfamily\\headingfont{TeX Gyre Adventor}",
  };
  return setups[preset] || setups.modern;
}

function getStyleConfig(preset: string, paperSize = "a5paper"): StyleConfig {
  // Premium chapter-opener geometry depends on the page size: the band must
  // fit up to THREE title lines (long Polish titles wrap) — a fixed-height
  // band clipped the third line against the gold rule on a4.
  const isA4 = paperSize === "a4paper";
  const band = isA4
    ? { h: "54", rule: "55.2", numSize: "44", numY: "-8", titleY: "-25", titleSize: "18", titleLead: "23", titleW: "165", after: "36" }
    : { h: "50", rule: "51.2", numSize: "40", numY: "-7", titleY: "-22", titleSize: "15.5", titleLead: "20", titleW: "112", after: "32" };
  // Full-bleed chapter band — shared by EVERY preset (palette-driven via
  // bandcolor/bandnum/accentgold, so each preset renders it in its own hues).
  const bandChapterStyle = [
    "\\makeatletter",
    "\\newif\\ifnumberedchapters\\numberedchapterstrue",
    "\\newcommand{\\PremiumChapterOpener}[1]{%",
    "  \\begin{tikzpicture}[remember picture,overlay]",
    `    \\fill[bandcolor] (current page.north west) rectangle ([yshift=-${band.h}mm]current page.north east);`,
    `    \\fill[accentgold] ([yshift=-${band.h}mm]current page.north west) rectangle ([yshift=-${band.rule}mm]current page.north east);`,
    "    \\ifnumberedchapters",
    `    \\node[anchor=north west, text=bandnum, font=\\headingfont\\bfseries\\fontsize{${band.numSize}}{${band.numSize}}\\selectfont]`,
    `      at ([xshift=18mm,yshift=${band.numY}mm]current page.north west) {\\two@digits{\\value{chapter}}};`,
    "    \\fi",
    "    \\node[anchor=north west, text=white, align=left,",
    `          font=\\headingfont\\bfseries\\fontsize{${band.titleSize}}{${band.titleLead}}\\selectfont, text width=${band.titleW}mm]`,
    `      at ([xshift=18mm,yshift=${band.titleY}mm]current page.north west)`,
    "      {\\hyphenpenalty=10000\\exhyphenpenalty=10000\\raggedright #1\\par};",
    "  \\end{tikzpicture}%",
    `  \\vspace*{${band.after}mm}}`,
    "\\makeatother",
    "\\titleformat{\\chapter}[block]{}{}{0pt}{\\PremiumChapterOpener}",
    "\\titlespacing*{\\chapter}{0pt}{-25mm}{12mm}",
  ].join("\n");
  switch (preset) {
    // Premium: the original of the shared visual layer — deep indigo + gold.
    // Palette here is the DEFAULT; customColors override it.
    case "premium":
      return {
        fontPackages: "",
        chapterStyle: bandChapterStyle,
        sectionStyle: [
          "\\titleformat{\\section}",
          "  {\\headingfont\\bfseries\\large\\color{sectioncolor}}{\\textcolor{accentgold}{\\thesection}}{0.7em}{}",
          "\\titleformat{\\subsection}{\\headingfont\\bfseries\\normalsize\\color{sectioncolor}}{\\textcolor{accentgold}{\\thesubsection}}{0.6em}{}",
        ].join("\n"),
        colors: `
\\definecolor{bandcolor}{HTML}{2E3456}
\\definecolor{bandnum}{HTML}{8B90B5}
\\definecolor{accentgold}{HTML}{B68D40}
\\definecolor{chaptercolor}{HTML}{2E3456}
\\definecolor{sectioncolor}{HTML}{23283F}
\\definecolor{accent}{HTML}{3D4573}
\\definecolor{rulecolor}{HTML}{C9CCE0}
\\definecolor{headergray}{HTML}{6B7280}
\\definecolor{quotegray}{HTML}{4A5568}
\\definecolor{captiongray}{HTML}{4A5568}
\\definecolor{subtitlegray}{HTML}{6B7280}
\\definecolor{linkcolor}{HTML}{3D4573}
\\definecolor{titletextcolor}{HTML}{1F2937}
\\definecolor{tipbg}{HTML}{EEF4F0}
\\definecolor{tipframe}{HTML}{38664E}
\\definecolor{keybg}{HTML}{EFF0F8}
\\definecolor{keyframe}{HTML}{3D4573}
\\definecolor{warnbg}{HTML}{F9F0F0}
\\definecolor{warnframe}{HTML}{883A3A}
\\definecolor{exbg}{HTML}{FAF5EB}
\\definecolor{exframe}{HTML}{B68D40}
\\definecolor{tableheadbg}{HTML}{2E3456}
\\definecolor{tableheadfg}{HTML}{FFFFFF}`,
      };
    case "academic":
      return {
        fontPackages: "\\usepackage{times}",
        chapterStyle: bandChapterStyle,
        sectionStyle: `\\titleformat{\\section}\n  {\\normalfont\\large\\bfseries\\color{sectioncolor}}{\\thesection}{1em}{}\n  [\\vspace{2pt}{\\color{rulecolor}\\titlerule[0.5pt]}]\n\\titleformat{\\subsection}{\\normalfont\\normalsize\\bfseries\\color{sectioncolor}}{\\thesubsection}{1em}{}`,
        colors: `\n\\definecolor{bandcolor}{HTML}{1A365D}\n\\definecolor{bandnum}{HTML}{7E93B8}\n\\definecolor{accentgold}{HTML}{B68D40}\n\\definecolor{chaptercolor}{HTML}{1A365D}\n\\definecolor{sectioncolor}{HTML}{2D3748}\n\\definecolor{accent}{HTML}{2B6CB0}\n\\definecolor{rulecolor}{HTML}{CBD5E0}\n\\definecolor{headergray}{HTML}{718096}\n\\definecolor{quotegray}{HTML}{4A5568}\n\\definecolor{captiongray}{HTML}{4A5568}\n\\definecolor{subtitlegray}{HTML}{718096}\n\\definecolor{linkcolor}{HTML}{2B6CB0}\n\\definecolor{titletextcolor}{HTML}{1A202C}\n\\definecolor{tipbg}{HTML}{F0FFF4}\n\\definecolor{tipframe}{HTML}{276749}\n\\definecolor{keybg}{HTML}{EBF8FF}\n\\definecolor{keyframe}{HTML}{2B6CB0}\n\\definecolor{warnbg}{HTML}{FFFAF0}\n\\definecolor{warnframe}{HTML}{C05621}\n\\definecolor{exbg}{HTML}{F7FAFC}\n\\definecolor{exframe}{HTML}{4A5568}\n\\definecolor{tableheadbg}{HTML}{2D3748}\n\\definecolor{tableheadfg}{HTML}{FFFFFF}`,
      };
    case "creative":
      return {
        fontPackages: "\\usepackage{palatino}",
        chapterStyle: bandChapterStyle,
        sectionStyle: `\\titleformat{\\section}\n  {\\normalfont\\Large\\bfseries\\color{sectioncolor}}{\\textcolor{accent}{\\thesection}}{1em}{}\n  [\\vspace{3pt}{\\color{accent}\\titlerule[1pt]}]\n\\titleformat{\\subsection}{\\normalfont\\large\\itshape\\color{sectioncolor}}{\\thesubsection}{1em}{}`,
        colors: `\n\\definecolor{bandcolor}{HTML}{5B21B6}\n\\definecolor{bandnum}{HTML}{B39DDB}\n\\definecolor{accentgold}{HTML}{B68D40}\n\\definecolor{chaptercolor}{HTML}{7C3AED}\n\\definecolor{sectioncolor}{HTML}{2D3748}\n\\definecolor{accent}{HTML}{8B5CF6}\n\\definecolor{rulecolor}{HTML}{DDD6FE}\n\\definecolor{headergray}{HTML}{6B7280}\n\\definecolor{quotegray}{HTML}{6B21A8}\n\\definecolor{captiongray}{HTML}{4A5568}\n\\definecolor{subtitlegray}{HTML}{6B7280}\n\\definecolor{linkcolor}{HTML}{7C3AED}\n\\definecolor{titletextcolor}{HTML}{1F2937}\n\\definecolor{tipbg}{HTML}{ECFDF5}\n\\definecolor{tipframe}{HTML}{059669}\n\\definecolor{keybg}{HTML}{F5F3FF}\n\\definecolor{keyframe}{HTML}{7C3AED}\n\\definecolor{warnbg}{HTML}{FFF7ED}\n\\definecolor{warnframe}{HTML}{EA580C}\n\\definecolor{exbg}{HTML}{FDF4FF}\n\\definecolor{exframe}{HTML}{A855F7}\n\\definecolor{tableheadbg}{HTML}{6D28D9}\n\\definecolor{tableheadfg}{HTML}{FFFFFF}`,
      };
    case "business":
      return {
        fontPackages:
          "\\usepackage{helvet}\\renewcommand{\\familydefault}{\\sfdefault}",
        chapterStyle: bandChapterStyle,
        sectionStyle: `\\titleformat{\\section}\n  {\\normalfont\\sffamily\\Large\\bfseries}{\\textcolor{accent}{\\thesection}}{1em}{}\n  [\\vspace{2pt}{\\color{rulecolor}\\titlerule[0.8pt]}]\n\\titleformat{\\subsection}{\\normalfont\\sffamily\\large\\bfseries\\color{sectioncolor}}{\\thesubsection}{1em}{}`,
        colors: `\n\\definecolor{bandcolor}{HTML}{1E3A5F}\n\\definecolor{bandnum}{HTML}{8CA3C7}\n\\definecolor{accentgold}{HTML}{B68D40}\n\\definecolor{chaptercolor}{HTML}{1E40AF}\n\\definecolor{sectioncolor}{HTML}{1F2937}\n\\definecolor{accent}{HTML}{2563EB}\n\\definecolor{rulecolor}{HTML}{BFDBFE}\n\\definecolor{headergray}{HTML}{6B7280}\n\\definecolor{quotegray}{HTML}{4B5563}\n\\definecolor{captiongray}{HTML}{4B5563}\n\\definecolor{subtitlegray}{HTML}{6B7280}\n\\definecolor{linkcolor}{HTML}{1E40AF}\n\\definecolor{titletextcolor}{HTML}{111827}\n\\definecolor{tipbg}{HTML}{F0FDF4}\n\\definecolor{tipframe}{HTML}{16A34A}\n\\definecolor{keybg}{HTML}{EFF6FF}\n\\definecolor{keyframe}{HTML}{2563EB}\n\\definecolor{warnbg}{HTML}{FFFBEB}\n\\definecolor{warnframe}{HTML}{D97706}\n\\definecolor{exbg}{HTML}{F8FAFC}\n\\definecolor{exframe}{HTML}{475569}\n\\definecolor{tableheadbg}{HTML}{1E3A5F}\n\\definecolor{tableheadfg}{HTML}{FFFFFF}`,
      };
    case "minimal":
      return {
        fontPackages: "",
        chapterStyle: bandChapterStyle,
        sectionStyle: `\\titleformat{\\section}\n  {\\normalfont\\large\\bfseries\\color{sectioncolor}}{\\thesection}{1em}{}\n\\titleformat{\\subsection}{\\normalfont\\normalsize\\bfseries\\color{sectioncolor}}{\\thesubsection}{1em}{}`,
        colors: `\n\\definecolor{bandcolor}{HTML}{374151}\n\\definecolor{bandnum}{HTML}{9CA3AF}\n\\definecolor{accentgold}{HTML}{B68D40}\n\\definecolor{chaptercolor}{HTML}{374151}\n\\definecolor{sectioncolor}{HTML}{4B5563}\n\\definecolor{accent}{HTML}{6B7280}\n\\definecolor{rulecolor}{HTML}{D1D5DB}\n\\definecolor{headergray}{HTML}{9CA3AF}\n\\definecolor{quotegray}{HTML}{6B7280}\n\\definecolor{captiongray}{HTML}{6B7280}\n\\definecolor{subtitlegray}{HTML}{9CA3AF}\n\\definecolor{linkcolor}{HTML}{4B5563}\n\\definecolor{titletextcolor}{HTML}{111827}\n\\definecolor{tipbg}{HTML}{F9FAFB}\n\\definecolor{tipframe}{HTML}{6B7280}\n\\definecolor{keybg}{HTML}{F3F4F6}\n\\definecolor{keyframe}{HTML}{4B5563}\n\\definecolor{warnbg}{HTML}{FEF9EF}\n\\definecolor{warnframe}{HTML}{92400E}\n\\definecolor{exbg}{HTML}{F9FAFB}\n\\definecolor{exframe}{HTML}{9CA3AF}\n\\definecolor{tableheadbg}{HTML}{374151}\n\\definecolor{tableheadfg}{HTML}{FFFFFF}`,
      };
    default:
      return {
        fontPackages: "\\usepackage{palatino}",
        chapterStyle: bandChapterStyle,
        sectionStyle: `\\titleformat{\\section}\n  {\\normalfont\\Large\\bfseries}{\\textcolor{accent}{\\thesection}}{1em}{}\n  [\\vspace{3pt}{\\color{accent}\\titlerule[0.8pt]}]\n\\titleformat{\\subsection}{\\normalfont\\large\\bfseries\\color{sectioncolor}}{\\thesubsection}{1em}{}`,
        colors: `\n\\definecolor{bandcolor}{HTML}{5B21B6}\n\\definecolor{bandnum}{HTML}{B39DDB}\n\\definecolor{accentgold}{HTML}{B68D40}\n\\definecolor{chaptercolor}{HTML}{7C3AED}\n\\definecolor{sectioncolor}{HTML}{374151}\n\\definecolor{accent}{HTML}{7C3AED}\n\\definecolor{rulecolor}{HTML}{DDD6FE}\n\\definecolor{headergray}{HTML}{6B7280}\n\\definecolor{quotegray}{HTML}{6B7280}\n\\definecolor{captiongray}{HTML}{4B5563}\n\\definecolor{subtitlegray}{HTML}{6B7280}\n\\definecolor{linkcolor}{HTML}{7C3AED}\n\\definecolor{titletextcolor}{HTML}{1F2937}\n\\definecolor{tipbg}{HTML}{ECFDF5}\n\\definecolor{tipframe}{HTML}{059669}\n\\definecolor{keybg}{HTML}{EFF6FF}\n\\definecolor{keyframe}{HTML}{2563EB}\n\\definecolor{warnbg}{HTML}{FFFBEB}\n\\definecolor{warnframe}{HTML}{D97706}\n\\definecolor{exbg}{HTML}{FAF5FF}\n\\definecolor{exframe}{HTML}{9333EA}\n\\definecolor{tableheadbg}{HTML}{5B21B6}\n\\definecolor{tableheadfg}{HTML}{FFFFFF}`,
      };
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// S3 upload + helpers (unchanged)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function uploadToS3(filePath: string, key: string): Promise<string> {
  const s3 = new S3Client({
    region: process.env.AWS_REGION || "eu-north-1",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });
  const fileContent = fs.readFileSync(filePath);
  const bucket = process.env.S3_BUCKET!;

  const contentType = key.endsWith(".epub")
    ? "application/epub+zip"
    : key.endsWith(".tex")
      ? "application/x-tex"
      : "application/pdf";

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: fileContent,
      ContentType: contentType,
    }),
  );
  return `https://${bucket}.s3.${process.env.AWS_REGION || "eu-north-1"}.amazonaws.com/${key}`;
}

function escapeLatex(text: string): string {
  return text
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/[&%$#_{}]/g, (m) => "\\" + m)
    .replace(/~/g, "\\textasciitilde{}")
    .replace(/\^/g, "\\textasciicircum{}");
}

function sanitizeFilename(name: string): string {
  const map: Record<string, string> = {
    ą: "a",
    ć: "c",
    ę: "e",
    ł: "l",
    ń: "n",
    ó: "o",
    ś: "s",
    ź: "z",
    ż: "z",
    Ą: "A",
    Ć: "C",
    Ę: "E",
    Ł: "L",
    Ń: "N",
    Ó: "O",
    Ś: "S",
    Ź: "Z",
    Ż: "Z",
  };
  return name
    .replace(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g, (c) => map[c] || c)
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .substring(0, 80);
}
