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
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const execAsync = promisify(exec);

const BUILD_DIR = path.join(process.cwd(), "tmp", "builds");
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

  const structureData = project.structure
    ? JSON.parse(project.structure.structureJson)
    : null;
  const bookTitle =
    structureData?.suggestedTitle || project.title || project.topic;

  console.log(
    `\n📖 Compiling "${bookTitle}" — ${readyChapters.length} chapters`,
  );

  await prisma.project.update({
    where: { id: projectId },
    data: { generationStatus: "COMPILING_LATEX", currentStage: "COMPILING" },
  });

  // Build directory
  const buildDir = path.join(BUILD_DIR, projectId);
  if (!fs.existsSync(buildDir)) fs.mkdirSync(buildDir, { recursive: true });

  try {
    // ── 1. Assemble full .tex document ──
    const customColors = project.customColors
      ? JSON.parse(project.customColors)
      : undefined;

    const texContent = assembleLatexDocument({
      title: bookTitle,
      language: project.language,
      format: project.bookFormat,
      stylePreset: project.stylePreset,
      customColors,
      chapters: readyChapters,
    });

    const texPath = path.join(buildDir, "book.tex");
    fs.writeFileSync(texPath, texContent, "utf-8");
    console.log(
      `  📝 LaTeX assembled: ${texPath} (${texContent.length} chars)`,
    );

    // ── 2. Run pdflatex with retry + auto-fix ──
    const pdfPath = path.join(buildDir, "book.pdf");
    const logPath = path.join(buildDir, "book.log");
    const MAX_ATTEMPTS = 3;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      for (let pass = 1; pass <= 2; pass++) {
        console.log(
          `  🔄 pdflatex attempt ${attempt}/${MAX_ATTEMPTS}, pass ${pass}/2...`,
        );
        try {
          await execAsync(
            `pdflatex -interaction=nonstopmode -output-directory="${buildDir}" "${texPath}"`,
            { timeout: 120000, maxBuffer: 10 * 1024 * 1024 },
          );
        } catch (err: any) {
          if (pass === 2 && !fs.existsSync(pdfPath)) {
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
        note:
          newVersion === 1 ? "Initial generation" : "Recompiled after editing",
      },
    });
    console.log(`  📋 Version ${newVersion} recorded in database`);

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
    // ── 6. EPUB compilation (non-blocking) ──
    // EPUB failure should NOT fail the whole pipeline
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
    } catch (epubError) {
      console.error(`  ⚠️ EPUB compilation failed (non-fatal):`, epubError);
      // Don't throw — PDF is already done, project stays COMPLETED
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
  stylePreset: string;
  customColors?: string[];
  chapters: {
    chapterNumber: number;
    title: string;
    latexContent: string | null;
  }[];
}

