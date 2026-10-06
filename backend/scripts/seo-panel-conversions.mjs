#!/usr/bin/env node
/**
 * Raportowanie konwersji (realnych zakupów) InkMagnet do seo-panelu.
 *
 * Dlaczego to istnieje:
 * seo-panel NIGDY nie bierze konwersji z GA4 — `ga4.service.ts` ma wprost
 * „NEVER write conversions/revenue from GA4 — webhooks only" i zostawia te
 * pola puste. Jedynym źródłem prawdy jest webhook /api/webhook/conversion.
 * Kto go nie woła, ten ma w panelu zero, choćby sprzedawał codziennie —
 * i dokładnie dlatego pierwsze zamówienie inkmagnet.com (12.09.2026) nie
 * pokazało się w zakładce Konwersje, mimo że GA4 zbierało sesje od miesięcy.
 *
 * Dlaczego dane bierzemy z tabeli `Project`, a nie ze Stripe'a:
 * `Project` jest tu pełną księgą zamówień — trzyma `paymentStatus`, `paidAt`
 * i cenę, i wypełnia ją ZARÓWNO webhook Stripe'a (routes/webhooks.ts), JAK
 * I Google Play (routes/playBilling.ts). Odpytywanie samego Stripe'a gubiłoby
 * zakupy z aplikacji mobilnej — ten sam błąd, który na matury-online.pl przez
 * kilka dni ukrywał całą sprzedaż drugiej marki.
 *
 * Co jest odsiewane:
 *  1. Konto ADMIN_EMAIL. To nie jest kosmetyka — `stripeFor()` w
 *     routes/projects.ts daje adminowi klucze STRIPE_SECRET_KEY_TEST, więc
 *     KAŻDY jego zakup jest płatnością testową. Bez tego filtra panel
 *     pokazałby 26 fikcyjnych zamówień z sierpnia i września 2026.
 *  2. Zakupy Google Play oznaczone `isTest` (licencje testerskie z Play
 *     Console — realnych pieniędzy nie ma, a Project i tak idzie w PAID).
 *
 * Dlaczego wysyłamy sumę dnia, a nie pojedyncze zdarzenia:
 * endpoint panelu robi upsert po (integrationId, date) i NADPISUJE wartość.
 * Wysłanie „1" per płatność cofałoby licznik przy drugiej transakcji tego
 * samego dnia. Sumy są idempotentne — skrypt można puścić ponownie.
 *
 * Doba liczona wg Europe/Warsaw, bo taką strefę ma property GA4 w panelu.
 *
 * Waluta: panel liczy WYŁĄCZNIE w złotówkach (frontend formatuje „zł" na
 * sztywno). InkMagnet sprzedaje w USD, więc kwoty przeliczamy:
 *  - zamówienie w PLN → kurs zapisany przy checkoucie (`exchangeRate`),
 *    czyli dokładnie tyle, ile klient zobaczył na Stripie;
 *  - zamówienie w USD → kurs średni NBP (tabela A) z DNIA PŁATNOŚCI, nie
 *    dzisiejszy — inaczej backfill sprzed miesiąca dawałby co przebieg inną
 *    kwotę i wykres przychodu potrafiłby się sam przepisać.
 *
 * Użycie:
 *   node --env-file=.env scripts/seo-panel-conversions.mjs
 *       → domyślnie dzisiaj + wczoraj (wczoraj domykamy na wypadek płatności
 *         tuż przed północą i opóźnionych webhooków)
 *   node --env-file=.env scripts/seo-panel-conversions.mjs --date=2026-09-12
 *   node --env-file=.env scripts/seo-panel-conversions.mjs --from=2026-08-01 --to=2026-09-12
 *   ... --dry-run   → tylko wypisz, nic nie wysyłaj
 */

import { PrismaClient } from "@prisma/client";

const PANEL_URL =
  process.env.SEO_PANEL_WEBHOOK_URL ||
  "https://seo.torweb.pl/api/webhook/conversion";
const PANEL_KEY = process.env.SEO_PANEL_API_KEY;
const INTEGRATION_ID = process.env.SEO_PANEL_INTEGRATION_ID;

/** Konta, których płatności nie są sprzedażą (patrz nagłówek, punkt 1). */
const EXCLUDED_EMAILS = new Set(
  [process.env.ADMIN_EMAIL, ...(process.env.SEO_PANEL_EXCLUDED_EMAILS || "").split(",")]
    .map((e) => (e || "").trim().toLowerCase())
    .filter(Boolean),
);

const args = process.argv.slice(2);
const DRY = args.includes("--dry-run");
const argVal = (name) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=")[1] : null;
};

function fail(msg) {
  console.error(`seo-panel-conversions: ${msg}`);
  process.exit(1);
}

if (!DRY) {
  if (!PANEL_KEY) fail("brak SEO_PANEL_API_KEY w .env");
  if (!INTEGRATION_ID) fail("brak SEO_PANEL_INTEGRATION_ID w .env");
}
if (EXCLUDED_EMAILS.size === 0) {
  console.error(
    "UWAGA: brak ADMIN_EMAIL — testowe zakupy admina trafią do panelu jako sprzedaż",
  );
}

// ─── Kalendarz w strefie Europe/Warsaw ──────────────────────────────────

const WARSAW = "Europe/Warsaw";

function warsawDayString(date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: WARSAW,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * Offset strefy w minutach dla danej chwili (uwzględnia czas letni).
 *
 * `hourCycle: "h23"` jest tu istotne, a nie kosmetyczne: przy `hour12: false`
 * Intl formatuje północ jako "24:00:00", co `new Date()` czyta jako następny
 * dzień — offset wychodzi o 24 h za duży i cała doba przesuwa się o jeden
 * dzień. (Ten sam błąd naprawiono wcześniej w bliźniaczym skrypcie
 * matury-online.pl.)
 */
function zonedParts(date, timeZone) {
  const s = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hourCycle: "h23",
  }).format(date);
  return new Date(s.replace(/(\d+)\/(\d+)\/(\d+), /, "$3-$1-$2T") + "Z");
}

