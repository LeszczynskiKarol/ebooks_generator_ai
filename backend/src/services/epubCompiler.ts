// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BookForge — EPUB Compiler
// LaTeX chapters → XHTML → EPUB3 package
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { prisma } from "../lib/prisma";
import * as fs from "fs";
import * as path from "path";
import archiver from "archiver";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const BUILD_DIR = path.join(process.cwd(), "tmp", "builds");

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Main entry
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function compileEpub(projectId: string): Promise<{
  epubPath: string;
  s3Key: string | null;
  fileSize: number;
}> {
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
  if (readyChapters.length === 0) throw new Error("No chapters ready for EPUB");

  const structureData = project.structure
    ? JSON.parse(project.structure.structureJson)
    : null;
  const bookTitle =
    structureData?.suggestedTitle || project.title || project.topic;
  const bookLang = project.language || "en";
  const customColors = project.customColors
    ? JSON.parse(project.customColors)
    : null;

  console.log(
    `\n📱 EPUB: Compiling "${bookTitle}" — ${readyChapters.length} chapters`,
  );

  const buildDir = path.join(BUILD_DIR, projectId);
  if (!fs.existsSync(buildDir)) fs.mkdirSync(buildDir, { recursive: true });

  const epubDir = path.join(buildDir, "epub_build");
  if (fs.existsSync(epubDir)) fs.rmSync(epubDir, { recursive: true });
  fs.mkdirSync(epubDir, { recursive: true });

  try {
    // ── 1. Convert chapters to XHTML ──
    const chapterFiles: { filename: string; title: string; id: string }[] = [];

    for (const ch of readyChapters) {
      const xhtml = latexToXhtml(ch.latexContent!, ch.title, bookLang);
      const filename = `chapter-${ch.chapterNumber}.xhtml`;
      const chId = `ch${ch.chapterNumber}`;

      const chapterDir = path.join(epubDir, "OEBPS");
      if (!fs.existsSync(chapterDir))
        fs.mkdirSync(chapterDir, { recursive: true });
      fs.writeFileSync(path.join(chapterDir, filename), xhtml, "utf-8");

      chapterFiles.push({ filename, title: ch.title, id: chId });
      console.log(`  📄 ${filename}: ${ch.title}`);
    }

    // ── 2. Generate CSS ──
    const css = generateEpubCss(project.stylePreset, customColors);
    fs.mkdirSync(path.join(epubDir, "OEBPS", "css"), { recursive: true });
    fs.writeFileSync(
      path.join(epubDir, "OEBPS", "css", "style.css"),
      css,
      "utf-8",
    );

    // ── 3. Title page ──
    const titleXhtml = generateTitlePage(
      bookTitle,
      bookLang,
      project.authorName || null, // ← ADD
      project.subtitle || null, // ← ADD
    );

    // ── 4. Table of contents (XHTML nav) ──
    const navXhtml = generateNavDocument(chapterFiles, bookTitle, bookLang);
    fs.writeFileSync(
      path.join(epubDir, "OEBPS", "nav.xhtml"),
      navXhtml,
      "utf-8",
    );

    // ── 5. NCX (EPUB2 compat) ──
    const ncx = generateNcx(chapterFiles, bookTitle, projectId);
    fs.writeFileSync(path.join(epubDir, "OEBPS", "toc.ncx"), ncx, "utf-8");

    // ── 6. OPF (package document) ──
    const opf = generateOpf(chapterFiles, bookTitle, bookLang, projectId);
    fs.writeFileSync(path.join(epubDir, "OEBPS", "content.opf"), opf, "utf-8");

    // ── 7. META-INF/container.xml ──
    fs.mkdirSync(path.join(epubDir, "META-INF"), { recursive: true });
    fs.writeFileSync(
      path.join(epubDir, "META-INF", "container.xml"),
      CONTAINER_XML,
      "utf-8",
    );

    // ── 8. mimetype (must be first, uncompressed) ──
    fs.writeFileSync(
      path.join(epubDir, "mimetype"),
      "application/epub+zip",
      "utf-8",
    );

    // ── 9. Package into .epub (ZIP) ──
    const epubFilename = `${sanitizeFilename(bookTitle)}.epub`;
    const epubPath = path.join(buildDir, epubFilename);
    await packageEpub(epubDir, epubPath);

    const epubSize = fs.statSync(epubPath).size;
    console.log(`  ✅ EPUB: ${(epubSize / 1024).toFixed(0)} KB`);

    // ── 10. Upload to S3 ──
    let s3Key: string | null = null;
    const version = project.currentVersion || 1;

    if (process.env.AWS_ACCESS_KEY_ID && process.env.S3_BUCKET) {
      s3Key = `books/${projectId}/v${version}/${sanitizeFilename(bookTitle)}.epub`;
      await uploadToS3(epubPath, s3Key);
      console.log(`  ☁️  EPUB uploaded: ${s3Key}`);

      // Also upload "latest" copy
      const latestKey = `books/${projectId}/${sanitizeFilename(bookTitle)}.epub`;
      await uploadToS3(epubPath, latestKey);
    } else {
      console.log(`  📁 EPUB saved locally: ${epubPath}`);
    }

    // ── 11. Update project ──
    const epubS3Key =
      s3Key || `books/${projectId}/${sanitizeFilename(bookTitle)}.epub`;
    await prisma.project.update({
      where: { id: projectId },
      data: { outputEpubKey: epubS3Key },
    });

    console.log(`  📱 EPUB compilation complete!\n`);
    return { epubPath, s3Key, fileSize: epubSize };
  } catch (error) {
    console.error(`  ❌ EPUB compilation failed:`, error);
    // Non-fatal: don't change project stage, PDF is already done
    throw error;
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// LaTeX → XHTML converter
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function latexToXhtml(
  latex: string,
  chapterTitle: string,
  lang: string,
): string {
  let html = latex;

  // ── Strip preamble/postamble ──
  html = html.replace(/\\documentclass[^]*?\\begin\{document\}/g, "");
  html = html.replace(/\\end\{document\}/g, "");
  html = html.replace(/\\usepackage(\[[^\]]*\])?\{[^}]*\}/g, "");
  html = html.replace(/\\clearpage/g, "");
  html = html.replace(/\\newpage/g, "");
  html = html.replace(/\\tableofcontents/g, "");
  html = html.replace(/\\maketitle/g, "");
  html = html.replace(/\\thispagestyle\{[^}]*\}/g, "");

  // ── Headings ──
  html = html.replace(
    /\\chapter\{([^}]*)\}/g,
    '<h1 class="chapter-title">$1</h1>',
  );
  html = html.replace(
    /\\section\{([^}]*)\}/g,
    '<h2 class="section-title">$1</h2>',
  );
  html = html.replace(
    /\\subsection\{([^}]*)\}/g,
    '<h3 class="subsection-title">$1</h3>',
  );
  html = html.replace(
    /\\subsubsection\{([^}]*)\}/g,
    '<h4 class="subsubsection-title">$1</h4>',
  );

  // ── Inline formatting ──
  html = html.replace(/\\textbf\{([^}]*)\}/g, "<strong>$1</strong>");
  html = html.replace(/\\textit\{([^}]*)\}/g, "<em>$1</em>");
  html = html.replace(/\\emph\{([^}]*)\}/g, "<em>$1</em>");
  html = html.replace(
    /\\underline\{([^}]*)\}/g,
    '<span class="underline">$1</span>',
  );
  html = html.replace(/\\texttt\{([^}]*)\}/g, "<code>$1</code>");
  // Nested: \textbf{\textit{...}}
  html = html.replace(
    /<strong><em>([^<]*)<\/em><\/strong>/g,
    "<strong><em>$1</em></strong>",
  );

  // ── Footnotes → endnotes within chapter ──
  const footnotes: string[] = [];
  html = html.replace(/\\footnote\{([^}]*)\}/g, (_match, content) => {
    footnotes.push(content);
    const idx = footnotes.length;
    return `<sup class="footnote-ref"><a href="#fn${idx}" id="fnref${idx}">[${idx}]</a></sup>`;
  });

  // ── Colored boxes ──
  // tipbox
  html = html.replace(
    /\\begin\{tipbox\}\{([^}]*)\}([\s\S]*?)\\end\{tipbox\}/g,
    '<aside class="box box-tip"><p class="box-title">💡 $1</p><div class="box-content">$2</div></aside>',
  );
  html = html.replace(
    /\\begin\{tipbox\}([\s\S]*?)\\end\{tipbox\}/g,
    '<aside class="box box-tip"><div class="box-content">$1</div></aside>',
  );

  // keyinsight
  html = html.replace(
    /\\begin\{keyinsight\}\{([^}]*)\}([\s\S]*?)\\end\{keyinsight\}/g,
    '<aside class="box box-key"><p class="box-title">🔑 $1</p><div class="box-content">$2</div></aside>',
  );
  html = html.replace(
    /\\begin\{keyinsight\}([\s\S]*?)\\end\{keyinsight\}/g,
    '<aside class="box box-key"><div class="box-content">$1</div></aside>',
  );

  // warningbox
  html = html.replace(
    /\\begin\{warningbox\}\{([^}]*)\}([\s\S]*?)\\end\{warningbox\}/g,
    '<aside class="box box-warn"><p class="box-title">⚠️ $1</p><div class="box-content">$2</div></aside>',
  );
  html = html.replace(
    /\\begin\{warningbox\}([\s\S]*?)\\end\{warningbox\}/g,
    '<aside class="box box-warn"><div class="box-content">$1</div></aside>',
  );

  // examplebox
  html = html.replace(
    /\\begin\{examplebox\}\{([^}]*)\}([\s\S]*?)\\end\{examplebox\}/g,
    '<aside class="box box-example"><p class="box-title">📋 $1</p><div class="box-content">$2</div></aside>',
  );
  html = html.replace(
    /\\begin\{examplebox\}([\s\S]*?)\\end\{examplebox\}/g,
    '<aside class="box box-example"><div class="box-content">$1</div></aside>',
  );

  // ── Lists ──
  html = html.replace(/\\begin\{itemize\}/g, '<ul class="list-bullet">');
  html = html.replace(/\\end\{itemize\}/g, "</ul>");
  html = html.replace(/\\begin\{enumerate\}/g, '<ol class="list-ordered">');
  html = html.replace(/\\end\{enumerate\}/g, "</ol>");
  html = html.replace(
    /\\begin\{description\}/g,
    '<dl class="list-description">',
  );
  html = html.replace(/\\end\{description\}/g, "</dl>");
  // \item[term] for description lists
  html = html.replace(
    /\\item\[([^\]]*)\]\s*/g,
    "<dt><strong>$1</strong></dt><dd>",
  );
  // Regular \item
  html = html.replace(/\\item\s*/g, "<li>");

  // ── Quotes ──
  html = html.replace(
    /\\begin\{quote\}([\s\S]*?)\\end\{quote\}/g,
    '<blockquote class="quote">$1</blockquote>',
  );

  // ── Tables ──
  // Convert booktabs tables: \begin{table}...\begin{tabularx}...
  html = convertTables(html);

  // ── Special characters ──
  html = html.replace(/---/g, "—");
  html = html.replace(/--/g, "–");
  html = html.replace(/``/g, "\u201C"); // "
  html = html.replace(/''/g, "\u201D"); // "
  html = html.replace(/`/g, "\u2018"); // '
  html = html.replace(/'/g, "\u2019"); // '
  html = html.replace(/\\%/g, "%");
  html = html.replace(/\\&/g, "&amp;");
  html = html.replace(/\\#/g, "#");
  html = html.replace(/\\\$/g, "$");
  html = html.replace(/\\_/g, "_");
  html = html.replace(/\\textbackslash\{\}/g, "\\");
  html = html.replace(/\\textasciitilde\{\}/g, "~");
  html = html.replace(/\\textasciicircum\{\}/g, "^");
  html = html.replace(/\\\\/g, "<br/>");
  html = html.replace(/\\,/g, " ");
  html = html.replace(/~/g, "&nbsp;");

  // ── Strip remaining LaTeX commands ──
  html = html.replace(/\\label\{[^}]*\}/g, "");
  html = html.replace(/\\ref\{[^}]*\}/g, "[ref]");
  html = html.replace(/\\cite\{[^}]*\}/g, "[cite]");
  html = html.replace(/\\vspace\{[^}]*\}/g, "");
  html = html.replace(/\\hspace\{[^}]*\}/g, "");
  html = html.replace(/\\noindent\s*/g, "");
  html = html.replace(/\\centering\s*/g, "");
  html = html.replace(
    /\\caption\{([^}]*)\}/g,
    '<p class="table-caption">$1</p>',
  );
  html = html.replace(/\\rowcolor\{[^}]*\}/g, "");
  html = html.replace(/\\textcolor\{[^}]*\}\{([^}]*)\}/g, "$1");
  html = html.replace(/\\color\{[^}]*\}/g, "");

  // Strip any remaining \command{...} or \command[...]{...}
  html = html.replace(/\\[a-zA-Z]+(\[[^\]]*\])?\{([^}]*)\}/g, "$2");
  // Strip bare \commands (no arguments)
  html = html.replace(/\\[a-zA-Z]+/g, "");

  // ── Close unclosed <li> tags ──
  html = closeLiTags(html);

  // ── Wrap paragraphs ──
  html = wrapParagraphs(html);

  // ── Build footnotes section ──
  let footnotesHtml = "";
  if (footnotes.length > 0) {
    footnotesHtml =
      '<section class="footnotes"><hr/><ol class="footnote-list">' +
      footnotes
        .map(
          (fn, i) =>
            `<li id="fn${i + 1}"><p>${fn} <a href="#fnref${i + 1}">↩</a></p></li>`,
        )
        .join("\n") +
      "</ol></section>";
  }

  // ── Final XHTML document ──
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${lang}" lang="${lang}">
<head>
  <meta charset="UTF-8"/>
  <title>${escapeXml(chapterTitle)}</title>
  <link rel="stylesheet" type="text/css" href="css/style.css"/>
</head>
<body>
${html}
${footnotesHtml}
</body>
</html>`;
}

