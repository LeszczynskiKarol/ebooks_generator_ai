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
