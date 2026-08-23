// CI: generuje BRAKUJĄCE okładki bloga (wzorzec sitario gen-missing-covers,
// 2026-08-23). Dla każdego md w src/content/blog, którego plik heroImage nie
// istnieje, a frontmatter ma coverPrompt: zdjęcie z Replicate (model/raw/sufiks
// z backend/shared/cover-style.json — wspólne z backendowym /api/admin/blog/hero;
// martwa natura świata druku wg DESIGN-BOOK §4-6, recenzja Sonneta) + kompozycja:
// scrim, logo InkMagnet (otwarta książka), eyebrow, tytuł w Interze
// (wektorowo przez fontkit — pełne polskie znaki), ostatnia linia w gradiencie.
// Para PL+EN ma IDENTYCZNY coverPrompt → jedno zdjęcie, dwa panele.
// Wynik: src/assets/blog/<slug>-hero.jpg (astro:assets → hero + og:image).
// Wymaga: FLUX_API (lub REPLICATE_API_TOKEN) w env — tylko gdy są braki.
// Uruchamiaj z site/. Fail-closed: brak okładki => exit 1 => deploy stoi.
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const fontkit = require("fontkit");
import sharp from "sharp";
import { readFileSync, readdirSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";

const W = 1536, H = 1024; // 3:2 — format hero z DESIGN-BOOK §5
const F = {
  6: { L: fontkit.openSync("_fonttools/inter-latin-600.woff2"), E: fontkit.openSync("_fonttools/inter-ext-600.woff2") },
  7: { L: fontkit.openSync("_fonttools/inter-latin-700.woff2"), E: fontkit.openSync("_fonttools/inter-ext-700.woff2") },
};
const upm = F[7].L.unitsPerEm, CAP = F[7].L.capHeight / upm;
const pf = (cp, w) => { const g = F[w].L.glyphForCodePoint(cp); return (g && g.id !== 0) ? g : F[w].E.glyphForCodePoint(cp); };
const SP = (w) => F[w].L.glyphForCodePoint(32).advanceWidth;
const meas = (str, size, w = 7, tr = 0) => { const s = size / upm; let x = 0; for (const ch of [...str]) { const cp = ch.codePointAt(0); x += (cp === 32 ? SP(w) : pf(cp, w).advanceWidth) + tr / s; } return x * s; };
function T(str, size, color, x0, yb, { w = 7, tr = 0 } = {}) {
  const s = size / upm; let x = 0, inner = "";
  for (const ch of [...str]) {
    const cp = ch.codePointAt(0);
    if (cp === 32) { x += SP(w) + tr / s; continue; }
    const g = pf(cp, w);
    inner += `<path d="${g.path.toSVG()}" transform="translate(${x},0)"/>`;
    x += g.advanceWidth + tr / s;
  }
  return `<g transform="translate(${x0},${yb}) scale(${s},${-s})" fill="${color}">${inner}</g>`;
}
function wrap(str, size, maxW, w = 7) {
  const words = str.split(" "); const lines = []; let cur = "";
  for (const wd of words) { const t = cur ? cur + " " + wd : wd; if (meas(t, size, w) > maxW && cur) { lines.push(cur); cur = wd; } else cur = t; }
  if (cur) lines.push(cur);
  return lines;
}
function shorten(t) { let i = t.indexOf("? "); if (i > 0) return t.slice(0, i + 1); i = t.search(/[:–—] /); if (i > 0) return t.slice(0, i).trim(); return t; }

// Logo: otwarta książka (kontur jak BookOpen z aplikacji) w kwadracie
// z gradientem indygo + wordmark.
const sq = { x: 62, y: 58, s: 52 }, lcy = sq.y + sq.s / 2;
const bookScale = (sq.s - 22) / 24;
const logo = `<rect x="${sq.x}" y="${sq.y}" width="${sq.s}" height="${sq.s}" rx="14" fill="url(#brand)"/>` +
  `<g transform="translate(${sq.x + 11},${sq.y + 11}) scale(${bookScale})" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">` +
  `<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></g>` +
  T("InkMagnet", 30, "#f4f3fd", sq.x + sq.s + 20, lcy + 30 * CAP / 2);

async function compose(photoBuf, { eyebrow, title, out }) {
  const M = 76, tSize = 64, lh = 78;
  const lines = wrap(shorten(title), tSize, 740);
  const bottom = H - 108, top = bottom - (lines.length - 1) * lh;
  const ruleY = top - 118;
  let tt = "";
  lines.forEach((ln, i) => { tt += T(ln, tSize, i === lines.length - 1 ? "url(#brand)" : "#ffffff", M, top + i * lh); });
  // Kropki NAD linią akcentu — pod nią przy 2-3 liniach tytułu wchodziły w tekst.
  let dots = ""; for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) dots += `<circle cx="${M + 5 + c * 19}" cy="${ruleY - 92 + r * 19}" r="2.9" fill="#818cf8" fill-opacity="0.6"/>`;
  const overlay = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg"><defs>
    <linearGradient id="brand" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#818cf8"/><stop offset="100%" stop-color="#a78bfa"/></linearGradient>
    <linearGradient id="scrim" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#060512" stop-opacity="0.96"/><stop offset="40%" stop-color="#060512" stop-opacity="0.84"/><stop offset="68%" stop-color="#060512" stop-opacity="0.24"/><stop offset="100%" stop-color="#060512" stop-opacity="0"/></linearGradient>
    <linearGradient id="bot" x1="0" y1="0" x2="0" y2="1"><stop offset="55%" stop-color="#060512" stop-opacity="0"/><stop offset="100%" stop-color="#060512" stop-opacity="0.5"/></linearGradient></defs>
    <rect width="${W}" height="${H}" fill="url(#scrim)"/><rect width="${W}" height="${H}" fill="url(#bot)"/>${logo}
    <rect x="${M}" y="${ruleY}" width="58" height="5" rx="2.5" fill="url(#brand)"/>${T(eyebrow, 23, "#c4b5fd", M, ruleY + 56, { w: 6, tr: 4 })}${tt}${dots}</svg>`;
  const bg = await sharp(photoBuf).resize(W, H, { fit: "cover" }).modulate({ saturation: 0.97 }).toBuffer();
  await sharp(bg).composite([{ input: Buffer.from(overlay) }]).jpeg({ quality: 86, mozjpeg: true }).toFile(out);
}

// JEDNO źródło prawdy dla parametrów FLUX, sufiksu stylu i kryteriów recenzji —
// współdzielone z backendowym /api/admin/blog/hero, żeby oba flow szły równo.
const CFG = JSON.parse(readFileSync("../backend/shared/cover-style.json", "utf8"));
const STYLE_TAIL = CFG.style_tail;

const sleep = (ms) => new Promise((s) => setTimeout(s, ms));
const API = `https://api.replicate.com/v1/models/${CFG.model}/predictions`;

// Backoff jak w sitario — Replicate umie odrzucić 429 zaraz po poprzedniej
// predykcji; bez tego job padał na drugim zdjęciu i braki rosły z dnia na dzień.
async function replicateCreate(prompt, token) {
  const body = JSON.stringify({ input: { prompt, aspect_ratio: CFG.aspect_ratio, raw: CFG.raw, output_format: CFG.output_format, safety_tolerance: CFG.safety_tolerance } });
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(API, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Prefer: "wait" },
      body,
    });
    const txt = await res.text();
    if (res.ok) return JSON.parse(txt);
    if ((res.status !== 429 && res.status < 500) || attempt >= 6) throw new Error(`replicate HTTP ${res.status}: ${txt.slice(0, 300)}`);
    const wait = Number(res.headers.get("retry-after")) * 1000 || Math.min(60_000, 5000 * 2 ** (attempt - 1));
    console.log(`  HTTP ${res.status} — czekam ${Math.round(wait / 1000)}s, ponawiam (próba ${attempt}/6)`);
    await sleep(wait);
  }
}

