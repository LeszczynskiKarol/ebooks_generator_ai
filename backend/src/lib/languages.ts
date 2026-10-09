/**
 * Book languages the product actually sells — the whole pipeline (research
 * via Serper/cytado, prompts, typography, LaTeX babel + hyphenation) is
 * verified for these. Other codes still have prompt/LaTeX maps elsewhere,
 * but are not offered until they get the same end-to-end check.
 *
 * Adding a language: one entry here + `serperGl` below + the matching
 * texlive-lang-* package on the server (babel .ldf + hyphenation patterns),
 * then a test book.
 */
export const BOOK_LANGUAGES = ["en", "pl", "de"] as const;
export type BookLanguage = (typeof BOOK_LANGUAGES)[number];

export function isBookLanguage(v: unknown): v is BookLanguage {
  return typeof v === "string" && (BOOK_LANGUAGES as readonly string[]).includes(v);
}

/** Unknown/missing → null (caller decides the default or rejects). */
export function normBookLanguage(v: unknown): BookLanguage | null {
  const l = typeof v === "string" ? v.trim().toLowerCase().slice(0, 2) : "";
  return isBookLanguage(l) ? l : null;
}

/** Serper/Google `gl` (country of the result set) per book language.
 *  Same values as cytado's worker/languages.py (serper_gl). */
const SERPER_GL: Record<string, string> = {
  en: "us",
  pl: "pl",
  de: "de",
  es: "es",
  fr: "fr",
  it: "it",
  pt: "pt",
  nl: "nl",
};

export function serperGl(language: string): string {
  return SERPER_GL[language] || "us";
}

/** TeX-ligature quote marks per book language: pl „…”, de „…“, else “…”.
 *  German closes with the high-left `` (→ U+201C), not English ''. */
export function quoteMarks(language: string): { open: string; close: string } {
  if (language === "de") return { open: ",,", close: "``" };
  if (language === "pl") return { open: ",,", close: "''" };
  return { open: "``", close: "''" };
}
