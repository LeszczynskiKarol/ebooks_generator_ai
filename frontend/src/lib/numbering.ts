// Heading numbering scheme — mirror of backend/src/lib/numbering.ts.
// The API returns the EFFECTIVE scheme on the project (`project.numbering`);
// the editor uses it to show the same numbers the PDF prints.

export const NUMBERING_MODES = [
  "hierarchical",
  "chapters",
  "none",
  "items",
] as const;
export type NumberingMode = (typeof NUMBERING_MODES)[number];

export interface NumberingSpec {
  mode: NumberingMode;
  itemLabel: string | null;
  itemCount: number | null;
  source: "project" | "brief" | "default";
}

export const DEFAULT_NUMBERING: NumberingSpec = {
  mode: "hierarchical",
  itemLabel: null,
  itemCount: null,
  source: "default",
};

/** How many \itemsection headings a chapter's LaTeX contains. */
export function countItems(latex: string | null | undefined): number {
  if (!latex) return 0;
  const m = latex.match(/\\itemsection\{/g);
  return m ? m.length : 0;
}
