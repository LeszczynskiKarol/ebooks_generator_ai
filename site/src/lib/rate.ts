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
