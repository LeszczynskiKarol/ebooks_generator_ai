// Price formatting in the user's currency. Base prices are USD cents; the
// Polish UI shows and charges zł, the German UI €, both converted at the live
// NBP rate (fetched from the backend, cached). The backend converts with the
// same rate when the order is placed, so what is shown is what is charged.
import { useEffect, useState } from "react";
import api from "@/lib/api";
import { useLangStore, type AppLang } from "@/lib/i18n";

export type Currency = "usd" | "pln" | "eur";
type Rates = { pln: number; eur: number };

const FALLBACK: Rates = { pln: 4.05, eur: 0.92 };
let cached: Rates | null = null;
let inflight: Promise<Rates> | null = null;

function fetchRates(): Promise<Rates> {
  if (cached) return Promise.resolve(cached);
  if (inflight) return inflight;
  inflight = api
    .get("/exchange-rate")
    .then(({ data }) => {
      const d = data?.data ?? {};
      cached = {
        pln: d.rates?.pln ?? d.rate ?? FALLBACK.pln,
        eur: d.rates?.eur ?? FALLBACK.eur,
      };
      return cached;
    })
    .catch(() => FALLBACK)
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/** The currency that goes with a panel language. */
export function currencyForLang(lang: AppLang): Currency {
  return lang === "pl" ? "pln" : lang === "de" ? "eur" : "usd";
}

export function useMoney() {
  const lang = useLangStore((s) => s.lang);
  const [rates, setRates] = useState<Rates | null>(cached);

  useEffect(() => {
    if (cached) {
      setRates(cached);
      return;
    }
    fetchRates().then(setRates);
  }, []);

  const currency = currencyForLang(lang);
  const r = rates ?? FALLBACK;

  /** Format a USD-cents amount in the current currency (zł for PL, € for DE, $ otherwise). */
  const formatUsdCents = (cents: number): string => {
    if (currency === "pln") {
      const zl = Math.round(cents * r.pln) / 100;
      return zl.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " zł";
    }
    if (currency === "eur") {
      const eur = Math.round(cents * r.eur) / 100;
      return eur.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
    }
    return "$" + (cents / 100).toFixed(2);
  };

  return {
    /** Stripe currency to send with checkout. */
    currency,
    rate: currency === "pln" ? r.pln : currency === "eur" ? r.eur : 1,
    ready: rates != null,
    formatUsdCents,
  };
}
