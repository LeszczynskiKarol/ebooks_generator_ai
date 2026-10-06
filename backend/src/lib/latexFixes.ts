// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Shared LaTeX repair passes, applied wherever model-produced LaTeX
// enters the system (generation post-processing, review insertions,
// PDF assembly, EPUB conversion).
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Repair LaTeX commands mangled by JSON string escapes.
 *
 * When the model returns LaTeX inside JSON with SINGLE backslashes,
 * JSON.parse turns \t \b \f \n \r into control characters and the command
 * loses its backslash: "\textbf{X}" → TAB + "extbf{X}" (renders as the
 * literal text "extbfX"). Re-attach the backslash for the known commands.
 */
export function repairControlCharLatex(latex: string): string {
  return (
    latex
      // \t — \textbf, \textit, \texttt, \textcolor, \textwidth, \tabularx, \toprule, \table
      .replace(/\t(?=ext|abular|oprule|able\b|itlepage)/g, "\\t")
      // \b — \begin, \bottomrule, \bfseries, \bigskip
      .replace(/[\b](?=egin\{|ottomrule|fseries|igskip)/g, "\\b")
      // \f — \footnote, \frac, \framebox
      .replace(/\f(?=ootnote|rac\{|ramebox)/g, "\\f")
      // \n — \newpage, \newline, \noindent, \newcommand (newline char before them)
      .replace(/\r?\n(?=ewpage\b|ewline\b|oindent\b|ewcommand\b)/g, "\\n")
      // \r — \rowcolor, \rightarrow, \ref{, \rule
      .replace(/\r(?=owcolor|ightarrow|ef\{|ule\b)/g, "\\r")
  );
}

/**
 * Merge table headers the model emitted as one row PER CELL:
 *
 *   \rowcolor{tableheadbg}
 *   \textcolor{tableheadfg}{\textbf{A}} & & & \\
 *   \textcolor{tableheadfg}{\textbf{B}} & & & \\
 *   ...
 *
 * Only the first row gets the colored background; the rest render as
 * white-on-white (invisible) rows. Collapse into a single header row.
 */
export function mergeSplitTableHeaders(latex: string): string {
  const re =
    /\\rowcolor\{tableheadbg\}\s*\n((?:[ \t]*\\textcolor\{tableheadfg\}\{\\textbf\{[^}]*\}\}[ \t]*(?:&[ \t]*)*\\\\[ \t]*\n?)+)/g;
  return latex.replace(re, (full, rows: string) => {
    const cells = [
      ...rows.matchAll(/\\textcolor\{tableheadfg\}\{\\textbf\{([^}]*)\}\}/g),
    ].map((m) => m[1]);
    if (cells.length < 2) return full;
    const merged = cells
      .map((c) => `\\textcolor{tableheadfg}{\\textbf{${c}}}`)
      .join(" & ");
    console.log(
      `  🔧 Merged ${cells.length} split header rows into one: ${cells.join(" | ").substring(0, 60)}`,
    );
    return `\\rowcolor{tableheadbg}\n${merged} \\\\\n`;
  });
}

/**
 * Repair damage done by the WYSIWYG round trip (frontend latexConverter < v4,
 * see the Melbourne book incident 2026-09-12):
 *
 *  - a footnote whose URL leaked into the body as text — the attribute
 *    `data-footnote="… <a href="URL">…"` broke on the inner quote, so the
 *    saved LaTeX reads `sentence.URL" class="footnote">[*]`
 *  - orphan `[*]` markers (footnote content dropped by the editor schema)
 *  - `\textbackslash{}` + space / comma (the editor escaped `\ ` and `\,`)
 *  - `$` unescaped inside a \bignumber value (→ math mode, huge line gaps)
 *  - stray HTML tags / entities
 *
 * Idempotent: clean LaTeX passes through unchanged.
 */
export function repairEditorArtifacts(latex: string): string {
  let r = latex;
  const Q = `(?:"|'')`; // quotes may already be normalised to '' by the sanitizer
  const MARK = `\\s*${Q}\\s*class=${Q}\\s*footnote\\s*${Q}>\\[\\*\\]`;

  // 1. Leaked footnote: `text.URL[ tail]" class="footnote">[*]` → \footnote{\url{URL} tail}
  //    URL starts right after sentence punctuation; tail = rest of the footnote
  //    body that leaked after the first link (never crosses a line).
  const leaked = new RegExp(
    `(?<=[.!?)}:;,])((?:https?:\\/\\/|www\\.)?[A-Za-z0-9][A-Za-z0-9.\\-]*\\.[a-z]{2,}(?:\\/[^\\s"'{}<>]*)?)([^"\\n]{0,400}?)${MARK}`,
    "g",
  );
  r = r.replace(leaked, (m, url: string, tail: string) => {
    // Guard against matching a TLD fragment inside \href{…}{…} ("com.au}"):
    // a real leaked URL has a scheme, www., a path or ≥2 dots, and the
    // recovered footnote body must have balanced braces.
    const looksLikeUrl =
      /^(?:https?:\/\/|www\.)/.test(url) ||
      url.includes("/") ||
      (url.match(/\./g) || []).length >= 2;
    let depth = 0;
    for (const c of url + tail) {
      if (c === "{") depth++;
      else if (c === "}") depth--;
      if (depth < 0) break;
    }
    if (!looksLikeUrl || depth !== 0) return m;
    const cleanUrl = url.replace(/[.,;]+$/, "");
    const cleanTail = tail.replace(/^\.\s*/, "").trim();
    const sep = /^[,;:]/.test(cleanTail) ? "" : " ";
    return `\\footnote{\\url{${cleanUrl}}${cleanTail ? sep + cleanTail : ""}}`;
  });
  // 2. Any leftover marker fragments and orphan [*] markers
  r = r.replace(new RegExp(MARK, "g"), "");
  r = r.replace(/\[\*\]/g, "");

  // 3. Escaped control-space / thin-space
  r = r.replace(/\\textbackslash\{\} /g, "\\ ");
  r = r.replace(/\\textbackslash\{\},/g, "\\,");

  // 4. \bignumber{$5.70} → \bignumber{\$5.70}
  r = r.replace(/\\bignumber\{([^{}]*)\}/g, (_m, v: string) => {
    return `\\bignumber{${v.replace(/(?<!\\)\$/g, "\\$")}}`;
  });

  // 5. Stray HTML tags and entities
  r = r.replace(/<\/?(?:sup|a|span|strong|em|b|i|u|code|p|div|br)\b[^<>]*>/g, "");
  r = r
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, "~")
    .replace(/&lt;/g, "\\textless{}")
    .replace(/&gt;/g, "\\textgreater{}")
    .replace(/&amp;/g, "\\&");

  return r;
}

