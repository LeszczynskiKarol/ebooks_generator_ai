import { prisma } from "../lib/prisma";
import { exec } from "child_process";
import { promisify } from "util";
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
// Compile: assemble .tex → pdflatex → upload S3
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
    const texContent = assembleLatexDocument({
      title: bookTitle,
      language: project.language,
      format: project.bookFormat,
      stylePreset: project.stylePreset,
      chapters: readyChapters,
    });

    const texPath = path.join(buildDir, "book.tex");
    fs.writeFileSync(texPath, texContent, "utf-8");
    console.log(
      `  📝 LaTeX assembled: ${texPath} (${texContent.length} chars)`,
    );

    // ── 2. Run pdflatex (twice for TOC/refs) ──
    const pdfPath = path.join(buildDir, "book.pdf");

    for (let pass = 1; pass <= 2; pass++) {
      console.log(`  🔄 pdflatex pass ${pass}/2...`);
      try {
        await execAsync(
          `pdflatex -interaction=nonstopmode -output-directory="${buildDir}" "${texPath}"`,
          { timeout: 120000, maxBuffer: 10 * 1024 * 1024 },
        );
      } catch (err: any) {
        // pdflatex returns non-zero on warnings too — check if PDF was created
        if (pass === 2 && !fs.existsSync(pdfPath)) {
          const logPath = path.join(buildDir, "book.log");
          const logContent = fs.existsSync(logPath)
            ? fs.readFileSync(logPath, "utf-8").slice(-3000)
            : "No log";
          console.error(`  ❌ pdflatex failed. Last log:\n${logContent}`);
          throw new Error("pdflatex compilation failed");
        }
      }
    }

    if (!fs.existsSync(pdfPath)) {
      throw new Error("PDF file not created after compilation");
    }

    const pdfSize = fs.statSync(pdfPath).size;
    console.log(`  ✅ PDF compiled: ${(pdfSize / 1024).toFixed(0)} KB`);

    // ── 3. Upload to S3 ──
    let pdfUrl: string;
    const s3Key = `books/${projectId}/${sanitizeFilename(bookTitle)}.pdf`;

    if (process.env.AWS_ACCESS_KEY_ID && process.env.S3_BUCKET) {
      pdfUrl = await uploadToS3(pdfPath, s3Key);
      console.log(`  ☁️  Uploaded to S3: ${pdfUrl}`);
    } else {
      // Local fallback — serve from /api/projects/:id/download/pdf
      pdfUrl = `/api/projects/${projectId}/download/pdf`;
      console.log(`  📁 S3 not configured — serving locally: ${pdfUrl}`);
    }

    // ── 4. Update project ──
    await prisma.project.update({
      where: { id: projectId },
      data: {
        outputPdfKey: s3Key,
        generationStatus: "COMPLETED",
        currentStage: "COMPLETED",
      },
    });

    console.log(`\n📖 Book compiled and ready! 🎉\n`);
    return { pdfPath, pdfUrl, s3Key };
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
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface AssembleParams {
  title: string;
  language: string;
  format: string;
  stylePreset: string;
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

  // Choose style
  const styleConfig = getStyleConfig(p.stylePreset);

  let tex = `\\documentclass[${fontSize},${paperSize},twoside,openright]{book}

% ── Encoding & Language ──
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage[${babel}]{babel}

% ── Fonts ──
\\usepackage{lmodern}
${styleConfig.fontPackages}

% ── Page geometry ──
\\usepackage[
  ${paperSize},
  inner=20mm, outer=15mm,
  top=20mm, bottom=25mm,
  headheight=14pt
]{geometry}

% ── Headers & footers ──
\\usepackage{fancyhdr}
\\pagestyle{fancy}
\\fancyhf{}
\\fancyhead[LE]{\\small\\textit{\\leftmark}}
\\fancyhead[RO]{\\small\\textit{\\rightmark}}
\\fancyfoot[C]{\\thepage}
\\renewcommand{\\headrulewidth}{0.4pt}

% ── Chapter & section styling ──
\\usepackage{titlesec}
${styleConfig.chapterStyle}
${styleConfig.sectionStyle}

% ── Typography ──
\\usepackage{microtype}
\\usepackage{setspace}
\\onehalfspacing
\\usepackage{parskip}

% ── Lists ──
\\usepackage{enumitem}
\\setlist[itemize]{leftmargin=*, itemsep=2pt, parsep=0pt}
\\setlist[enumerate]{leftmargin=*, itemsep=2pt, parsep=0pt}

% ── Quotes ──
\\usepackage{csquotes}

% ── Hyperlinks ──
\\usepackage[hidelinks,unicode]{hyperref}

% ── Colors ──
\\usepackage{xcolor}
${styleConfig.colors}

% ── Title ──
\\title{\\Huge\\bfseries ${escapeLatex(p.title)}}
\\author{}
\\date{}

\\begin{document}

% ── Title page ──
\\begin{titlepage}
\\centering
\\vspace*{3cm}
{\\fontsize{28}{34}\\selectfont\\bfseries ${escapeLatex(p.title)}\\par}
\\vspace{1cm}
{\\large\\textcolor{gray}{${isPolish ? "Wygenerowano przez BookForge.ai" : "Generated by BookForge.ai"}}\\par}
\\vfill
{\\small ${new Date().getFullYear()}\\par}
\\end{titlepage}

% ── Table of contents ──
\\tableofcontents
\\clearpage

% ── Chapters ──
`;

  for (const ch of p.chapters) {
    if (ch.latexContent) {
      tex += `\n% ════════════════════════════════════════════\n`;
      tex += `% Chapter ${ch.chapterNumber}: ${ch.title}\n`;
      tex += `% ════════════════════════════════════════════\n\n`;
      tex += ch.latexContent;
      tex += `\n\\clearpage\n`;
    }
  }

  tex += `\n\\end{document}\n`;

  return tex;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Style presets
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function getStyleConfig(preset: string) {
  switch (preset) {
    case "academic":
      return {
        fontPackages: "\\usepackage{times}",
        chapterStyle: `\\titleformat{\\chapter}[display]
  {\\normalfont\\Large\\bfseries}{\\chaptertitlename\\ \\thechapter}{10pt}{\\LARGE}`,
        sectionStyle: `\\titleformat{\\section}{\\normalfont\\large\\bfseries}{\\thesection}{1em}{}`,
        colors: "",
      };
    case "creative":
      return {
        fontPackages: "\\usepackage{palatino}",
        chapterStyle: `\\titleformat{\\chapter}[display]
  {\\normalfont\\huge\\itshape}{}{0pt}{\\Huge\\bfseries}
\\titlespacing*{\\chapter}{0pt}{-20pt}{30pt}`,
        sectionStyle: `\\titleformat{\\section}{\\normalfont\\Large\\itshape}{\\thesection}{1em}{}`,
        colors: "\\definecolor{accent}{RGB}{139,92,246}",
      };
    case "business":
      return {
        fontPackages:
          "\\usepackage{helvet}\\renewcommand{\\familydefault}{\\sfdefault}",
        chapterStyle: `\\titleformat{\\chapter}[display]
  {\\normalfont\\sffamily\\huge\\bfseries}{\\chaptertitlename\\ \\thechapter}{15pt}{\\Huge}`,
        sectionStyle: `\\titleformat{\\section}{\\normalfont\\sffamily\\Large\\bfseries}{\\thesection}{1em}{}`,
        colors: "\\definecolor{accent}{RGB}{37,99,235}",
      };
    case "minimal":
      return {
        fontPackages: "",
        chapterStyle: `\\titleformat{\\chapter}[display]
  {\\normalfont\\Large}{\\chaptername\\ \\thechapter}{8pt}{\\LARGE\\bfseries}
\\titlespacing*{\\chapter}{0pt}{-10pt}{20pt}`,
        sectionStyle: `\\titleformat{\\section}{\\normalfont\\large\\bfseries}{\\thesection}{1em}{}`,
        colors: "",
      };
    default: // modern
      return {
        fontPackages: "\\usepackage{palatino}",
        chapterStyle: `\\titleformat{\\chapter}[display]
  {\\normalfont\\huge\\bfseries}{\\textcolor{chaptercolor}{\\chaptertitlename\\ \\thechapter}}{15pt}{\\Huge}
\\titlespacing*{\\chapter}{0pt}{-30pt}{30pt}`,
        sectionStyle: `\\titleformat{\\section}{\\normalfont\\Large\\bfseries}{\\textcolor{chaptercolor}{\\thesection}}{1em}{}`,
        colors: "\\definecolor{chaptercolor}{RGB}{124,58,237}",
      };
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// S3 upload
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
      ContentDisposition: `attachment; filename="${path.basename(key)}"`,
    }),
  );

  return `https://${bucket}.s3.${process.env.AWS_REGION || "eu-north-1"}.amazonaws.com/${key}`;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Helpers
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function escapeLatex(text: string): string {
  return text
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/[&%$#_{}]/g, (m) => "\\" + m)
    .replace(/~/g, "\\textasciitilde{}")
    .replace(/\^/g, "\\textasciicircum{}");
}

function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9ąćęłńóśźżĄĆĘŁŃÓŚŹŻ\s-]/g, "")
    .replace(/\s+/g, "-")
    .substring(0, 80);
}