// ── Table conversion ──
function convertTables(html: string): string {
  // Handle \begin{table}[...]...\end{table} wrappers
  // Extract caption and tabularx/tabular content

  // First: handle tabularx inside table
  html = html.replace(
    /\\begin\{table\}(\[[^\]]*\])?([\s\S]*?)\\end\{table\}/g,
    (_match, _opts, content) => {
      // Extract caption
      let caption = "";
      const captionMatch = content.match(/\\caption\{([^}]*)\}/);
      if (captionMatch) {
        caption = `<caption>${captionMatch[1]}</caption>`;
        content = content.replace(/\\caption\{[^}]*\}/, "");
      }

      // Extract tabularx or tabular
      const tabMatch = content.match(
        /\\begin\{tabular[x]?\}\{[^}]*\}([\s\S]*?)\\end\{tabular[x]?\}/,
      );
      if (!tabMatch) return content;

      const tableContent = convertTableContent(tabMatch[1]);
      return `<table class="data-table">${caption}${tableContent}</table>`;
    },
  );

  // Standalone tabularx (no table wrapper)
  html = html.replace(
    /\\begin\{tabular[x]?\}\{[^}]*\}([\s\S]*?)\\end\{tabular[x]?\}/g,
    (_match, content) => {
      const tableContent = convertTableContent(content);
      return `<table class="data-table">${tableContent}</table>`;
    },
  );

  return html;
}

