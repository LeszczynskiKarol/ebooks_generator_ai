import { siteConfig } from "../config/site";
import type { Lang } from "../i18n/ui";

/**
 * Google Play link for the Android app. `hl` keeps the store page in the
 * visitor's language, and `referrer` rides along to the Play Install Referrer
 * API so Play Console can tell which page on the site sent the install.
 */
export function playHref(lang: Lang, campaign: string): string {
  const referrer = new URLSearchParams({
    utm_source: "inkmagnet.com",
    utm_medium: "website",
    utm_campaign: campaign,
  }).toString();
  const q = new URLSearchParams({ id: siteConfig.playId, hl: lang, referrer });
  return `https://play.google.com/store/apps/details?${q.toString()}`;
}

/** Path of the mobile-app landing page in the given language. */
export function appPagePath(lang: Lang): string {
  return lang === "pl" ? "/pl/aplikacja-mobilna/" : "/mobile-app/";
}
