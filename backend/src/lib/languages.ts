/**
 * Book languages — the registry of what a book can be WRITTEN in.
 *
 * A code is either a bare language ("de") or a regional variant ("es-419",
 * "pt-BR"). The variant matters for the WRITTEN text only (vocabulary,
 * spelling, forms of address, quote marks — a Brazilian and a Portuguese
 * reader get different prose for the same book); research sources are shared
 * per base language (`sourceLang`), which is what cytado and the per-language
 * maps elsewhere are keyed by (look them up with `byLang`).
 *
 * `offered` = accepted by the API. An entry is switched on only after: the
 * texlive-lang-* package is on the server (babel .ldf + hyphenation), cytado
 * accepts `sourceLang`, and a test book compiles.
 *
 * Adding a language/variant: one entry here, then the test book. The order
 * form lists its own subset (frontend lib/bookLanguages.ts).
 */
type Quotes = "en" | "pl" | "de" | "angle";

export interface BookLanguageInfo {
  code: string;
  /** base language for sources and for the per-language maps (2 letters) */
  sourceLang: string;
  /** how prompts name the language the book must be written in */
  llmName: string;
  /** what makes THIS variant's prose different — injected into every prompt
   *  that writes or proofreads reader-facing text */
  note?: string;
  quotes: Quotes;
  /** Serper/Google country of the result set (cytado: serper_gl) */
  serperGl: string;
  /** Serper/Google interface language */
  serperHl: string;
  /** variant spanning several countries: search in the BUYER's country when
   *  it is one of these (ISO-3166 alpha-2, lowercase), else `serperGl` */
  glCountries?: string[];
  offered: boolean;
}

// Spanish-speaking Latin America (Google `gl` codes).
const LATAM_ES = [
  "mx", "ar", "co", "cl", "pe", "ve", "ec", "gt", "cu", "bo", "do", "hn",
  "py", "sv", "ni", "cr", "pa", "uy", "pr",
];

