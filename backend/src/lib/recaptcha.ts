// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// reCAPTCHA Enterprise verification — FAIL-OPEN by design (pattern from
// kurs-copywritingu.pl): missing config or a network error lets the request
// through; only an actually-bad assessment (invalid token, wrong action,
// low score) blocks. `strict` additionally requires a token to be present.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const PROJECT_ID = process.env.RECAPTCHA_PROJECT_ID || "";
const API_KEY = process.env.RECAPTCHA_API_KEY || "";
const SITE_KEY = process.env.RECAPTCHA_SITE_KEY || "";
const MIN_SCORE = parseFloat(process.env.RECAPTCHA_MIN_SCORE || "0.5");

const configured = !!(PROJECT_ID && API_KEY && SITE_KEY);

export async function verifyRecaptcha(
  token: string | undefined | null,
  expectedAction: string,
  opts: { strict?: boolean } = {},
): Promise<{ ok: boolean; reason?: string; score?: number }> {
  if (!configured) return { ok: true, reason: "not_configured" };
  if (!token) {
    return opts.strict
      ? { ok: false, reason: "missing_token" }
      : { ok: true, reason: "missing_token_lenient" };
  }

  try {
    const res = await fetch(
      `https://recaptchaenterprise.googleapis.com/v1/projects/${PROJECT_ID}/assessments?key=${API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: { token, expectedAction, siteKey: SITE_KEY },
        }),
        signal: AbortSignal.timeout(5000),
      },
    );
    if (!res.ok) {
      console.warn(`reCAPTCHA API ${res.status} — failing open`);
      return { ok: true, reason: "api_error" };
    }
    const data: any = await res.json();
    if (!data?.tokenProperties?.valid) {
      return { ok: false, reason: data?.tokenProperties?.invalidReason || "invalid" };
    }
    if (data.tokenProperties.action !== expectedAction) {
      return { ok: false, reason: "action_mismatch" };
    }
    const score = data?.riskAnalysis?.score ?? 0;
    if (score < MIN_SCORE) return { ok: false, reason: "low_score", score };
    return { ok: true, score };
  } catch (err: any) {
    console.warn(`reCAPTCHA verify failed (${err.message}) — failing open`);
    return { ok: true, reason: "network_error" };
  }
}
