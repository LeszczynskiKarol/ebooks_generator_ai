// USD→PLN exchange rate from NBP Table A (mid rate), cached in-memory.
// Base currency is USD; PLN amounts are derived at the current NBP rate.
// Mirrors the proven mechanism from smart-edu.ai.

interface ExchangeRateCache {
  rate: number;
  fetchedAt: number;
  tableNo: string;
  effectiveDate: string;
}

let cache: ExchangeRateCache | null = null;
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
const FALLBACK_RATE = 4.05;

/**
 * Current USD/PLN mid rate from NBP Table A. Cached 15 min; on failure reuses
 * stale cache (extended 5 min) or falls back to a hardcoded rate.
 */
export async function getUsdPlnRate(): Promise<ExchangeRateCache> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache;
  }

  try {
    const res = await fetch(
      "https://api.nbp.pl/api/exchangerates/rates/a/usd/?format=json",
      { signal: AbortSignal.timeout(5000) },
    );
    if (!res.ok) throw new Error(`NBP HTTP ${res.status}`);
    const data: any = await res.json();
    const rateData = data.rates[0];
    cache = {
      rate: rateData.mid,
      fetchedAt: Date.now(),
      tableNo: `${data.table}/${rateData.no}`,
      effectiveDate: rateData.effectiveDate,
    };
    console.log(`[NBP] USD/PLN rate: ${cache.rate} (${cache.effectiveDate})`);
    return cache;
  } catch (error: any) {
    console.error(`[NBP] Failed to fetch rate: ${error.message}`);
    if (cache) {
      console.log(`[NBP] Using stale cache: ${cache.rate}`);
      cache.fetchedAt = Date.now() - CACHE_TTL_MS + 5 * 60 * 1000; // retry in ~5 min
      return cache;
    }
    console.warn(`[NBP] Using fallback rate: ${FALLBACK_RATE}`);
    cache = {
      rate: FALLBACK_RATE,
      fetchedAt: Date.now() - CACHE_TTL_MS + 2 * 60 * 1000, // retry in ~2 min
      tableNo: "FALLBACK",
      effectiveDate: new Date().toISOString().slice(0, 10),
    };
    return cache;
  }
}

/** Convert USD cents → PLN grosze (minor units) at the current NBP rate. */
export async function usdCentsToPlnGrosze(usdCents: number): Promise<number> {
  const { rate } = await getUsdPlnRate();
  return Math.round(usdCents * rate);
}

// ── USD→EUR ──
// NBP publishes PLN mid rates for USD and EUR; EUR per 1 USD is their ratio.
// Same caching rules as the PLN rate above.
let eurCache: ExchangeRateCache | null = null;
const FALLBACK_EUR_RATE = 0.92;

export async function getUsdEurRate(): Promise<ExchangeRateCache> {
  if (eurCache && Date.now() - eurCache.fetchedAt < CACHE_TTL_MS) return eurCache;
  try {
    const [usd, res] = await Promise.all([
      getUsdPlnRate(),
      fetch("https://api.nbp.pl/api/exchangerates/rates/a/eur/?format=json", {
        signal: AbortSignal.timeout(5000),
      }),
    ]);
    if (!res.ok) throw new Error(`NBP HTTP ${res.status}`);
    const data: any = await res.json();
    const eurPln = data.rates[0].mid;
    // a fallback USD rate would give a wrong cross rate — do not build on it
    if (usd.tableNo === "FALLBACK" || !eurPln) throw new Error("no live USD/PLN rate");
    eurCache = {
      rate: Math.round((usd.rate / eurPln) * 10000) / 10000,
      fetchedAt: Date.now(),
      tableNo: `${data.table}/${data.rates[0].no}`,
      effectiveDate: data.rates[0].effectiveDate,
    };
    console.log(`[NBP] USD/EUR rate: ${eurCache.rate} (${eurCache.effectiveDate})`);
    return eurCache;
  } catch (error: any) {
    console.error(`[NBP] Failed to fetch EUR rate: ${error.message}`);
    if (eurCache) {
      eurCache.fetchedAt = Date.now() - CACHE_TTL_MS + 5 * 60 * 1000; // retry in ~5 min
      return eurCache;
    }
    eurCache = {
      rate: FALLBACK_EUR_RATE,
      fetchedAt: Date.now() - CACHE_TTL_MS + 2 * 60 * 1000, // retry in ~2 min
      tableNo: "FALLBACK",
      effectiveDate: new Date().toISOString().slice(0, 10),
    };
    return eurCache;
  }
}