function convertTableContent(content: string): string {
  // Split by \\ (row separator)
  const rows = content
    .split(/\\\\\s*/)
    .map((r) => r.trim())
    .filter((r) => r.length > 0 && !r.match(/^\\[a-z]+rule$/));

  // Remove booktabs rules
  const cleanRows = rows.filter(
    (r) =>
      !r.match(/^\\(top|mid|bottom|hline)rule$/) &&
      !r.match(/^\\(top|mid|bottom|hline)rule\s*$/) &&
      r !== "\\toprule" &&
      r !== "\\midrule" &&
      r !== "\\bottomrule" &&
      r !== "\\hline",
  );

  // Detect header: rows before \midrule are header
  let headerEndIdx = -1;
  const originalRows = content.split(/\\\\\s*/);
  for (let i = 0; i < originalRows.length; i++) {
    if (
      originalRows[i].includes("\\midrule") ||
      originalRows[i].includes("\\hline")
    ) {
      headerEndIdx = i;
      break;
    }
  }

  let htmlRows = "";
  let rowIdx = 0;

  for (const row of cleanRows) {
    // Strip \rowcolor, \textcolor wrappers
    let cleanRow = row
      .replace(/\\rowcolor\{[^}]*\}\s*/g, "")
      .replace(/\\textcolor\{[^}]*\}\{\\textbf\{([^}]*)\}\}/g, "$1")
      .replace(/\\textcolor\{[^}]*\}\{([^}]*)\}/g, "$1")
      .replace(/\\toprule/g, "")
      .replace(/\\midrule/g, "")
      .replace(/\\bottomrule/g, "")
      .replace(/\\hline/g, "")
      .trim();

    if (!cleanRow) continue;

    const cells = cleanRow.split("&").map((c) => c.trim());
    const isHeader = rowIdx === 0 && headerEndIdx > 0;
    const tag = isHeader ? "th" : "td";

    const cellsHtml = cells
      .map((c) => {
        let val = c
          .replace(/\\textbf\{([^}]*)\}/g, "<strong>$1</strong>")
          .replace(/\\textit\{([^}]*)\}/g, "<em>$1</em>");
        return `<${tag}>${val}</${tag}>`;
      })
      .join("");

    if (isHeader) {
      htmlRows += `<thead><tr>${cellsHtml}</tr></thead><tbody>`;
    } else {
      htmlRows += `<tr>${cellsHtml}</tr>`;
    }
    rowIdx++;
  }

  // Close tbody if we opened it
  if (headerEndIdx > 0) {
    htmlRows += "</tbody>";
  }

  return htmlRows;
}

