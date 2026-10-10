// Book languages on the frontend — mirrors backend lib/languages.ts.
//
// ORDER_LANGUAGES is what the order form lists. LANGUAGE_LABEL_KEYS also
// covers codes that existing projects may carry but that are no longer
// offered: plain "es" (ordered before the Spain / Latin America split).

/** code → i18n label key (dict/newProject.ts) */
export const LANGUAGE_LABEL_KEYS: Record<string, string> = {
  en: "newProject.langEn",
  pl: "newProject.langPl",
  de: "newProject.langDe",
  "es-ES": "newProject.langEsEs",
  "es-419": "newProject.langEs419",
  es: "newProject.langEs",
  "pt-PT": "newProject.langPtPt",
  "pt-BR": "newProject.langPtBr",
};

/** Listed in the order form, in this order. */
export const ORDER_LANGUAGES = ["en", "pl", "de", "es-ES", "es-419", "pt-PT", "pt-BR"] as const;

/** Base language ("es-419" → "es") — for per-language templates. */
export function baseLang(code: string | null | undefined): string {
  return (code || "en").slice(0, 2).toLowerCase();
}

/** Label key for a stored code; unknown codes fall back to the base language. */
export function languageLabelKey(code: string | null | undefined): string | undefined {
  if (!code) return undefined;
  return LANGUAGE_LABEL_KEYS[code] ?? LANGUAGE_LABEL_KEYS[baseLang(code)];
}
