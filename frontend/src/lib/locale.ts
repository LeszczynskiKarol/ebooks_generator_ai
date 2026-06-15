import { useLangStore } from "@/lib/i18n";

/** Language hint for transactional emails — follows the chosen UI language
 *  (?lang / saved choice / browser), so the email matches what the user sees. */
export function uiLang(): "pl" | "en" {
  return useLangStore.getState().lang;
}
