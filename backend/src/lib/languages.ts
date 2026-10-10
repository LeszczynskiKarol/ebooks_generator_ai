/**
 * Book languages — the registry of what a book can be WRITTEN in.
 *
 * A code is either a bare language ("es") or a regional variant ("pt-BR").
 * The variant matters for the WRITTEN text only (vocabulary, spelling, forms
 * of address — a Brazilian and a Portuguese reader get different prose for the
 * same book); research sources are shared per base language (`sourceLang`),
 * which is what cytado and the per-language maps elsewhere are keyed by.
 *
 * `offered` = sold in the order form and accepted by the API. An entry is
 * switched on only after: the texlive-lang-* package is on the server (babel
 * .ldf + hyphenation), cytado accepts `sourceLang`, and a test book compiles.
 *
 * Adding a language/variant: one entry here, then the test book.
 */
export interface BookLanguageInfo {
  code: string;
  /** base language for sources and for the per-language maps (2 letters) */
  sourceLang: string;
  /** how prompts name the language the book must be written in */
  llmName: string;
  /** Serper/Google country of the result set (cytado: serper_gl) */
  serperGl: string;
  offered: boolean;
}

const REGISTRY: BookLanguageInfo[] = [
  { code: "en", sourceLang: "en", llmName: "English", serperGl: "us", offered: true },
  { code: "pl", sourceLang: "pl", llmName: "Polish", serperGl: "pl", offered: true },
  { code: "de", sourceLang: "de", llmName: "German", serperGl: "de", offered: true },
  { code: "es", sourceLang: "es", llmName: "Spanish", serperGl: "es", offered: true },
  // Portuguese: two WRITTEN variants over the same `pt` sources. Not offered
  // yet — cytado's API does not take `pt` in production use, and the other
  // per-language maps (babel "portuguese" vs "brazilian", prompts) still need
  // the variant wired in. TeX packages are already on the server.
  { code: "pt-PT", sourceLang: "pt", llmName: "European Portuguese (Portugal)", serperGl: "pt", offered: false },
  { code: "pt-BR", sourceLang: "pt", llmName: "Brazilian Portuguese", serperGl: "br", offered: false },
];

const BY_CODE = new Map(REGISTRY.map((l) => [l.code.toLowerCase(), l]));

export const BOOK_LANGUAGES: readonly string[] = REGISTRY.filter((l) => l.offered).map(
  (l) => l.code,
);

/** Registry entry for a stored code (any case); null when unknown. */
export function bookLanguageInfo(v: unknown): BookLanguageInfo | null {
  return typeof v === "string" ? BY_CODE.get(v.trim().toLowerCase()) ?? null : null;
}

/** Canonical code of an OFFERED language; unknown/unoffered/missing → null
 *  (caller decides the default or rejects). */
export function normBookLanguage(v: unknown): string | null {
  const info = bookLanguageInfo(v);
  return info?.offered ? info.code : null;
}

/** Base language ("pt-BR" → "pt") — the key of the per-language maps. */
export function baseLang(language: string): string {
  return bookLanguageInfo(language)?.sourceLang ?? (language || "en").slice(0, 2).toLowerCase();
}

/** Serper/Google `gl` (country of the result set) per book language. */
const SERPER_GL_FALLBACK: Record<string, string> = {
  fr: "fr",
  it: "it",
  pt: "pt",
  nl: "nl",
};

export function serperGl(language: string): string {
  return (
    bookLanguageInfo(language)?.serperGl ||
    SERPER_GL_FALLBACK[(language || "").slice(0, 2).toLowerCase()] ||
    "us"
  );
}

/** Quote marks per book language: pl „…”, de „…“, es «…», else “…”.
 *  pl/de/en as TeX ligatures (,, `` ''); German closes with the high-left ``
 *  (→ U+201C), not English ''. Spanish as the characters themselves — the
 *  same text feeds the EPUB, which knows the ligatures but not << >>. */
export function quoteMarks(language: string): { open: string; close: string } {
  const l = baseLang(language);
  if (l === "de") return { open: ",,", close: "``" };
  if (l === "pl") return { open: ",,", close: "''" };
  if (l === "es") return { open: "«", close: "»" };
  return { open: "``", close: "''" };
}
