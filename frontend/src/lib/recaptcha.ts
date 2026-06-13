// reCAPTCHA Enterprise client — mirrors the backend's fail-open policy:
// when the site key is missing or the script can't load (adblock, offline),
// we return undefined and let the backend decide.

const SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY as string | undefined;

let loader: Promise<any> | null = null;

function loadScript(): Promise<any> {
  if (!SITE_KEY) return Promise.resolve(null);
  if (loader) return loader;
  loader = new Promise((resolve) => {
    const existing = (window as any).grecaptcha?.enterprise;
    if (existing) return resolve(existing);
    const s = document.createElement("script");
    s.src = `https://www.google.com/recaptcha/enterprise.js?render=${SITE_KEY}`;
    s.async = true;
    s.onload = () => {
      const g = (window as any).grecaptcha?.enterprise;
      if (!g) return resolve(null);
      g.ready(() => resolve(g));
    };
    s.onerror = () => resolve(null);
    document.head.appendChild(s);
  });
  return loader;
}

/** Pre-load the script so the first form submit isn't delayed. */
export function warmRecaptcha(): void {
  void loadScript();
}

/** Returns a token or undefined — never throws. */
export async function getRecaptchaToken(
  action: string,
): Promise<string | undefined> {
  try {
    const g = await Promise.race([
      loadScript(),
      new Promise((r) => setTimeout(() => r(null), 4000)),
    ]);
    if (!g) return undefined;
    return await (g as any).execute(SITE_KEY, { action });
  } catch {
    return undefined;
  }
}
