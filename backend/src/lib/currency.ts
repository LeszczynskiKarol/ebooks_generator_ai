// Checkout currencies. Base prices are USD cents; the Polish interface charges
// PLN and the German one EUR, both converted from the USD price at the current
// NBP rate when the order is placed. `Project.exchangeRate` stores that rate
// (units of the charged currency per 1 USD), so the charged amount can always
// be reconstructed exactly: minor = round(priceUsdCents × exchangeRate).
import { getUsdEurRate, getUsdPlnRate } from "../services/exchangeRateService";

export type Currency = "usd" | "pln" | "eur";

export function normCurrency(v: unknown): Currency {
  const c = typeof v === "string" ? v.toLowerCase() : "";
  return c === "pln" || c === "eur" ? c : "usd";
}

/** Rate to convert USD → the given currency right now; null for USD itself. */
export async function currentRate(currency: Currency): Promise<number | null> {
  if (currency === "pln") return (await getUsdPlnRate()).rate;
  if (currency === "eur") return (await getUsdEurRate()).rate;
  return null;
}

/** Amount in the charged currency's minor units (grosze / euro cents / cents). */
export function chargedMinor(priceUsdCents: number, currency: string, rate: number | null | undefined): number {
  return normCurrency(currency) !== "usd" && rate ? Math.round(priceUsdCents * rate) : priceUsdCents;
}

/** "56,02 zł" / "9,49 €" / "$14.99" from minor units. */
export function formatMinor(minor: number, currency: string): string {
  const c = normCurrency(currency);
  const amount = minor / 100;
  if (c === "pln")
    return amount.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " zł";
  if (c === "eur")
    return amount.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
  return "$" + amount.toFixed(2);
}

/** The price of a book exactly as checkout charges it. */
export function formatCharged(p: { priceUsdCents: number | null; currency: string; exchangeRate: number | null }): string {
  const cents = p.priceUsdCents ?? 0;
  const c = normCurrency(p.currency);
  // a non-USD order without a stored rate (legacy) is shown in USD, never guessed
  if (c !== "usd" && !p.exchangeRate) return formatMinor(cents, "usd");
  return formatMinor(chargedMinor(cents, c, p.exchangeRate), c);
}

/**
 * Stripe payment methods per currency — only what works for it:
 * BLIK is PLN-only, Klarna is offered for EUR (German interface) only.
 * Apple Pay / Google Pay ride on "card".
 */
export function paymentMethodTypes(currency: string): string[] {
  const c = normCurrency(currency);
  if (c === "pln") return ["card", "blik"];
  if (c === "eur") return ["card", "klarna"];
  return ["card"];
}

/** Line-item description in the language that goes with the currency. */
export function lineDescription(currency: string, pages: number): string {
  const c = normCurrency(currency);
  if (c === "pln") return `Profesjonalny eBook (${pages} stron)`;
  if (c === "eur") return `Professionelles E-Book (${pages} Seiten)`;
  return `${pages}-page professional eBook`;
}
