// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BookForge — LaTeX ↔ HTML Bidirectional Converter
// Converts between BookForge LaTeX and TipTap-compatible HTML
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// ────────────────────────────────────────────────────
// HELPERS
// ────────────────────────────────────────────────────

/** Find the matching closing brace for an opening brace at `start` */
function findMatchingBrace(text: string, start: number): number {
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === "{" && (i === 0 || text[i - 1] !== "\\")) depth++;
    if (text[i] === "}" && (i === 0 || text[i - 1] !== "\\")) depth--;
    if (depth === 0) return i;
  }
  return text.length - 1;
}

/** Extract content between \begin{env} and \end{env}, returning [content, endIndex] */
function extractEnvironment(
  text: string,
  envName: string,
  startIdx: number,
): [string, number] {
  const endTag = `\\end{${envName}}`;
  const endIdx = text.indexOf(endTag, startIdx);
  if (endIdx === -1) return [text.substring(startIdx), text.length];
  return [text.substring(startIdx, endIdx), endIdx + endTag.length];
}

/** Escape HTML entities */
function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ────────────────────────────────────────────────────
// LATEX → HTML
// ────────────────────────────────────────────────────

export function latexToHtml(latex: string): string {
  let html = latex;

  // ── Strip LaTeX preamble artifacts (shouldn't be in chapter content, but safety) ──
  html = html.replace(/\\documentclass[^]*?\\begin\{document\}/g, "");
  html = html.replace(/\\end\{document\}/g, "");
  html = html.replace(/\\usepackage(\[[^\]]*\])?\{[^}]*\}/g, "");

  // ── Strip layout commands ──
  html = html.replace(/\\clearpage/g, "");
  html = html.replace(/\\newpage/g, "");
  html = html.replace(/\\vspace\*?\{[^}]*\}/g, "");
  html = html.replace(/\\hspace\*?\{[^}]*\}/g, "");
  html = html.replace(/\\noindent\s*/g, "");
  html = html.replace(/\\label\{[^}]*\}/g, "");
  html = html.replace(/\\pagebreak/g, "");
  html = html.replace(/\\bigskip/g, "");
  html = html.replace(/\\medskip/g, "");
  html = html.replace(/\\smallskip/g, "");
  html = html.replace(/\\par\b/g, "\n\n");

  // ── Callout boxes → HTML divs ──
  const calloutTypes = ["tipbox", "keyinsight", "warningbox", "examplebox"];
  for (const boxType of calloutTypes) {
    const re = new RegExp(
      `\\\\begin\\{${boxType}\\}(?:\\[([^\\]]*)\\])?([\\s\\S]*?)\\\\end\\{${boxType}\\}`,
      "g",
    );
    html = html.replace(re, (_match, title, content) => {
      const cleanContent = convertInlineLatex(content.trim());
      const titleAttr = title ? ` data-title="${escHtml(title)}"` : "";
      return `<div data-callout="${boxType}"${titleAttr}><p>${cleanContent}</p></div>`;
    });
  }

  // ── Tables (tabularx/tabular inside table environment) ──
  html = html.replace(
    /\\begin\{table\}[\s\S]*?\\begin\{tabular[x]?\}[^}]*\{[^}]*\}([\s\S]*?)\\end\{tabular[x]?\}[\s\S]*?\\end\{table\}/g,
    (_match, tableContent) => convertTable(tableContent),
  );
  // Standalone tabularx
  html = html.replace(
    /\\begin\{tabular[x]?\}[^}]*\{[^}]*\}([\s\S]*?)\\end\{tabular[x]?\}/g,
    (_match, tableContent) => convertTable(tableContent),
  );

  // ── Headings ──
  html = html.replace(
    /\\chapter\*?\{([^}]*)\}/g,
    '<h2 data-latex="chapter">$1</h2>',
  );
  html = html.replace(
    /\\section\*?\{([^}]*)\}/g,
    '<h3 data-latex="section">$1</h3>',
  );
  html = html.replace(
    /\\subsection\*?\{([^}]*)\}/g,
    '<h4 data-latex="subsection">$1</h4>',
  );

  // ── Lists ──
  html = html.replace(/\\begin\{itemize\}/g, "<ul>");
  html = html.replace(/\\end\{itemize\}/g, "</ul>");
  html = html.replace(/\\begin\{enumerate\}/g, "<ol>");
  html = html.replace(/\\end\{enumerate\}/g, "</ol>");
  html = html.replace(/\\begin\{description\}/g, "<ul>");
  html = html.replace(/\\end\{description\}/g, "</ul>");
  // Convert \item to <li>
  html = html.replace(/\\item\s*/g, "</li><li>");
  // Clean up first empty </li> after <ul>/<ol>
  html = html.replace(/<ul>\s*<\/li>/g, "<ul>");
  html = html.replace(/<ol>\s*<\/li>/g, "<ol>");
  // Close last <li> before </ul>/<ol>
  html = html.replace(/<li>([\s\S]*?)(?=<\/ul>)/g, "<li>$1</li>");
  html = html.replace(/<li>([\s\S]*?)(?=<\/ol>)/g, "<li>$1</li>");

  // ── Blockquotes ──
  html = html.replace(
    /\\begin\{quote\}([\s\S]*?)\\end\{quote\}/g,
    "<blockquote><p>$1</p></blockquote>",
  );

  // ── Center environment ──
  html = html.replace(
    /\\begin\{center\}([\s\S]*?)\\end\{center\}/g,
    '<p style="text-align: center">$1</p>',
  );

  // ── Inline formatting ──
  html = convertInlineLatex(html);

  // ── Footnotes → superscript with data attribute ──
  html = html.replace(
    /\\footnote\{([^}]*)\}/g,
    '<sup data-footnote="$1" class="footnote">[*]</sup>',
  );

  // ── Special characters ──
  html = html.replace(/---/g, "—");
  html = html.replace(/--/g, "–");
  html = html.replace(/\\%/g, "%");
  html = html.replace(/\\&/g, "&amp;");
  html = html.replace(/\\#/g, "#");
  html = html.replace(/\\\$/g, "$");
  html = html.replace(/\\_/g, "_");
  html = html.replace(/\\textasciitilde\{\}/g, "~");
  html = html.replace(/\\textasciicircum\{\}/g, "^");
  html = html.replace(/\\textbackslash\{\}/g, "\\");
  html = html.replace(/``/g, "\u201C"); // opening double quote
  html = html.replace(/''/g, "\u201D"); // closing double quote
  html = html.replace(/`/g, "\u2018"); // opening single quote
  html = html.replace(/'/g, "\u2019"); // closing single quote

  // ── Horizontal rules ──
  html = html.replace(/\\rule\{[^}]*\}\{[^}]*\}/g, "<hr>");

  // ── Strip remaining LaTeX comments ──
  html = html.replace(/^%.*$/gm, "");

  // ── Convert double newlines to paragraphs ──
  html = wrapParagraphs(html);

  // ── Clean up ──
  html = html.replace(/\n{3,}/g, "\n\n");
  html = html.replace(/<p>\s*<\/p>/g, "");
  html = html.replace(/<li>\s*<\/li>/g, "");

  return html.trim();
}

/** Convert inline LaTeX commands to HTML */
function convertInlineLatex(text: string): string {
  let result = text;

  // Bold
  result = result.replace(/\\textbf\{([^}]*)\}/g, "<strong>$1</strong>");
  // Italic
  result = result.replace(/\\textit\{([^}]*)\}/g, "<em>$1</em>");
  result = result.replace(/\\emph\{([^}]*)\}/g, "<em>$1</em>");
  // Underline
  result = result.replace(/\\underline\{([^}]*)\}/g, "<u>$1</u>");
  // Code/monospace
  result = result.replace(/\\texttt\{([^}]*)\}/g, "<code>$1</code>");
  // Small caps (just render as normal + attribute for roundtrip)
  result = result.replace(
    /\\textsc\{([^}]*)\}/g,
    '<span data-latex="textsc" style="font-variant: small-caps">$1</span>',
  );
  // Colored text (strip the color command, keep text)
  result = result.replace(/\\textcolor\{[^}]*\}\{([^}]*)\}/g, "$1");
  // URLs
  result = result.replace(
    /\\href\{([^}]*)\}\{([^}]*)\}/g,
    '<a href="$1">$2</a>',
  );
  result = result.replace(/\\url\{([^}]*)\}/g, '<a href="$1">$1</a>');

  // Strip remaining simple commands that don't affect content
  result = result.replace(/\\ref\{[^}]*\}/g, "[ref]");
  result = result.replace(/\\cite\{[^}]*\}/g, "[cite]");
  result = result.replace(/\\index\{[^}]*\}/g, "");

  return result;
}

/** Convert LaTeX table content to HTML table */
function convertTable(content: string): string {
  // Strip caption, label, centering
  let clean = content;
  clean = clean.replace(/\\caption\{[^}]*\}/g, "");
  clean = clean.replace(/\\label\{[^}]*\}/g, "");
  clean = clean.replace(/\\centering/g, "");
  clean = clean.replace(/\\toprule/g, "");
  clean = clean.replace(/\\midrule/g, "|||MIDRULE|||");
  clean = clean.replace(/\\bottomrule/g, "");
  clean = clean.replace(/\\hline/g, "|||MIDRULE|||");
  clean = clean.replace(/\\rowcolor\{[^}]*\}/g, "");

  const rows = clean
    .split("\\\\")
    .map((r) => r.trim())
    .filter((r) => r && r !== "|||MIDRULE|||");

  if (rows.length === 0) return "";

  let html = "<table><tbody>";
  let isHeader = true;

  for (const row of rows) {
    if (row === "|||MIDRULE|||") {
      isHeader = false;
      continue;
    }

    const cells = row.split("&").map((c) => {
      let cell = c.trim();
      // Strip multicolumn
      cell = cell.replace(/\\multicolumn\{\d+\}\{[^}]*\}\{([^}]*)\}/g, "$1");
      cell = convertInlineLatex(cell);
      return cell;
    });

    if (cells.every((c) => !c || c === "|||MIDRULE|||")) continue;

    const tag = isHeader ? "th" : "td";
    html += "<tr>";
    for (const cell of cells) {
      if (cell === "|||MIDRULE|||") continue;
      html += `<${tag}>${cell}</${tag}>`;
    }
    html += "</tr>";

    // After first row without midrule, assume it's header
    if (isHeader && !clean.includes("|||MIDRULE|||")) {
      isHeader = false;
    }
  }

  // Move first row to thead if we detected header
  html += "</tbody></table>";
  html = html.replace(/<tbody><tr><th>/, "<thead><tr><th>");
  html = html.replace(
    /<\/th><\/tr><tr><td>/,
    "</th></tr></thead><tbody><tr><td>",
  );

  return html;
}

/** Wrap loose text in <p> tags, respecting existing block elements */
function wrapParagraphs(html: string): string {
  const blockTags =
    /^<(h[1-6]|p|ul|ol|li|blockquote|table|thead|tbody|tr|th|td|div|hr|pre)/;
  const lines = html.split(/\n\n+/);
  const result: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (blockTags.test(trimmed)) {
      result.push(trimmed);
    } else if (trimmed.startsWith("<")) {
      result.push(trimmed);
    } else {
      result.push(`<p>${trimmed.replace(/\n/g, " ")}</p>`);
    }
  }

  return result.join("\n");
}

// ────────────────────────────────────────────────────
// HTML → LATEX
// ────────────────────────────────────────────────────

export function htmlToLatex(html: string): string {
  // Parse HTML using DOMParser
  const parser = new DOMParser();
  const doc = parser.parseFromString(
    `<div id="root">${html}</div>`,
    "text/html",
  );
  const root = doc.getElementById("root");
  if (!root) return html;

  return nodeToLatex(root).trim();
}

function nodeToLatex(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return escapeLatexChars(node.textContent || "");
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return "";

  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();
  const children = () =>
    Array.from(el.childNodes)
      .map((c) => nodeToLatex(c))
      .join("");

  switch (tag) {
    // ── Headings ──
    case "h2": {
      const latexCmd = el.dataset.latex === "chapter" ? "chapter" : "section";
      // If in chapter context (h2 = section in most BookForge chapters)
      return `\n\\${latexCmd}{${stripLatexEsc(children())}}\n\n`;
    }
    case "h3":
      return `\n\\section{${stripLatexEsc(children())}}\n\n`;
    case "h4":
      return `\n\\subsection{${stripLatexEsc(children())}}\n\n`;
    case "h5":
      return `\n\\subsection{${stripLatexEsc(children())}}\n\n`;

    // ── Formatting ──
    case "strong":
    case "b":
      return `\\textbf{${children()}}`;
    case "em":
    case "i":
      return `\\textit{${children()}}`;
    case "u":
      return `\\underline{${children()}}`;
    case "code":
      return `\\texttt{${children()}}`;
    case "s":
    case "del":
      return children(); // LaTeX doesn't have native strikethrough in our setup

    // ── Links ──
    case "a": {
      const href = el.getAttribute("href") || "";
      const text = children();
      if (text === href) return `\\url{${href}}`;
      return `\\href{${href}}{${text}}`;
    }

    // ── Paragraphs ──
    case "p": {
      const align = el.style?.textAlign;
      const content = children().trim();
      if (!content) return "\n";
      if (align === "center")
        return `\n\\begin{center}\n${content}\n\\end{center}\n\n`;
      return `\n${content}\n\n`;
    }

    // ── Lists ──
    case "ul":
      return `\n\\begin{itemize}\n${children()}\\end{itemize}\n\n`;
    case "ol":
      return `\n\\begin{enumerate}\n${children()}\\end{enumerate}\n\n`;
    case "li":
      return `  \\item ${children().trim()}\n`;

    // ── Blockquote ──
    case "blockquote":
      return `\n\\begin{quote}\n${children().trim()}\n\\end{quote}\n\n`;

    // ── Callout boxes ──
    case "div": {
      const calloutType = el.dataset.callout;
      if (calloutType) {
        const title = el.dataset.title || "";
        const content = children().trim();
        const titlePart = title ? `[${title}]` : "";
        return `\n\\begin{${calloutType}}${titlePart}\n${content}\n\\end{${calloutType}}\n\n`;
      }
      return children();
    }

    // ── Tables ──
    case "table":
      return convertHtmlTableToLatex(el);

    // ── HR ──
    case "hr":
      return "\n\\bigskip\\noindent\\rule{\\textwidth}{0.4pt}\\bigskip\n\n";

    // ── BR ──
    case "br":
      return "\\\\\n";

    // ── Sup (footnotes) ──
    case "sup": {
      const footnote = el.dataset.footnote;
      if (footnote) return `\\footnote{${footnote}}`;
      return children();
    }

    // ── Span (smallcaps etc.) ──
    case "span": {
      if (el.dataset.latex === "textsc") return `\\textsc{${children()}}`;
      return children();
    }

    // ── Skip structural tags ──
    case "thead":
    case "tbody":
    case "tr":
    case "th":
    case "td":
      return children();

    default:
      return children();
  }
}

/** Convert HTML table element to LaTeX tabularx */
function convertHtmlTableToLatex(table: HTMLElement): string {
  const rows: string[][] = [];
  let headerRows = 0;

  // Extract thead
  const thead = table.querySelector("thead");
  if (thead) {
    thead.querySelectorAll("tr").forEach((tr) => {
      const cells: string[] = [];
      tr.querySelectorAll("th, td").forEach((cell) => {
        cells.push(nodeToLatex(cell).trim());
      });
      rows.push(cells);
      headerRows++;
    });
  }

  // Extract tbody
  const tbody = table.querySelector("tbody") || table;
  const bodyRows = tbody.querySelectorAll(thead ? "tbody tr" : "tr");
  bodyRows.forEach((tr) => {
    const cells: string[] = [];
    tr.querySelectorAll("th, td").forEach((cell) => {
      cells.push(nodeToLatex(cell).trim());
    });
    if (cells.length > 0) rows.push(cells);
  });

  if (rows.length === 0) return "";

  const colCount = Math.max(...rows.map((r) => r.length));
  const colSpec = "X".repeat(colCount).split("").join(" ");

  let latex = `\n\\begin{table}[H]\n\\centering\n\\begin{tabularx}{\\textwidth}{${colSpec}}\n\\toprule\n`;

  rows.forEach((row, i) => {
    const paddedRow = [...row];
    while (paddedRow.length < colCount) paddedRow.push("");

    // Header rows get bold
    if (i < headerRows) {
      latex += paddedRow.map((c) => `\\textbf{${c}}`).join(" & ") + " \\\\\n";
      if (i === headerRows - 1) latex += "\\midrule\n";
    } else {
      latex += paddedRow.join(" & ") + " \\\\\n";
    }
  });

  latex += "\\bottomrule\n\\end{tabularx}\n\\end{table}\n\n";
  return latex;
}

/** Escape special LaTeX characters in plain text */
function escapeLatexChars(text: string): string {
  return text
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/&/g, "\\&")
    .replace(/%/g, "\\%")
    .replace(/\$/g, "\\$")
    .replace(/#/g, "\\#")
    .replace(/_/g, "\\_")
    .replace(/\{/g, "\\{")
    .replace(/\}/g, "\\}")
    .replace(/~/g, "\\textasciitilde{}")
    .replace(/\^/g, "\\textasciicircum{}")
    .replace(/\u201C/g, "``") // opening double quote
    .replace(/\u201D/g, "''") // closing double quote
    .replace(/\u2018/g, "`") // opening single quote
    .replace(/\u2019/g, "'") // closing single quote
    .replace(/\u2014/g, "---") // em dash
    .replace(/\u2013/g, "--"); // en dash
}

/**
 * Strip LaTeX escaping from text that's going into a LaTeX command argument.
 * This prevents double-escaping when text was already escaped by escapeLatexChars
 * but is being placed inside \section{}, \textbf{}, etc.
 */
function stripLatexEsc(text: string): string {
  return text
    .replace(/\\textbackslash\{\}/g, "\\")
    .replace(/\\&/g, "&")
    .replace(/\\%/g, "%")
    .replace(/\\\$/g, "$")
    .replace(/\\#/g, "#")
    .replace(/\\_/g, "_")
    .replace(/\\\{/g, "{")
    .replace(/\\\}/g, "}")
    .replace(/\\textasciitilde\{\}/g, "~")
    .replace(/\\textasciicircum\{\}/g, "^");
}