const REGISTRY: BookLanguageInfo[] = [
  { code: "en", sourceLang: "en", llmName: "English", quotes: "en", serperGl: "us", serperHl: "en", offered: true },
  { code: "pl", sourceLang: "pl", llmName: "Polish", quotes: "pl", serperGl: "pl", serperHl: "pl", offered: true },
  { code: "de", sourceLang: "de", llmName: "German", quotes: "de", serperGl: "de", serperHl: "de", offered: true },

  // Spanish: two written variants over the same `es` sources. Written
  // non-fiction Spanish is one norm across Latin America (publishers and
  // localisation use a single neutral variant), so there is ONE Latin American
  // entry, not one per country; the real split is Spain vs the rest.
  {
    code: "es-ES", sourceLang: "es", llmName: "Peninsular Spanish", quotes: "angle",
    note:
      'Spanish as written and published in Spain: Spain\'s vocabulary and usage (ordenador, móvil, coche, zumo), "vosotros" where an informal plural is needed. Never Latin American regionalisms.',
    serperGl: "es", serperHl: "es", offered: true,
  },
  {
    code: "es-419", sourceLang: "es", llmName: "Latin American Spanish", quotes: "en",
    note:
      'Neutral Latin American Spanish, natural to readers from Mexico to Argentina: "ustedes" for every plural (NEVER "vosotros"), no voseo ("tú", never "vos"), Latin American vocabulary (computadora, celular, auto, jugo), no country-specific slang and no Spain-only words. When the topic or the guidelines point to a specific country, use that country\'s currency, institutions, laws and everyday examples; otherwise keep examples country-neutral.',
    serperGl: "mx", serperHl: "es-419", glCountries: LATAM_ES, offered: true,
  },
  // Plain "es": books ordered before the split. Accepted, no longer listed.
  {
    code: "es", sourceLang: "es", llmName: "Spanish", quotes: "angle",
    note: 'Neutral international Spanish: no regionalisms, no "vosotros".',
    serperGl: "es", serperHl: "es", offered: true,
  },

  // Portuguese: two written variants over the same `pt` sources (cytado's
  // external API takes `pt` since 2026-10-10).
  {
    code: "pt-PT", sourceLang: "pt", llmName: "European Portuguese", quotes: "angle",
    note:
      "Portuguese as written and published in Portugal: European spelling and vocabulary (autocarro, telemóvel, ficheiro, equipa, facto), \"estar a fazer\" constructions, \"tu\"/\"você\" as used in Portugal. Never Brazilian forms (ônibus, celular, arquivo, time, gerund \"está fazendo\").",
    serperGl: "pt", serperHl: "pt-pt", offered: true,
  },
  {
    code: "pt-BR", sourceLang: "pt", llmName: "Brazilian Portuguese", quotes: "en",
    note:
      "Portuguese as written and published in Brazil: Brazilian spelling and vocabulary (ônibus, celular, arquivo, time, fato), gerund constructions (\"está fazendo\"), \"você\" for the reader, Brazilian currency and realities unless the topic says otherwise. Never European Portuguese forms (autocarro, telemóvel, ficheiro, \"estar a fazer\").",
    serperGl: "br", serperHl: "pt-br", offered: true,
  },
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
export function baseLang(language: string | null | undefined): string {
  return bookLanguageInfo(language)?.sourceLang ?? (language || "en").slice(0, 2).toLowerCase();
}

/** Look a per-language map up by the exact code first ("pt-BR"), then by the
 *  base language ("pt"). */
export function byLang<T>(map: Record<string, T>, language: string | null | undefined): T | undefined {
  const code = bookLanguageInfo(language)?.code ?? (language || "");
  return map[code] ?? map[baseLang(language)];
}

// Languages with prompt/LaTeX maps but no registry entry (not sold).
const OTHER_NAMES: Record<string, string> = {
  fr: "French",
  it: "Italian",
  pt: "Portuguese",
  nl: "Dutch",
};

/** The language name to use in prompts ("Latin American Spanish"). */
export function llmLangName(language: string | null | undefined): string {
  return bookLanguageInfo(language)?.llmName ?? OTHER_NAMES[baseLang(language)] ?? "English";
}

/** One line for prompts that write/proofread reader-facing text: what makes
 *  this regional variant's prose different. "" when there is nothing to add. */
export function variantNote(language: string | null | undefined): string {
  const info = bookLanguageInfo(language);
  return info?.note ? `LANGUAGE VARIANT — ${info.llmName}: ${info.note}` : "";
}

/** Serper/Google `gl` (country of the result set). `buyerCountry` (ISO-3166
 *  alpha-2) wins for variants that span several countries. */
export function serperGl(language: string, buyerCountry?: string | null): string {
  const info = bookLanguageInfo(language);
  if (!info) return OTHER_NAMES[baseLang(language)] ? baseLang(language) : "us";
  const c = (buyerCountry || "").trim().toLowerCase();
  return c && info.glCountries?.includes(c) ? c : info.serperGl;
}

/** Serper/Google `hl` (interface language). */
export function serperHl(language: string): string {
  return bookLanguageInfo(language)?.serperHl ?? baseLang(language);
}

function quoteStyle(language: string): Quotes {
  const info = bookLanguageInfo(language);
  if (info) return info.quotes;
  const l = baseLang(language);
  return l === "pl" || l === "de" ? l : "en";
}

/** Quote marks per book language: pl „…”, de „…“, es-ES/pt-PT «…», else “…”.
 *  pl/de/en as TeX ligatures (,, `` ''); German closes with the high-left ``
 *  (→ U+201C), not English ''. Angle quotes as the characters themselves —
 *  the same text feeds the EPUB, which knows the ligatures but not << >>. */
export function quoteMarks(language: string): { open: string; close: string } {
  const q = quoteStyle(language);
  if (q === "de") return { open: ",,", close: "``" };
  if (q === "pl") return { open: ",,", close: "''" };
  if (q === "angle") return { open: "«", close: "»" };
  return { open: "``", close: "''" };
}

/** Typography rule for the chapter-writing prompt (quotes + native letters).
 *  "" for English. */
export function typographyNote(language: string): string {
  const base = baseLang(language);
  const q = quoteStyle(language);
  if (base === "pl")
    return '- Polish typography: quotations ALWAYS as „..." (U+201E/U+201D) — NEVER "..." or “...”';
  if (base === "de")
    return '- German typography: quotations ALWAYS as „...“ (U+201E/U+201C) — NEVER "..." or “...”. Write ä, ö, ü, ß as plain characters — never ae/oe/ue/ss substitutes, never LaTeX accents like \\"a';
  const quotes =
    q === "angle"
      ? 'quotations ALWAYS as «...» (U+00AB/U+00BB) — NEVER "..." or “...”'
      : "quotations ALWAYS as “...” (U+201C/U+201D) — NEVER straight \"...\" and never «...»";
  if (base === "es")
    return `- Spanish typography: ${quotes}. Questions and exclamations open with ¿ and ¡. Write á, é, í, ó, ú, ü, ñ as plain characters — never LaTeX accents like \\'a or \\~n`;
  if (base === "pt")
    return (
      `- Portuguese typography: ${quotes}. Write á, â, ã, à, ç, é, ê, í, ó, ô, õ, ú as plain characters — never LaTeX accents like \\'a, \\~a or \\c{c}` +
      (bookLanguageInfo(language)?.code === "pt-BR"
        ? ". Brazilian reais are written R\\$ 150 — the dollar sign ALWAYS escaped as \\$"
        : "")
    );
  return "";
}

/** The "Quotes:" line of the chapter prompt — the marks for THIS language. */
export function quoteHint(language: string): string {
  const q = quoteMarks(language);
  return `${q.open}...${q.close}`;
}