/**
 * URLs the model set in \texttt{} cannot break → they run past the right
 * margin on A5. Route anything that looks like a domain/URL through \url{}
 * (hyperref+url break after "/" and "." and, with the hyphens option, "-").
 */
export function urlifyTexttt(latex: string): string {
  return latex.replace(
    /\\texttt\{((?:https?:\/\/|www\.)?[a-z0-9][a-z0-9.\-]*\.[a-z]{2,}(?:\/[^\s{}]*)?)\}/gi,
    "\\url{$1}",
  );
}

/**
 * Inline code (\texttt{…}: Excel formulas, shell commands) must keep straight
 * quotes and may break after separators. The prose quote passes turned
 * =IF(A2="Yes";…) into =IF(A2='' Yes'';…) (typographic quote plus the
 * "space after closing quote" fix) and a long formula ran past the margin,
 * since \texttt never breaks a line (2026-10-07, Excel workbook).
 *
 * protectCodeSpans swaps every \texttt{…} (balanced braces) for a placeholder,
 * runs `transform` on the rest, then restores the spans with:
 *  - quotes (", '', ,, ``) → \textquotedbl{} (" is an active babel-polish char),
 *    dropping the space the closing-quote pass glued after an opening quote;
 *  - \allowbreak{} after ; , ( in spans longer than 24 characters.
 * Idempotent: running it again on its own output changes nothing.
 */
export function protectCodeSpans(latex: string, transform: (s: string) => string): string {
  const spans: string[] = [];
  let out = "";
  let i = 0;
  const OPEN = "\\texttt{";
  while (true) {
    const at = latex.indexOf(OPEN, i);
    if (at < 0) break;
    let depth = 1;
    let j = at + OPEN.length;
    for (; j < latex.length && depth > 0; j++) {
      const ch = latex[j];
      if (ch === "\\") {
        j++;
        continue;
      } // \{ \} \% are escaped, not braces
      if (ch === "{") depth++;
      else if (ch === "}") depth--;
    }
    if (depth !== 0) break; // unbalanced: leave the rest untouched
    out += latex.slice(i, at) + `\uE000${spans.length}\uE001`;
    spans.push(latex.slice(at + OPEN.length, j - 1));
    i = j;
  }
  out += latex.slice(i);
  if (!spans.length) return transform(latex);
  return transform(out).replace(/\uE000(\d+)\uE001/g, (_m, n) => `\\texttt{${fixCodeSpan(spans[+n])}}`);
}

function fixCodeSpan(code: string): string {
  let c = code
    .replace(/\\textquotedbl\{\}/g, "\uE002")
    // opening quote after a separator: the closing-quote pass glued a space after it
    .replace(/([=;,(<>&])\s*(?:''|,,|``|")\s?/g, "$1\uE002")
    .replace(/(?:''|,,|``|")/g, "\uE002")
    .replace(/\uE002/g, "\\textquotedbl{}");
  if (c.replace(/\\[a-zA-Z]+\{\}|\\./g, "x").length > 24) {
    c = c.replace(/([;,(])(?!\\allowbreak)/g, "$1\\allowbreak{}");
  }
  return c;
}
