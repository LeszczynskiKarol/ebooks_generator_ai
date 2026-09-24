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

/**
 * `items` mode: decide WHICH chapters carry the item counter.
 *
 * A pure collection (cookbook: every chapter is a group of recipes) has every
 * non-[intro] section as an item, so the planned total equals the promised
 * count. A mixed book ("30-day back program": intro + anatomy + a 20-exercise
 * catalog + weekly plan + trackers) has more planned sections than items —
 * forcing \itemsection on the intro chapter prints "ĆWICZENIE 1" over
 * "Wprowadzenie" and shifts the catalog to 9–28 (incident 2026-09-24,
 * project cmufkxwsr…). Here we pick the subset of chapters whose non-intro
 * section counts sum EXACTLY to itemCount (fewest chapters wins — the
 * catalog, not five scattered prose chapters); with no exact subset we fall
 * back to the greedy largest-first cover.
 */
export function planItemChapters(
  chapters: { number: number; sections?: { description?: string | null }[] }[],
  itemCount: number | null,
): Set<number> {
  const counts = chapters.map((c) => ({
    number: c.number,
    n: (c.sections || []).filter(
      (s) => !String(s?.description || "").startsWith("[intro]"),
    ).length,
  }));
  const withItems = counts.filter((c) => c.n > 0);
  const total = withItems.reduce((a, c) => a + c.n, 0);
  if (!itemCount || itemCount <= 0 || total <= itemCount) {
    return new Set(withItems.map((c) => c.number));
  }
  // exact subset-sum, fewest chapters preferred (n ≤ 20 → brute force is fine)
  let best: number[] | null = null;
  if (withItems.length <= 20) {
    const m = withItems.length;
    for (let mask = 1; mask < 1 << m; mask++) {
      let sum = 0;
      let size = 0;
      for (let i = 0; i < m; i++)
        if (mask & (1 << i)) {
          sum += withItems[i].n;
          size++;
        }
      if (sum === itemCount && (best === null || size < best.length)) {
        best = withItems.filter((_, i) => mask & (1 << i)).map((c) => c.number);
      }
    }
  }
  if (best) return new Set(best);
  // greedy fallback: largest chapters first until the promise is covered
  const sorted = [...withItems].sort((a, b) => b.n - a.n);
  const picked = new Set<number>();
  let acc = 0;
  for (const c of sorted) {
    if (acc >= itemCount) break;
    picked.add(c.number);
    acc += c.n;
  }
  return picked;
}