function assembleLatexDocument(p: AssembleParams): string {
  const babel = BABEL_LANG[p.language] || "english";
  const fontSize = FONT_SIZE[p.format] || "11pt";
  const paperSize = PAPER_SIZE[p.format] || "a5paper";
  const isPolish = p.language === "pl";
  const styleConfig = getStyleConfig(p.stylePreset);
  const year = new Date().getFullYear();
  const title = escapeLatex(p.title);
  const subtitle = isPolish
    ? "Wygenerowano przez BookForge.ai"
    : "Generated by BookForge.ai";

  const colorsBlock =
    p.customColors && p.customColors.length > 0
      ? deriveColorsFromCustom(p.customColors)
      : styleConfig.colors;

  const L: string[] = [];
  const add = (...lines: string[]) => L.push(...lines);

  add(
    "\\documentclass[" +
      fontSize +
      "," +
      paperSize +
      ",twoside,openright]{book}",
    "",
  );

  add(
    "\\usepackage[utf8]{inputenc}",
    "\\usepackage[T1]{fontenc}",
    "\\usepackage[" + babel + "]{babel}",
    "",
  );

  add("\\usepackage{lmodern}");
  if (styleConfig.fontPackages) add(styleConfig.fontPackages);
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

  add(
    "\\usepackage{fancyhdr}",
    "\\pagestyle{fancy}",
    "\\fancyhf{}",
    "\\fancyhead[LE]{\\small\\textcolor{headergray}{\\textit{\\leftmark}}}",
    "\\fancyhead[RO]{\\small\\textcolor{headergray}{\\textit{\\rightmark}}}",
    "\\fancyfoot[C]{\\textcolor{headergray}{\\thepage}}",
    "\\renewcommand{\\headrulewidth}{0.4pt}",
    "\\renewcommand{\\headrule}{\\hbox to\\headwidth{\\color{rulecolor}\\leaders\\hrule height \\headrulewidth\\hfill}}",
    "\\fancypagestyle{plain}{",
    "  \\fancyhf{}",
    "  \\fancyfoot[C]{\\textcolor{headergray}{\\thepage}}",
    "  \\renewcommand{\\headrulewidth}{0pt}",
    "}",
    "",
  );

  add("\\usepackage{titlesec}");
  add(styleConfig.chapterStyle);
  add(styleConfig.sectionStyle);
  add("");

  add(
    "\\usepackage{microtype}",
    "\\usepackage{setspace}",
    "\\onehalfspacing",
    "\\usepackage{parskip}",
    "",
  );

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

  add(
    "\\usepackage{booktabs}",
    "\\usepackage{tabularx}",
    "\\usepackage{array}",
    "\\usepackage{colortbl}",
    "\\usepackage{float}",
    "",
    "\\setlength{\\heavyrulewidth}{1.2pt}",
    "\\setlength{\\lightrulewidth}{0.6pt}",
    "\\setlength{\\aboverulesep}{8pt}",
    "\\setlength{\\belowrulesep}{8pt}",
    "",
  );

  add("\\usepackage{tikz}", "\\usepackage[skins,breakable]{tcolorbox}", "");

  // Tip Box
  add(
    "\\newtcolorbox{tipbox}[1][]{",
    "  enhanced, breakable,",
    "  colback=tipbg, colframe=tipframe,",
    "  boxrule=0pt, leftrule=3.5pt,",
    "  arc=0pt, outer arc=0pt,",
    "  left=10pt, right=10pt, top=8pt, bottom=8pt,",
    "  fonttitle=\\bfseries\\small\\color{tipframe},",
    "  title={#1},",
    "  before upper={\\parindent0pt\\small},",
    "  top=4pt,",
    "  attach boxed title to top left={yshift=-2mm, xshift=4mm},",
    "  boxed title style={",
    "    colback=tipbg, colframe=tipbg,",
    "    boxrule=0pt, arc=0pt,",
    "    left=2pt, right=2pt, top=1pt, bottom=1pt",
    "  }",
    "}",
    "",
  );

  // Key Insight Box
  add(
    "\\newtcolorbox{keyinsight}[1][]{",
    "  enhanced, breakable,",
    "  colback=keybg, colframe=keyframe,",
    "  boxrule=0.8pt,",
    "  arc=4pt, outer arc=4pt,",
    "  left=10pt, right=10pt, top=8pt, bottom=8pt,",
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

  // Warning Box
  add(
    "\\newtcolorbox{warningbox}[1][]{",
    "  enhanced, breakable,",
    "  colback=warnbg, colframe=warnframe,",
    "  boxrule=0pt, leftrule=3.5pt,",
    "  arc=0pt, outer arc=0pt,",
    "  left=10pt, right=10pt, top=8pt, bottom=8pt,",
    "  fonttitle=\\bfseries\\small\\color{warnframe},",
    "  title={#1},",
    "  before upper={\\parindent0pt\\small},",
    "  top=4pt,",
    "  attach boxed title to top left={yshift=-2mm, xshift=4mm},",
    "  boxed title style={",
    "    colback=warnbg, colframe=warnbg,",
    "    boxrule=0pt, arc=0pt,",
    "    left=2pt, right=2pt, top=1pt, bottom=1pt",
    "  }",
    "}",
    "",
  );

  // Example Box
  add(
    "\\newtcolorbox{examplebox}[1][]{",
    "  enhanced, breakable,",
    "  colback=exbg, colframe=exframe,",
    "  boxrule=0.6pt,",
    "  arc=4pt, outer arc=4pt,",
    "  left=10pt, right=10pt, top=8pt, bottom=8pt,",
    "  fonttitle=\\bfseries\\small\\color{exframe},",
    "  title={#1},",
    "  before upper={\\parindent0pt\\small},",
    "  attach boxed title to top left={yshift=-2mm, xshift=4mm},",
    "  boxed title style={",
    "    colback=exbg, colframe=exbg,",
    "    boxrule=0pt, arc=0pt,",
    "    left=2pt, right=2pt, top=1pt, bottom=1pt",
    "  }",
    "}",
    "",
  );

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

  add(
    "\\usepackage[hidelinks,unicode,",
    "  colorlinks=true,",
    "  linkcolor=linkcolor,",
    "  urlcolor=accent",
    "]{hyperref}",
    "",
  );

  add(
    "\\usepackage[",
    "  font={small},",
    "  labelfont={bf,color=accent},",
    "  textfont={color=captiongray},",
    "  skip=8pt",
    "]{caption}",
    "",
  );

  add(
    "\\usepackage{tocloft}",
    "\\renewcommand{\\cftchapfont}{\\bfseries\\color{chaptercolor}}",
    "\\renewcommand{\\cftchappagefont}{\\bfseries\\color{chaptercolor}}",
    "\\renewcommand{\\cftsecfont}{\\color{sectioncolor}}",
    "\\renewcommand{\\cftsecpagefont}{\\color{sectioncolor}}",
    "\\renewcommand{\\cftchapleader}{\\cftdotfill{\\cftchapdotsep}}",
    "\\renewcommand{\\cftchapdotsep}{2.5}",
    "\\setlength{\\cftbeforechapskip}{6pt}",
    "",
  );

  add(
    "\\title{\\Huge\\bfseries " + title + "}",
    "\\author{}",
    "\\date{}",
    "",
    "\\begin{document}",
    "",
  );

  add(
    "\\begin{titlepage}",
    "\\thispagestyle{empty}",
    "\\begin{tikzpicture}[remember picture, overlay]",
    "  \\fill[chaptercolor] (current page.north west) rectangle",
    "    ([yshift=-4cm]current page.north east);",
    "  \\fill[chaptercolor!15] (current page.south west) rectangle",
    "    ([yshift=2.5cm]current page.south east);",
    "\\end{tikzpicture}",
    "",
    "\\vspace*{5cm}",
    "",
    "\\begin{center}",
    "  {\\fontsize{28}{34}\\selectfont\\bfseries\\color{titletextcolor} " +
      title +
      "\\par}",
    "  \\vspace{0.8cm}",
    "  {\\color{accent}\\rule{4cm}{1.5pt}\\par}",
    "  \\vspace{0.6cm}",
    "  {\\large\\color{subtitlegray}" + subtitle + "\\par}",
    "\\end{center}",
    "",
    "\\vfill",
    "",
    "\\begin{center}",
    "  {\\small\\color{subtitlegray} " + year + "\\par}",
    "\\end{center}",
    "\\end{titlepage}",
    "",
  );

  add(
    "{",
    "  \\hypersetup{linkcolor=chaptercolor}",
    "  \\tableofcontents",
    "}",
    "\\clearpage",
    "",
  );

  for (const ch of p.chapters) {
    if (ch.latexContent) {
      add(
        "% ════════════════════════════════════════════",
        "% Chapter " + ch.chapterNumber + ": " + ch.title,
        "% ════════════════════════════════════════════",
        "",
      );
      add(sanitizeChapterLatex(ch.latexContent));
      add("\\clearpage", "");
    }
  }

  add("\\end{document}");

  return L.join("\n");
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
];

function sanitizeChapterLatex(latex: string): string {
  let result = latex;

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

  let depth = 0;
  for (let i = 0; i < result.length; i++) {
    if (result[i] === "{" && (i === 0 || result[i - 1] !== "\\")) depth++;
    if (result[i] === "}" && (i === 0 || result[i - 1] !== "\\")) depth--;
  }
  if (depth > 0) {
    result += "}".repeat(depth);
    console.log(`  🔧 LaTeX fix: closed ${depth} unclosed braces`);
  }

  result = result.replace(/\\documentclass[^]*?\\begin\{document\}/g, "");
  result = result.replace(/\\end\{document\}/g, "");
  result = result.replace(/\\usepackage(\[[^\]]*\])?\{[^}]*\}/g, "");

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
  result = result.replace(/\n{4,}/g, "\n\n\n");

  return result;
}

