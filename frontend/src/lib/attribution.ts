// First-touch attribution for the app. Captured once per browser on the very
// first pageview (before the SPA router rewrites anything) and sent along with
// register / google sign-up so the backend can store where the user came from.
const KEY = "ink_attrib";

export interface Attribution {
  referrer: string;
  landing: string;
  ts: number;
}

export function captureAttribution(): void {
  try {
    if (localStorage.getItem(KEY)) return;
    const a: Attribution = {
      referrer: document.referrer || "",
      landing: location.href,
      ts: Date.now(),
    };
    localStorage.setItem(KEY, JSON.stringify(a));
  } catch {}
}

export function getAttribution(): Pick<Attribution, "referrer" | "landing"> | undefined {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return undefined;
    const a = JSON.parse(raw) as Attribution;
    return { referrer: a.referrer, landing: a.landing };
  } catch {
    return undefined;
  }
}

// GA4 event helper (no-op when gtag is not loaded / blocked).
export function track(event: string, params?: Record<string, unknown>): void {
  try {
    const g = (window as any).gtag;
    if (typeof g === "function") g("event", event, params || {});
  } catch {}
}