function warsawOffsetMinutes(date) {
  return (zonedParts(date, WARSAW) - zonedParts(date, "UTC")) / 60000;
}

/** Północ danego dnia warszawskiego, wyrażona jako moment UTC. */
function warsawMidnight(dayStr) {
  const naive = new Date(`${dayStr}T00:00:00Z`);
  return new Date(naive.getTime() - warsawOffsetMinutes(naive) * 60000);
}

/**
 * Zakres [start, koniec) danego dnia warszawskiego. Koniec to północ
 * NASTĘPNEGO dnia, a nie start + 24 h — w weekendy zmiany czasu doba ma
 * 23 albo 25 godzin i sztywne 24 h gubiłoby lub dublowało godzinę płatności.
 */
function warsawDayRange(dayStr) {
  return { gte: warsawMidnight(dayStr), lt: warsawMidnight(addDays(dayStr, 1)) };
}

function addDays(dayStr, n) {
  const d = new Date(`${dayStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return warsawDayString(d);
}

// ─── Kurs USD/PLN ───────────────────────────────────────────────────────

const rateCache = new Map();

/**
 * Kurs średni NBP (tabela A) obowiązujący danego dnia. NBP nie publikuje
 * tabel w weekendy i święta — wtedy cofamy się do ostatniej opublikowanej
 * (tak samo, jak księguje się przewalutowanie), maksymalnie 10 dni wstecz.
 */
async function usdPlnRate(dayStr) {
  if (rateCache.has(dayStr)) return rateCache.get(dayStr);

  let probe = dayStr;
  for (let i = 0; i < 10; i++) {
    const res = await fetch(
      `https://api.nbp.pl/api/exchangerates/rates/a/usd/${probe}/?format=json`,
      { signal: AbortSignal.timeout(10000) },
    );
    if (res.ok) {
      const data = await res.json();
      const rate = data.rates[0].mid;
      rateCache.set(dayStr, rate);
      return rate;
    }
    if (res.status !== 404) throw new Error(`NBP HTTP ${res.status} dla ${probe}`);
    probe = addDays(probe, -1);
  }
  throw new Error(`NBP: brak kursu USD dla ${dayStr} i 10 dni wstecz`);
}

// ─── Zamówienia ─────────────────────────────────────────────────────────

const prisma = new PrismaClient();

async function summarizeDay({ gte, lt }, dayStr) {
  const rows = await prisma.project.findMany({
    where: { paymentStatus: "PAID", paidAt: { gte, lt } },
    select: {
      id: true,
      priceUsdCents: true,
      currency: true,
      exchangeRate: true,
      user: { select: { email: true } },
    },
  });

  // Licencje testerskie Google Play — Project jest PAID, pieniędzy nie ma.
  const testPlayIds = new Set(
    (
      await prisma.playPurchase.findMany({
        where: { isTest: true, projectId: { in: rows.map((r) => r.id) } },
        select: { projectId: true },
      })
    ).map((p) => p.projectId),
  );

  let orders = 0;
  let grosze = 0;
  let skipped = 0;

  for (const r of rows) {
    const email = (r.user?.email || "").toLowerCase();
    if (EXCLUDED_EMAILS.has(email) || testPlayIds.has(r.id)) {
      skipped += 1;
      continue;
    }
    const usdCents = r.priceUsdCents ?? 0;
    if (usdCents <= 0) {
      skipped += 1;
      continue;
    }

    const rate =
      r.currency === "pln" && r.exchangeRate
        ? r.exchangeRate
        : await usdPlnRate(dayStr);

    orders += 1;
    grosze += Math.round(usdCents * rate);
  }

  return { orders, revenue: grosze / 100, scanned: rows.length, skipped };
}

async function pushToPanel(day, orders, revenue) {
  const res = await fetch(PANEL_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      apiKey: PANEL_KEY,
      integrationId: INTEGRATION_ID,
      date: day,
      orders,
      revenue,
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`panel ${res.status}: ${text}`);
  return text;
}

// ─── Główna pętla ───────────────────────────────────────────────────────

function daysToProcess() {
  const single = argVal("date");
  if (single) return [single];

  const from = argVal("from");
  const to = argVal("to");
  if (from && to) {
    const days = [];
    let d = from;
    for (let guard = 0; d <= to && guard < 1000; guard++) {
      days.push(d);
      d = addDays(d, 1);
    }
    return days;
  }

  const today = warsawDayString(new Date());
  return [addDays(today, -1), today];
}

const days = daysToProcess();
let failures = 0;

try {
  for (const day of days) {
    try {
      const { orders, revenue, scanned, skipped } = await summarizeDay(
        warsawDayRange(day),
        day,
      );

      if (DRY) {
        console.log(
          `inkmagnet.com ${day}: orders=${orders} revenue=${revenue} ` +
            `(dry-run, ${scanned} PAID w bazie, ${skipped} odsianych)`,
        );
        continue;
      }

      await pushToPanel(day, orders, revenue);
      console.log(
        `inkmagnet.com ${day}: orders=${orders} revenue=${revenue} -> panel OK`,
      );
    } catch (e) {
      failures += 1;
      console.error(`inkmagnet.com ${day}: BLAD ${e.message}`);
    }
  }
} finally {
  await prisma.$disconnect();
}

if (failures > 0) process.exit(1);