// ── Close unclosed <li> tags ──
function closeLiTags(html: string): string {
  // Simple approach: before each </ul>, </ol>, or next <li>, close previous <li>
  const lines = html.split("\n");
  const result: string[] = [];
  let inLi = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith("<li>") && inLi) {
      result.push("</li>");
    }

    if (trimmed.startsWith("<li>")) {
      inLi = true;
    }

    if ((trimmed === "</ul>" || trimmed === "</ol>") && inLi) {
      result.push("</li>");
      inLi = false;
    }

    result.push(line);
  }

  if (inLi) result.push("</li>");
  return result.join("\n");
}

// ── Wrap loose text in <p> tags ──
function wrapParagraphs(html: string): string {
  const blockElements =
    /^<(h[1-6]|ul|ol|dl|table|aside|blockquote|section|hr|li|dt|dd|thead|tbody|tr|th|td|caption|p|div|br)/;
  const closingBlock =
    /^<\/(h[1-6]|ul|ol|dl|table|aside|blockquote|section|li|dt|dd|thead|tbody|tr|th|td|caption|p|div)/;

  const chunks = html.split(/\n\n+/);
  return chunks
    .map((chunk) => {
      const trimmed = chunk.trim();
      if (!trimmed) return "";
      if (blockElements.test(trimmed) || closingBlock.test(trimmed))
        return trimmed;
      if (trimmed.startsWith("<sup")) return trimmed; // footnote ref
      // It's inline text — wrap in <p>
      return `<p>${trimmed}</p>`;
    })
    .join("\n\n");
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// EPUB CSS (styled per preset + custom colors)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function generateEpubCss(
  stylePreset: string,
  customColors: string[] | null,
): string {
  const colors = getColorVars(stylePreset, customColors);

  return `/* BookForge EPUB — ${stylePreset} preset */
@charset "UTF-8";

/* ── Base typography ── */
body {
  font-family: Georgia, "Times New Roman", serif;
  line-height: 1.6;
  color: #1F2937;
  margin: 1em;
  text-align: justify;
  hyphens: auto;
  -webkit-hyphens: auto;
}

${stylePreset === "business" ? `body { font-family: Helvetica, Arial, sans-serif; }` : ""}
${stylePreset === "academic" ? `body { font-family: "Times New Roman", Times, serif; }` : ""}
${stylePreset === "creative" ? `body { font-family: Palatino, "Book Antiqua", Georgia, serif; }` : ""}

/* ── Headings ── */
h1.chapter-title {
  color: ${colors.chapter};
  font-size: 1.8em;
  font-weight: bold;
  margin-top: 2em;
  margin-bottom: 0.8em;
  padding-bottom: 0.3em;
  border-bottom: 2px solid ${colors.accent};
  page-break-before: always;
}

h2.section-title {
  color: ${colors.section};
  font-size: 1.4em;
  font-weight: bold;
  margin-top: 1.5em;
  margin-bottom: 0.5em;
  padding-bottom: 0.2em;
  border-bottom: 1px solid ${colors.rule};
}

h3.subsection-title {
  color: ${colors.section};
  font-size: 1.15em;
  font-weight: bold;
  margin-top: 1.2em;
  margin-bottom: 0.4em;
}

h4.subsubsection-title {
  color: ${colors.section};
  font-size: 1em;
  font-weight: bold;
  font-style: italic;
  margin-top: 1em;
  margin-bottom: 0.3em;
}

/* ── Paragraphs ── */
p {
  margin: 0.6em 0;
  text-indent: 0;
}

strong { font-weight: bold; }
em { font-style: italic; }
code {
  font-family: "Courier New", Courier, monospace;
  background: #F3F4F6;
  padding: 0.1em 0.3em;
  border-radius: 3px;
  font-size: 0.9em;
}

.underline { text-decoration: underline; }

/* ── Lists ── */
ul.list-bullet, ol.list-ordered {
  margin: 0.8em 0;
  padding-left: 1.8em;
}

ul.list-bullet li, ol.list-ordered li {
  margin-bottom: 0.3em;
  line-height: 1.5;
}

dl.list-description dt {
  font-weight: bold;
  margin-top: 0.5em;
}
dl.list-description dd {
  margin-left: 1.5em;
  margin-bottom: 0.3em;
}

/* ── Blockquotes ── */
blockquote.quote {
  margin: 1em 1.5em;
  padding: 0.5em 1em;
  border-left: 3px solid ${colors.accent};
  font-style: italic;
  color: #4B5563;
}

/* ── Colored boxes ── */
aside.box {
  margin: 1.2em 0;
  padding: 0.8em 1em;
  border-radius: 4px;
  page-break-inside: avoid;
}

aside.box .box-title {
  font-weight: bold;
  font-size: 0.95em;
  margin: 0 0 0.4em 0;
  padding: 0;
}

aside.box .box-content {
  font-size: 0.95em;
  line-height: 1.5;
}

aside.box .box-content p {
  margin: 0.3em 0;
}

aside.box-tip {
  background-color: ${colors.tipBg};
  border-left: 4px solid ${colors.tipFrame};
}
aside.box-tip .box-title { color: ${colors.tipFrame}; }

aside.box-key {
  background-color: ${colors.keyBg};
  border: 1px solid ${colors.keyFrame};
}
aside.box-key .box-title { color: ${colors.keyFrame}; }

aside.box-warn {
  background-color: ${colors.warnBg};
  border-left: 4px solid ${colors.warnFrame};
}
aside.box-warn .box-title { color: ${colors.warnFrame}; }

aside.box-example {
  background-color: ${colors.exBg};
  border: 1px solid ${colors.exFrame};
}
aside.box-example .box-title { color: ${colors.exFrame}; }

/* ── Tables ── */
table.data-table {
  width: 100%;
  border-collapse: collapse;
  margin: 1em 0;
  font-size: 0.9em;
  page-break-inside: avoid;
}

table.data-table caption,
p.table-caption {
  font-weight: bold;
  font-size: 0.95em;
  color: ${colors.accent};
  margin-bottom: 0.5em;
  text-align: left;
}

table.data-table th {
  background-color: ${colors.tableHeadBg};
  color: ${colors.tableHeadFg};
  font-weight: bold;
  padding: 0.5em 0.6em;
  text-align: left;
  border-bottom: 2px solid ${colors.accent};
}

table.data-table td {
  padding: 0.4em 0.6em;
  border-bottom: 1px solid #E5E7EB;
  vertical-align: top;
}

table.data-table tr:nth-child(even) td {
  background-color: #F9FAFB;
}

/* ── Footnotes ── */
sup.footnote-ref { font-size: 0.75em; }
sup.footnote-ref a {
  color: ${colors.accent};
  text-decoration: none;
}

section.footnotes {
  margin-top: 2em;
  font-size: 0.85em;
  color: #6B7280;
}

section.footnotes hr {
  border: none;
  border-top: 1px solid #D1D5DB;
  margin-bottom: 0.5em;
}

ol.footnote-list {
  padding-left: 1.5em;
}

ol.footnote-list li {
  margin-bottom: 0.3em;
}

/* ── Title page ── */
.title-page {
  text-align: center;
  margin-top: 30%;
}

.title-page h1 {
  color: ${colors.chapter};
  font-size: 2.2em;
  margin-bottom: 0.3em;
}

.title-page .divider {
  width: 4em;
  height: 2px;
  background: ${colors.accent};
  margin: 1em auto;
}

.title-page .subtitle {
  color: #6B7280;
  font-size: 1em;
  font-style: italic;
}

.title-page .author {
    color: #1F2937;
    font-size: 1.2em;
    font-weight: 600;
    margin-top: 2em;
}

.title-page .year {
  color: #9CA3AF;
  font-size: 0.85em;
  margin-top: 3em;
}

/* ── Navigation ── */
nav#toc ol {
  list-style: none;
  padding: 0;
}

nav#toc ol li {
  margin: 0.5em 0;
}

nav#toc ol li a {
  color: ${colors.chapter};
  text-decoration: none;
  font-size: 1.1em;
}
`;
}