async function genPhoto(prompt, token) {
  const h = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  let r = await replicateCreate(prompt, token);
  for (let i = 0; i < 30 && ["starting", "processing"].includes(r.status); i++) { await sleep(5000); r = await fetch(r.urls.get, { headers: h }).then((x) => x.json()); }
  const out = Array.isArray(r.output) ? r.output[0] : r.output;
  if (r.status !== "succeeded" || !out) throw new Error(`replicate ${r.status}: ${JSON.stringify(r.error ?? r.detail ?? r).slice(0, 300)}`);
  return Buffer.from(await (await fetch(out)).arrayBuffer());
}

// Recenzja surowego zdjęcia przez Sonneta (wizja) — akceptacja PRZED nałożeniem
// panelu. Kryteria w cover-style.json (wspólne z backendem). Zwraca {accept, reason}.
async function reviewPhoto(photoBuf, scenePrompt) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("BRAK ANTHROPIC_API_KEY — recenzja okładek jest obowiązkowa");
  // Recenzent nie potrzebuje pełnej rozdzielczości ultra — a pełny jpg umie
  // przekroczyć limit obrazu API (puste content w odpowiedzi). 1024 px starcza.
  const small = await sharp(photoBuf).resize(1024).jpeg({ quality: 80 }).toBuffer();
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
    body: JSON.stringify({
      model: CFG.review.model,
      max_tokens: 500,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: "image/jpeg", data: small.toString("base64") } },
          { type: "text", text: `${CFG.review.criteria}\n\nZadany prompt sceny: "${scenePrompt}"\n\nOdpowiedz WYŁĄCZNIE JSON-em: {"accept": true|false, "reason": "maksymalnie 10 słów"}` },
        ],
      }],
    }),
  });
  if (!res.ok) throw new Error(`anthropic HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const txt = (data.content || []).map((c) => c.text || "").join(" ").trim();
  // Parser odporny na ucięty JSON (stop=max_tokens): verdykt czytamy regexem,
  // reason jest tylko diagnostyczny. Ucięta akceptacja NIE może być odrzutem.
  const acc = txt.match(/"accept"\s*:\s*(true|false)/);
  if (!acc) return { accept: false, reason: `brak werdyktu w odpowiedzi (stop=${data.stop_reason}): ${txt.slice(0, 120)}` };
  const reason = (txt.match(/"reason"\s*:\s*"([^"]*)/) || [])[1] || "";
  return { accept: acc[1] === "true", reason };
}

// Generuj + recenzuj w pętli (max_attempts z konfiguracji). Każda próba to nowy
// seed FLUX-a; wszystkie odrzucone → wyjątek (fail-closed jak reszta skryptu).
async function genApprovedPhoto(prompt, scenePrompt, token) {
  let lastReason = "";
  for (let a = 1; a <= CFG.review.max_attempts; a++) {
    if (a > 1) console.log(`  ponawiam generację (próba ${a}/${CFG.review.max_attempts}) — powód odrzutu: ${lastReason}`);
    const photo = await genPhoto(prompt, token);
    const verdict = await reviewPhoto(photo, scenePrompt);
    if (verdict.accept) { console.log(`  recenzja Sonneta: OK${verdict.reason ? ` (${verdict.reason})` : ""}`); return photo; }
    lastReason = verdict.reason;
  }
  throw new Error(`recenzent odrzucił ${CFG.review.max_attempts}× — ostatni powód: ${lastReason}`);
}

function front(txt) {
  // CRLF z checkoutu na Windows łamie ^---\n — normalizuj, inaczej wpis jest
  // po cichu pomijany (brak heroImage w parsie => continue).
  txt = txt.replace(/\r\n/g, "\n");
  const fm = (txt.match(/^---\n([\s\S]*?)\n---/) || [])[1] || "";
  const g = (k) => {
    const m = fm.match(new RegExp(`^${k}:\\s*(.+)$`, "m"));
    if (!m) return "";
    return m[1].trim().replace(/^["']|["']$/g, "");
  };
  return { title: g("title"), coverPrompt: g("coverPrompt"), eyebrow: g("eyebrow"), heroImage: g("heroImage") };
}

// ── main ──────────────────────────────────────────────────────────────────
mkdirSync("src/assets/blog", { recursive: true });
const missing = [];
for (const file of readdirSync("src/content/blog").filter((f) => f.endsWith(".md"))) {
  const slug = file.replace(/\.md$/, "");
  const fm = front(readFileSync(path.join("src/content/blog", file), "utf8"));
  if (!fm.heroImage) continue; // wpis świadomie bez hero
  const asset = path.join("src/assets/blog", path.basename(fm.heroImage));
  if (existsSync(asset)) continue; // stare wpisy z ręcznie zrobionymi hero
  if (!fm.coverPrompt) { console.error(`POMIJAM ${slug}: heroImage wskazuje nieistniejący plik, a brak coverPrompt`); continue; }
  missing.push({ slug, out: asset, ...fm });
}
if (!missing.length) { console.log("Wszystkie okładki istnieją — nic do zrobienia."); process.exit(0); }

const token = process.env.FLUX_API || process.env.REPLICATE_API_TOKEN;
if (!token) { console.error(`BRAK FLUX_API, a brakuje okładek: ${missing.map((m) => m.slug).join(", ")}`); process.exit(1); }

// Para PL+EN dzieli coverPrompt (playbook blog-auto) → jedno zdjęcie na parę.
const groups = new Map();
for (const m of missing) {
  if (!m.title) { console.error(`POMIJAM ${m.slug}: brak title`); continue; }
  const key = m.coverPrompt;
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(m);
}

const failed = [];
let calls = 0;
for (const items of groups.values()) {
  const label = items.map((i) => i.slug).join(" + ");
  try {
    console.log(`generuję zdjęcie dla: ${label} …`);
    if (calls++) await sleep(5000);
    const photo = await genApprovedPhoto(items[0].coverPrompt + STYLE_TAIL, items[0].coverPrompt, token);
    for (const it of items) {
      await compose(photo, { eyebrow: it.eyebrow || "INKMAGNET", title: it.title, out: it.out });
      console.log(`  ✓ ${it.slug}`);
    }
  } catch (e) {
    console.error(`  ✗ ${label}: ${e.message}`);
    failed.push(...items.map((i) => i.slug));
  }
}

console.log(`Wygenerowano ${missing.length - failed.length}/${missing.length} okładek w ${calls} wywołaniach Replicate.`);
if (failed.length) {
  // Fail-closed: udane okładki i tak wracają do repo (krok commit ma if: always()),
  // ale deploy stoi — wpis bez okładki wywaliłby zresztą build na astro:assets.
  console.error(`NIE UDAŁO SIĘ: ${failed.join(", ")} — kolejny run dogoni braki.`);
  process.exit(1);
}
