// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// LaTeX → HTML/XHTML — the single backend converter.
// Used by the EPUB compiler (and any future HTML rendering of book
// content). Every new LaTeX construct the content generator emits
// must be handled HERE, not in per-consumer copies.
//
// Note: the frontend has its own converter (frontend/src/lib/
// latexConverter.ts) because the WYSIWYG editor needs a *bidirectional*
// HTML↔LaTeX mapping for contenteditable — a different contract than
// this one-way publishing conversion.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { repairControlCharLatex } from "./latexFixes";

export function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export interface XhtmlNumbering {
  /** Item label ("Przepis") for \itemsection headings */
  itemLabel: string;
  /** Mutable counter shared across chapters so numbering is continuous */
  counter: { n: number };
}

export function latexToXhtml(
  latex: string,
  chapterTitle: string,
  lang: string,
  numbering?: XhtmlNumbering,
): string {
  let html = repairControlCharLatex(latex);

  // ── Collection items: \itemsection{Title} → numbered item heading ──
  // Must run before the generic heading pass (which would not match it).
  html = html.replace(/\\itemsection\{([^}]*)\}/g, (_m, title) => {
    if (numbering) {
      numbering.counter.n += 1;
      return `<h3 class="subsection-title item-title"><span class="item-label">${escapeXml(numbering.itemLabel)} ${numbering.counter.n}</span>${title}</h3>`;
    }
    return `<h3 class="subsection-title">${title}</h3>`;
  });

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

  // ── Figures & images ──
  // Expects image paths already rewritten to packaged-local form
  // (images/img-<id>.<ext>) via rewriteImageUrls(). Must run before the
  // special-character and generic-strip passes, which would mangle paths.
  html = html.replace(
    /\\begin\{figure\}(\[[^\]]*\])?([\s\S]*?)\\end\{figure\}/g,
    (_match, _opts, content) => {
      const imgMatch = content.match(/\\includegraphics(\[[^\]]*\])?\{([^}]*)\}/);
      if (!imgMatch) return content;
      const capMatch = content.match(/\\caption\{([^}]*)\}/);
      const alt = capMatch ? escapeXml(capMatch[1]) : "";
      const figcaption = capMatch
        ? `<figcaption>${capMatch[1]}</figcaption>`
        : "";
      return `<figure class="book-figure"><img src="${imgMatch[2]}" alt="${alt}"/>${figcaption}</figure>`;
    },
  );
  html = html.replace(
    /\\includegraphics(\[[^\]]*\])?\{([^}]*)\}/g,
    '<figure class="book-figure"><img src="$2" alt=""/></figure>',
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

  // ── Rich visual macros → semantic HTML (preserve content in EPUB) ──
  html = html.replace(
    /\\pullquote\{((?:[^{}]|\{[^{}]*\})*)\}/g,
    '<blockquote class="pullquote">$1</blockquote>',
  );
  html = html.replace(
    /\\bignumber\{([^}]*)\}\{((?:[^{}]|\{[^{}]*\})*)\}/g,
    '<p class="bignumber"><span class="bignumber-value">$1</span><br/><span class="bignumber-label">$2</span></p>',
  );
  html = html.replace(/\\stepflow\{([^}]*)\}/g, (_m: string, steps: string) => {
    const parts = steps
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    return `<p class="stepflow">${parts.join(" &rarr; ")}</p>`;
  });
  html = html.replace(
    /\\concept\{([^}]*)\}\{((?:[^{}]|\{[^{}]*\})*)\}/g,
    '<aside class="box box-concept"><p class="box-title">$1</p><div class="box-content">$2</div></aside>',
  );
  // Drop caps are PDF-only; keep the text if any \lettrine slipped through
  html = html.replace(/\\lettrine\{([^}]*)\}\{([^}]*)\}/g, "$1$2");

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
  html = html.replace(/,,/g, "„"); // Polish opening quote
  html = html.replace(/``/g, "“"); // "
  html = html.replace(/''/g, "”"); // "
  html = html.replace(/`/g, "‘"); // '
  html = html.replace(/'/g, "’"); // '
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
    /^<(h[1-6]|ul|ol|dl|table|aside|blockquote|section|hr|li|dt|dd|thead|tbody|tr|th|td|caption|p|div|br|figure|figcaption|img)/;
  const closingBlock =
    /^<\/(h[1-6]|ul|ol|dl|table|aside|blockquote|section|li|dt|dd|thead|tbody|tr|th|td|caption|p|div|figure)/;

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
