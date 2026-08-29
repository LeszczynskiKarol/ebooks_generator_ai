// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Heading numbering scheme — decided per book, not global.
//
//   hierarchical  1. / 1.1. / 1.1.1.   textbooks, technical guides, anything
//                                      with cross-references
//   chapters      numbered chapters, unnumbered sections — most how-to /
//                                      self-help / career / parenting books
//   none          no numbers anywhere   essays, narrative, lead magnets
//   items         numbered chapters + a continuous ITEM counter across the
//                                      whole book ("Przepis 52", "Project 7",
//                                      "Ćwiczenie 14") — cookbooks, craft
//                                      pattern books, workbooks, collections
//
// The author brief proposes a scheme (brief.numbering); the owner can pin a
// different one on the project (Project.numberingMode / numberingLabel).
// Every consumer — structure + content prompts, LaTeX, EPUB, the editor —
// goes through resolveNumbering() so they can never disagree.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const NUMBERING_MODES = [
  "hierarchical",
  "chapters",
  "none",
  "items",
] as const;
export type NumberingMode = (typeof NUMBERING_MODES)[number];

export interface NumberingSpec {
  mode: NumberingMode;
  /** Label for the item counter in the book's language — only for `items` */
  itemLabel: string | null;
  /** Number of items promised by the topic/title ("60 przepisów") — `items` only */
  itemCount: number | null;
  /** Where the effective scheme came from */
  source: "project" | "brief" | "default";
}

export interface BriefNumbering {
  mode?: string | null;
  itemLabel?: string | null;
  itemCount?: number | null;
  reason?: string | null;
}

/** Default item label per language when the brief did not supply one. */
const DEFAULT_ITEM_LABEL: Record<string, string> = {
  pl: "Przepis",
  en: "Recipe",
  de: "Rezept",
  es: "Receta",
  fr: "Recette",
  it: "Ricetta",
};

export function isNumberingMode(v: unknown): v is NumberingMode {
  return typeof v === "string" && (NUMBERING_MODES as readonly string[]).includes(v);
}

/**
 * Effective numbering for a project. `authorBrief` is the raw JSON string
 * stored on the project (may be null / invalid — tolerated).
 */
export function resolveNumbering(project: {
  language?: string | null;
  numberingMode?: string | null;
  numberingLabel?: string | null;
  authorBrief?: string | null;
}): NumberingSpec {
  let brief: BriefNumbering | null = null;
  if (project.authorBrief) {
    try {
      const parsed = JSON.parse(project.authorBrief);
      if (parsed && typeof parsed.numbering === "object") brief = parsed.numbering;
    } catch {
      /* invalid brief JSON — fall through to defaults */
    }
  }

  const lang = project.language || "en";
  const fallbackLabel = DEFAULT_ITEM_LABEL[lang] || DEFAULT_ITEM_LABEL.en;

  // 1. owner override on the project
  if (isNumberingMode(project.numberingMode)) {
    const mode = project.numberingMode;
    return {
      mode,
      itemLabel:
        mode === "items"
          ? project.numberingLabel?.trim() || brief?.itemLabel?.trim() || fallbackLabel
          : null,
      itemCount: mode === "items" ? brief?.itemCount ?? null : null,
      source: "project",
    };
  }

  // 2. brief decision
  if (brief && isNumberingMode(brief.mode)) {
    const mode = brief.mode;
    return {
      mode,
      itemLabel:
        mode === "items"
          ? project.numberingLabel?.trim() || brief.itemLabel?.trim() || fallbackLabel
          : null,
      itemCount: mode === "items" ? brief.itemCount ?? null : null,
      source: "brief",
    };
  }

  // 3. platform default (what every book got before this feature)
  return { mode: "hierarchical", itemLabel: null, itemCount: null, source: "default" };
}

/**
 * Prompt block shared by the structure and content generators: tells the
 * model which heading commands exist for this book and how they number.
 */
export function formatNumberingForPrompt(n: NumberingSpec): string {
  switch (n.mode) {
    case "items": {
      const count = n.itemCount
        ? ` The book promises EXACTLY ${n.itemCount} items — the whole book must contain exactly that many \\itemsection headings, no more, no fewer.`
        : "";
      return `HEADING NUMBERING SCHEME: "items" — this is a COLLECTION book. Chapters are numbered groups (e.g. breakfasts, desserts). Each individual item (a recipe, a project, an exercise, a template...) is a heading emitted with \\itemsection{Title} and gets ONE continuous number across the whole book, rendered as "${n.itemLabel} 1", "${n.itemLabel} 2", ... — never as 3.2.4. Plain \\section{} is unnumbered here and is used ONLY for the few non-item passages of a chapter (an intro, a technique explainer, a closing note). NEVER put an item under \\section or \\subsection.${count}`;
    }
    case "chapters":
      return `HEADING NUMBERING SCHEME: "chapters" — chapters carry numbers, sections and subsections do NOT (no 3.2, no 3.2.1 anywhere). Write section titles that stand on their own without a number.`;
    case "none":
      return `HEADING NUMBERING SCHEME: "none" — nothing is numbered, not even chapters. Titles must work as pure text; never refer to "chapter 3" or "section 2.1" — refer to titles instead.`;
    default:
      return `HEADING NUMBERING SCHEME: "hierarchical" — the classic 1. / 1.1. / 1.1.1. scheme (chapter.section.subsection). Cross-references by number are fine.`;
  }
}
