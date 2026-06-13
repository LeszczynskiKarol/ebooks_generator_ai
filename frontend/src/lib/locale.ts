/** Language hint for transactional emails (backend defaults to "en"). */
export function uiLang(): "pl" | "en" {
  return navigator.language?.toLowerCase().startsWith("pl") ? "pl" : "en";
}