function attemptLatexAutoFix(texPath: string, logPath: string): boolean {
  if (!fs.existsSync(logPath)) return false;

  const log = fs.readFileSync(logPath, "utf-8");
  let tex = fs.readFileSync(texPath, "utf-8");
  let fixed = false;

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
  const isDark = luminance(primary) < 0.4;
  return [
    "% ── Custom color palette ──",
    "\\definecolor{chaptercolor}{HTML}{" + stripHash(primary) + "}",
    "\\definecolor{sectioncolor}{HTML}{" + stripHash(shade(primary, 0.2)) + "}",
    "\\definecolor{accent}{HTML}{" + stripHash(primary) + "}",
    "\\definecolor{rulecolor}{HTML}{" + stripHash(tint(primary, 0.7)) + "}",
    "\\definecolor{headergray}{HTML}{6B7280}",
    "\\definecolor{quotegray}{HTML}{" + stripHash(shade(primary, 0.15)) + "}",
    "\\definecolor{captiongray}{HTML}{4B5563}",
    "\\definecolor{subtitlegray}{HTML}{6B7280}",
    "\\definecolor{linkcolor}{HTML}{" + stripHash(primary) + "}",
    "\\definecolor{titletextcolor}{HTML}{" +
      (isDark ? "FFFFFF" : "1F2937") +
      "}",
    "\\definecolor{tipbg}{HTML}{" + stripHash(tint(secondary, 0.92)) + "}",
    "\\definecolor{tipframe}{HTML}{" + stripHash(shade(secondary, 0.1)) + "}",
    "\\definecolor{keybg}{HTML}{" + stripHash(tint(primary, 0.92)) + "}",
    "\\definecolor{keyframe}{HTML}{" + stripHash(primary) + "}",
    "\\definecolor{warnbg}{HTML}{" + stripHash(tint(tertiary, 0.92)) + "}",
    "\\definecolor{warnframe}{HTML}{" + stripHash(shade(tertiary, 0.1)) + "}",
    "\\definecolor{exbg}{HTML}{" + stripHash(tint(secondary, 0.95)) + "}",
    "\\definecolor{exframe}{HTML}{" + stripHash(secondary) + "}",
    "\\definecolor{tableheadbg}{HTML}{" + stripHash(shade(primary, 0.15)) + "}",
    "\\definecolor{tableheadfg}{HTML}{FFFFFF}",
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

function getStyleConfig(preset: string): StyleConfig {
  switch (preset) {
    case "academic":
      return {
        fontPackages: "\\usepackage{times}",
        chapterStyle: `\\titleformat{\\chapter}[display]\n  {\\normalfont\\Large\\bfseries}{\\textcolor{chaptercolor}{\\chaptertitlename\\ \\thechapter}}{10pt}{\\LARGE\\color{chaptercolor}}\n\\titlespacing*{\\chapter}{0pt}{-10pt}{25pt}`,
        sectionStyle: `\\titleformat{\\section}\n  {\\normalfont\\large\\bfseries\\color{sectioncolor}}{\\thesection}{1em}{}\n  [\\vspace{2pt}{\\color{rulecolor}\\titlerule[0.5pt]}]\n\\titleformat{\\subsection}{\\normalfont\\normalsize\\bfseries\\color{sectioncolor}}{\\thesubsection}{1em}{}`,
        colors: `\n\\definecolor{chaptercolor}{HTML}{1A365D}\n\\definecolor{sectioncolor}{HTML}{2D3748}\n\\definecolor{accent}{HTML}{2B6CB0}\n\\definecolor{rulecolor}{HTML}{CBD5E0}\n\\definecolor{headergray}{HTML}{718096}\n\\definecolor{quotegray}{HTML}{4A5568}\n\\definecolor{captiongray}{HTML}{4A5568}\n\\definecolor{subtitlegray}{HTML}{718096}\n\\definecolor{linkcolor}{HTML}{2B6CB0}\n\\definecolor{titletextcolor}{HTML}{1A202C}\n\\definecolor{tipbg}{HTML}{F0FFF4}\n\\definecolor{tipframe}{HTML}{276749}\n\\definecolor{keybg}{HTML}{EBF8FF}\n\\definecolor{keyframe}{HTML}{2B6CB0}\n\\definecolor{warnbg}{HTML}{FFFAF0}\n\\definecolor{warnframe}{HTML}{C05621}\n\\definecolor{exbg}{HTML}{F7FAFC}\n\\definecolor{exframe}{HTML}{4A5568}\n\\definecolor{tableheadbg}{HTML}{2D3748}\n\\definecolor{tableheadfg}{HTML}{FFFFFF}`,
      };
    case "creative":
      return {
        fontPackages: "\\usepackage{palatino}",
        chapterStyle: `\\titleformat{\\chapter}[display]\n  {\\normalfont\\huge\\itshape}{\\textcolor{chaptercolor}{\\Large Chapter\\ \\thechapter}}{0pt}{\\Huge\\bfseries\\color{chaptercolor}}\n\\titlespacing*{\\chapter}{0pt}{-20pt}{30pt}`,
        sectionStyle: `\\titleformat{\\section}\n  {\\normalfont\\Large\\bfseries\\color{sectioncolor}}{\\textcolor{accent}{\\thesection}}{1em}{}\n  [\\vspace{3pt}{\\color{accent}\\titlerule[1pt]}]\n\\titleformat{\\subsection}{\\normalfont\\large\\itshape\\color{sectioncolor}}{\\thesubsection}{1em}{}`,
        colors: `\n\\definecolor{chaptercolor}{HTML}{7C3AED}\n\\definecolor{sectioncolor}{HTML}{2D3748}\n\\definecolor{accent}{HTML}{8B5CF6}\n\\definecolor{rulecolor}{HTML}{DDD6FE}\n\\definecolor{headergray}{HTML}{6B7280}\n\\definecolor{quotegray}{HTML}{6B21A8}\n\\definecolor{captiongray}{HTML}{4A5568}\n\\definecolor{subtitlegray}{HTML}{6B7280}\n\\definecolor{linkcolor}{HTML}{7C3AED}\n\\definecolor{titletextcolor}{HTML}{1F2937}\n\\definecolor{tipbg}{HTML}{ECFDF5}\n\\definecolor{tipframe}{HTML}{059669}\n\\definecolor{keybg}{HTML}{F5F3FF}\n\\definecolor{keyframe}{HTML}{7C3AED}\n\\definecolor{warnbg}{HTML}{FFF7ED}\n\\definecolor{warnframe}{HTML}{EA580C}\n\\definecolor{exbg}{HTML}{FDF4FF}\n\\definecolor{exframe}{HTML}{A855F7}\n\\definecolor{tableheadbg}{HTML}{6D28D9}\n\\definecolor{tableheadfg}{HTML}{FFFFFF}`,
      };
    case "business":
      return {
        fontPackages:
          "\\usepackage{helvet}\\renewcommand{\\familydefault}{\\sfdefault}",
        chapterStyle: `\\titleformat{\\chapter}[display]\n  {\\normalfont\\sffamily\\huge\\bfseries}{\\textcolor{chaptercolor}{\\chaptertitlename\\ \\thechapter}}{15pt}{\\Huge\\color{chaptercolor}}\n\\titlespacing*{\\chapter}{0pt}{-20pt}{30pt}`,
        sectionStyle: `\\titleformat{\\section}\n  {\\normalfont\\sffamily\\Large\\bfseries}{\\textcolor{accent}{\\thesection}}{1em}{}\n  [\\vspace{2pt}{\\color{rulecolor}\\titlerule[0.8pt]}]\n\\titleformat{\\subsection}{\\normalfont\\sffamily\\large\\bfseries\\color{sectioncolor}}{\\thesubsection}{1em}{}`,
        colors: `\n\\definecolor{chaptercolor}{HTML}{1E40AF}\n\\definecolor{sectioncolor}{HTML}{1F2937}\n\\definecolor{accent}{HTML}{2563EB}\n\\definecolor{rulecolor}{HTML}{BFDBFE}\n\\definecolor{headergray}{HTML}{6B7280}\n\\definecolor{quotegray}{HTML}{4B5563}\n\\definecolor{captiongray}{HTML}{4B5563}\n\\definecolor{subtitlegray}{HTML}{6B7280}\n\\definecolor{linkcolor}{HTML}{1E40AF}\n\\definecolor{titletextcolor}{HTML}{111827}\n\\definecolor{tipbg}{HTML}{F0FDF4}\n\\definecolor{tipframe}{HTML}{16A34A}\n\\definecolor{keybg}{HTML}{EFF6FF}\n\\definecolor{keyframe}{HTML}{2563EB}\n\\definecolor{warnbg}{HTML}{FFFBEB}\n\\definecolor{warnframe}{HTML}{D97706}\n\\definecolor{exbg}{HTML}{F8FAFC}\n\\definecolor{exframe}{HTML}{475569}\n\\definecolor{tableheadbg}{HTML}{1E3A5F}\n\\definecolor{tableheadfg}{HTML}{FFFFFF}`,
      };
    case "minimal":
      return {
        fontPackages: "",
        chapterStyle: `\\titleformat{\\chapter}[display]\n  {\\normalfont\\Large}{\\textcolor{chaptercolor}{\\chaptername\\ \\thechapter}}{8pt}{\\LARGE\\bfseries\\color{chaptercolor}}\n\\titlespacing*{\\chapter}{0pt}{-10pt}{20pt}`,
        sectionStyle: `\\titleformat{\\section}\n  {\\normalfont\\large\\bfseries\\color{sectioncolor}}{\\thesection}{1em}{}\n\\titleformat{\\subsection}{\\normalfont\\normalsize\\bfseries\\color{sectioncolor}}{\\thesubsection}{1em}{}`,
        colors: `\n\\definecolor{chaptercolor}{HTML}{374151}\n\\definecolor{sectioncolor}{HTML}{4B5563}\n\\definecolor{accent}{HTML}{6B7280}\n\\definecolor{rulecolor}{HTML}{D1D5DB}\n\\definecolor{headergray}{HTML}{9CA3AF}\n\\definecolor{quotegray}{HTML}{6B7280}\n\\definecolor{captiongray}{HTML}{6B7280}\n\\definecolor{subtitlegray}{HTML}{9CA3AF}\n\\definecolor{linkcolor}{HTML}{4B5563}\n\\definecolor{titletextcolor}{HTML}{111827}\n\\definecolor{tipbg}{HTML}{F9FAFB}\n\\definecolor{tipframe}{HTML}{6B7280}\n\\definecolor{keybg}{HTML}{F3F4F6}\n\\definecolor{keyframe}{HTML}{4B5563}\n\\definecolor{warnbg}{HTML}{FEF9EF}\n\\definecolor{warnframe}{HTML}{92400E}\n\\definecolor{exbg}{HTML}{F9FAFB}\n\\definecolor{exframe}{HTML}{9CA3AF}\n\\definecolor{tableheadbg}{HTML}{374151}\n\\definecolor{tableheadfg}{HTML}{FFFFFF}`,
      };
    default:
      return {
        fontPackages: "\\usepackage{palatino}",
        chapterStyle: `\\titleformat{\\chapter}[display]\n  {\\normalfont\\huge\\bfseries}{\\textcolor{chaptercolor}{\\chaptertitlename\\ \\thechapter}}{15pt}{\\Huge\\color{chaptercolor}}\n\\titlespacing*{\\chapter}{0pt}{-30pt}{30pt}`,
        sectionStyle: `\\titleformat{\\section}\n  {\\normalfont\\Large\\bfseries}{\\textcolor{accent}{\\thesection}}{1em}{}\n  [\\vspace{3pt}{\\color{accent}\\titlerule[0.8pt]}]\n\\titleformat{\\subsection}{\\normalfont\\large\\bfseries\\color{sectioncolor}}{\\thesubsection}{1em}{}`,
        colors: `\n\\definecolor{chaptercolor}{HTML}{7C3AED}\n\\definecolor{sectioncolor}{HTML}{374151}\n\\definecolor{accent}{HTML}{7C3AED}\n\\definecolor{rulecolor}{HTML}{DDD6FE}\n\\definecolor{headergray}{HTML}{6B7280}\n\\definecolor{quotegray}{HTML}{6B7280}\n\\definecolor{captiongray}{HTML}{4B5563}\n\\definecolor{subtitlegray}{HTML}{6B7280}\n\\definecolor{linkcolor}{HTML}{7C3AED}\n\\definecolor{titletextcolor}{HTML}{1F2937}\n\\definecolor{tipbg}{HTML}{ECFDF5}\n\\definecolor{tipframe}{HTML}{059669}\n\\definecolor{keybg}{HTML}{EFF6FF}\n\\definecolor{keyframe}{HTML}{2563EB}\n\\definecolor{warnbg}{HTML}{FFFBEB}\n\\definecolor{warnframe}{HTML}{D97706}\n\\definecolor{exbg}{HTML}{FAF5FF}\n\\definecolor{exframe}{HTML}{9333EA}\n\\definecolor{tableheadbg}{HTML}{5B21B6}\n\\definecolor{tableheadfg}{HTML}{FFFFFF}`,
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
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: fileContent,
      ContentType: "application/pdf",
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
