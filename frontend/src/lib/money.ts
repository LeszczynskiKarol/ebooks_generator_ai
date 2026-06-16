// Price formatting in the user's currency. Base prices are USD cents; for the
// Polish UI we convert to zł at the live NBP rate (fetched from the backend,
// cached). "zł" symbol, pl-PL grouping.
import { useEffect, useState } from "react";
import api from "@/lib/api";
import { useLangStore } from "@/lib/i18n";

const FALLBACK_RATE = 4.05;
let cachedRate: number | null = null;
let inflight: Promise<number> | null = null;

function fetchRate(): Promise<number> {
  if (cachedRate != null) return Promise.resolve(cachedRate);
  if (inflight) return inflight;
  inflight = api
    .get("/exchange-rate")
    .then(({ data }) => {
      cachedRate = data?.data?.rate ?? FALLBACK_RATE;
      return cachedRate as number;
    })
    .catch(() => FALLBACK_RATE)
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function useMoney() {
  const lang = useLangStore((s) => s.lang);
  const [rate, setRate] = useState<number | null>(cachedRate);

  useEffect(() => {
    if (cachedRate != null) {
      setRate(cachedRate);
      return;
    }
    fetchRate().then(setRate);
  }, []);

  const pln = lang === "pl";
  const r = rate ?? FALLBACK_RATE;

  /** Format a USD-cents amount in the current currency (zł for PL, $ otherwise). */
  const formatUsdCents = (cents: number): string => {
    if (pln) {
      const zl = Math.round(cents * r) / 100;
      return (
        zl.toLocaleString("pl-PL", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }) + " zł"
      );
    }
    return "$" + (cents / 100).toFixed(2);
  };

  return {
    /** Stripe currency to send with checkout. */
    currency: pln ? "pln" : "usd",
    rate: r,
    ready: rate != null,
    formatUsdCents,
  };
}
