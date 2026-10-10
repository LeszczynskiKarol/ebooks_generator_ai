// Build-time USD→PLN rate from NBP Table A (mid). Fetched once per build and
// baked into the /pl pages; a rebuild refreshes it. Falls back if NBP is down.
let cached: number | null = null;
let inflight: Promise<number> | null = null;
const FALLBACK_RATE = 4.05;

export async function getUsdPlnRate(): Promise<number> {
  if (cached != null) return cached;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const res = await fetch(
        "https://api.nbp.pl/api/exchangerates/rates/a/usd/?format=json",
      );
      const data: any = await res.json();
      cached = data.rates[0].mid;
      // eslint-disable-next-line no-console
      console.log(`[NBP] build rate USD/PLN: ${cached}`);
      return cached as number;
    } catch {
      cached = FALLBACK_RATE;
      return FALLBACK_RATE;
    }
  })();
  return inflight;
}

/** Format a USD amount as zł at the given rate (pl-PL grouping, "zł" symbol). */
export function formatZl(usd: number, rate: number): string {
  return (
    (usd * rate).toLocaleString("pl-PL", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + " zł"
  );
}

// Build-time USD→EUR rate, derived from the same NBP Table A (mid rates):
// eurPerUsd = (PLN per USD) / (PLN per EUR). Baked into the /de pages; the app
// charges EUR at its own current rate, so the site shows these as "ca." values.
let cachedEur: number | null = null;
let inflightEur: Promise<number> | null = null;
const FALLBACK_EUR_RATE = 0.92;

export async function getUsdEurRate(): Promise<number> {
  if (cachedEur != null) return cachedEur;
  if (inflightEur) return inflightEur;
  inflightEur = (async () => {
    try {
      const mid = async (code: string): Promise<number> => {
        const res = await fetch(
          `https://api.nbp.pl/api/exchangerates/rates/a/${code}/?format=json`,
        );
        const data: any = await res.json();
        return data.rates[0].mid;
      };
      const [usdPln, eurPln] = await Promise.all([mid("usd"), mid("eur")]);
      const rate = usdPln / eurPln;
      if (!isFinite(rate) || rate <= 0) throw new Error("bad rate");
      cachedEur = rate;
      // eslint-disable-next-line no-console
      console.log(`[NBP] build rate USD/EUR: ${rate.toFixed(4)}`);
      return rate;
    } catch {
      cachedEur = FALLBACK_EUR_RATE;
      return FALLBACK_EUR_RATE;
    }
  })();
  return inflightEur;
}

/** Format a USD amount as euro at the given rate, German style: "9,49 €". */
export function formatEur(usd: number, rate: number): string {
  return (
    (usd * rate).toLocaleString("de-DE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + " €"
  );
}