// ── Color extraction per preset ──
interface EpubColors {
  chapter: string;
  section: string;
  accent: string;
  rule: string;
  tipBg: string;
  tipFrame: string;
  keyBg: string;
  keyFrame: string;
  warnBg: string;
  warnFrame: string;
  exBg: string;
  exFrame: string;
  tableHeadBg: string;
  tableHeadFg: string;
}

function getColorVars(
  preset: string,
  customColors: string[] | null,
): EpubColors {
  if (customColors && customColors.length > 0) {
    const p = customColors[0];
    const s = customColors.length >= 2 ? customColors[1] : rotateHue(p, 150);
    const t = customColors.length >= 3 ? customColors[2] : rotateHue(p, 210);
    return {
      chapter: p,
      section: shade(p, 0.2),
      accent: p,
      rule: tint(p, 0.7),
      tipBg: tint(s, 0.92),
      tipFrame: shade(s, 0.1),
      keyBg: tint(p, 0.92),
      keyFrame: p,
      warnBg: tint(t, 0.92),
      warnFrame: shade(t, 0.1),
      exBg: tint(s, 0.95),
      exFrame: s,
      tableHeadBg: shade(p, 0.15),
      tableHeadFg: "#FFFFFF",
    };
  }

  const presets: Record<string, EpubColors> = {
    modern: {
      chapter: "#7C3AED",
      section: "#374151",
      accent: "#7C3AED",
      rule: "#DDD6FE",
      tipBg: "#ECFDF5",
      tipFrame: "#059669",
      keyBg: "#EFF6FF",
      keyFrame: "#2563EB",
      warnBg: "#FFFBEB",
      warnFrame: "#D97706",
      exBg: "#FAF5FF",
      exFrame: "#9333EA",
      tableHeadBg: "#5B21B6",
      tableHeadFg: "#FFFFFF",
    },
    academic: {
      chapter: "#1A365D",
      section: "#2D3748",
      accent: "#2B6CB0",
      rule: "#CBD5E0",
      tipBg: "#F0FFF4",
      tipFrame: "#276749",
      keyBg: "#EBF8FF",
      keyFrame: "#2B6CB0",
      warnBg: "#FFFAF0",
      warnFrame: "#C05621",
      exBg: "#F7FAFC",
      exFrame: "#4A5568",
      tableHeadBg: "#2D3748",
      tableHeadFg: "#FFFFFF",
    },
    creative: {
      chapter: "#7C3AED",
      section: "#2D3748",
      accent: "#8B5CF6",
      rule: "#DDD6FE",
      tipBg: "#ECFDF5",
      tipFrame: "#059669",
      keyBg: "#F5F3FF",
      keyFrame: "#7C3AED",
      warnBg: "#FFF7ED",
      warnFrame: "#EA580C",
      exBg: "#FDF4FF",
      exFrame: "#A855F7",
      tableHeadBg: "#6D28D9",
      tableHeadFg: "#FFFFFF",
    },
    business: {
      chapter: "#1E40AF",
      section: "#1F2937",
      accent: "#2563EB",
      rule: "#BFDBFE",
      tipBg: "#F0FDF4",
      tipFrame: "#16A34A",
      keyBg: "#EFF6FF",
      keyFrame: "#2563EB",
      warnBg: "#FFFBEB",
      warnFrame: "#D97706",
      exBg: "#F8FAFC",
      exFrame: "#475569",
      tableHeadBg: "#1E3A5F",
      tableHeadFg: "#FFFFFF",
    },
    minimal: {
      chapter: "#374151",
      section: "#4B5563",
      accent: "#6B7280",
      rule: "#D1D5DB",
      tipBg: "#F9FAFB",
      tipFrame: "#6B7280",
      keyBg: "#F3F4F6",
      keyFrame: "#4B5563",
      warnBg: "#FEF9EF",
      warnFrame: "#92400E",
      exBg: "#F9FAFB",
      exFrame: "#9CA3AF",
      tableHeadBg: "#374151",
      tableHeadFg: "#FFFFFF",
    },
  };

  return presets[preset] || presets.modern;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// EPUB Package Components
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function generateTitlePage(
  title: string,
  lang: string,
  authorName?: string | null,
  subtitle?: string | null,
): string {
  const year = new Date().getFullYear();
  const displaySubtitle = subtitle
    ? escapeXml(subtitle)
    : lang === "pl"
      ? ""
      : "";

  const authorBlock = authorName
    ? `<p class="author">${escapeXml(authorName)}</p>`
    : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="${lang}" lang="${lang}">
<head>
  <meta charset="UTF-8"/>
  <title>${escapeXml(title)}</title>
  <link rel="stylesheet" type="text/css" href="css/style.css"/>
</head>
<body>
  <div class="title-page">
    <h1>${escapeXml(title)}</h1>
    <div class="divider"></div>
    <p class="subtitle">${displaySubtitle}</p>
    ${authorBlock}
    <p class="year">${year}</p>
  </div>
</body>
</html>`;
}

function generateNavDocument(
  chapters: { filename: string; title: string; id: string }[],
  bookTitle: string,
  lang: string,
): string {
  const items = chapters
    .map(
      (ch, i) =>
        `      <li><a href="${ch.filename}">${i + 1}. ${escapeXml(ch.title)}</a></li>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${lang}" lang="${lang}">
<head>
  <meta charset="UTF-8"/>
  <title>${lang === "pl" ? "Spis treści" : "Table of Contents"}</title>
  <link rel="stylesheet" type="text/css" href="css/style.css"/>
</head>
<body>
  <nav epub:type="toc" id="toc">
    <h1>${lang === "pl" ? "Spis treści" : "Table of Contents"}</h1>
    <ol>
${items}
    </ol>
  </nav>
</body>
</html>`;
}

function generateNcx(
  chapters: { filename: string; title: string; id: string }[],
  bookTitle: string,
  uid: string,
): string {
  const navPoints = chapters
    .map(
      (ch, i) => `
    <navPoint id="navpoint-${i + 1}" playOrder="${i + 1}">
      <navLabel><text>${escapeXml(ch.title)}</text></navLabel>
      <content src="${ch.filename}"/>
    </navPoint>`,
    )
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="bookforge-${uid}"/>
    <meta name="dtb:depth" content="1"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle><text>${escapeXml(bookTitle)}</text></docTitle>
  <navMap>${navPoints}
  </navMap>
</ncx>`;
}

function generateOpf(
  chapters: { filename: string; title: string; id: string }[],
  bookTitle: string,
  lang: string,
  uid: string,
): string {
  const now = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");

  const manifestItems = [
    `    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>`,
    `    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>`,
    `    <item id="css" href="css/style.css" media-type="text/css"/>`,
    `    <item id="title-page" href="title.xhtml" media-type="application/xhtml+xml"/>`,
    ...chapters.map(
      (ch) =>
        `    <item id="${ch.id}" href="${ch.filename}" media-type="application/xhtml+xml"/>`,
    ),
  ].join("\n");

  const spineItems = [
    `    <itemref idref="title-page"/>`,
    `    <itemref idref="nav"/>`,
    ...chapters.map((ch) => `    <itemref idref="${ch.id}"/>`),
  ].join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid" xml:lang="${lang}">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="uid">bookforge-${uid}</dc:identifier>
    <dc:title>${escapeXml(bookTitle)}</dc:title>
    <dc:language>${lang}</dc:language>
    <dc:creator>BookForge.ai</dc:creator>
    <dc:publisher>BookForge.ai</dc:publisher>
    <dc:date>${now}</dc:date>
    <meta property="dcterms:modified">${now}</meta>
  </metadata>
  <manifest>
${manifestItems}
  </manifest>
  <spine toc="ncx">
${spineItems}
  </spine>
</package>`;
}

const CONTAINER_XML = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Package EPUB (ZIP with mimetype first, uncompressed)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function packageEpub(
  sourceDir: string,
  outputPath: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", () => resolve());
    archive.on("error", (err) => reject(err));
    archive.pipe(output);

    // ⚠️ mimetype MUST be first entry, STORED (not deflated)
    archive.append("application/epub+zip", {
      name: "mimetype",
      store: true,
    });

    // Add META-INF
    archive.directory(path.join(sourceDir, "META-INF"), "META-INF");

    // Add OEBPS
    archive.directory(path.join(sourceDir, "OEBPS"), "OEBPS");

    archive.finalize();
  });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Helpers (color, S3, XML escaping)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

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

async function uploadToS3(filePath: string, key: string): Promise<void> {
  const s3 = new S3Client({
    region: process.env.AWS_REGION || "eu-north-1",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });
  const fileContent = fs.readFileSync(filePath);
  await s3.send(
    new PutObjectCommand({
      Bucket: process.env.S3_BUCKET!,
      Key: key,
      Body: fileContent,
      ContentType: "application/epub+zip",
    }),
  );
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
