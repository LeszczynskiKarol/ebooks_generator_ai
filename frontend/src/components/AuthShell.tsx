import { ReactNode } from "react";
import { BookOpen, Globe, ImagePlus, Palette, Moon, Sun } from "lucide-react";
import { useThemeStore } from "@/stores/themeStore";
import { useLangStore, type AppLang } from "@/lib/i18n";

// Split-screen auth frame (wzorzec matury-online /auth/login → sitario
// AuthPage → cytado AuthForm, 2026-08-22): lewa kolumna z kartą formularza,
// prawa (lg+) — brandowy panel: gradient + siatka, badge z pulsującą kropką,
// dwuwierszowy nagłówek z akcentem, feature-kafle glass, pasek statystyk.
// Tokeny: fiolet smart-copy (primary #7c3aed) na czerni, gradientowy akcent.

const PANEL_COPY = {
  pl: {
    badge: "Od tematu do gotowego PDF",
    line1: "Twoja książka.",
    line2: "Napisana przez AI.",
    lead: "Research, pisanie, ilustracje i profesjonalny skład — jeden przepływ, od tematu do ebooka gotowego do sprzedaży.",
    features: [
      { title: "Pełne książki 30–200 stron", sub: "Struktura, rozdziały, spis treści" },
      { title: "Research z prawdziwych źródeł", sub: "Fakty i liczby zamiast konfabulacji" },
      { title: "Ilustracje AI w cenie", sub: "Dopasowane do treści i stylu" },
      { title: "Profesjonalny skład PDF", sub: "Style graficzne, formaty A5–A4" },
    ],
    stats: [
      { value: "200", label: "stron maks." },
      { value: "5", label: "stylów graficznych" },
      { value: "8", label: "języków" },
    ],
  },
  en: {
    badge: "From topic to finished PDF",
    line1: "Your book.",
    line2: "Written by AI.",
    lead: "Research, writing, illustrations and professional typesetting — one flow, from topic to a sale-ready ebook.",
    features: [
      { title: "Complete 30–200 page books", sub: "Structure, chapters, table of contents" },
      { title: "Research from real sources", sub: "Facts and numbers, not confabulation" },
      { title: "AI illustrations included", sub: "Matched to your content and style" },
      { title: "Professional PDF typesetting", sub: "Design styles, A5–A4 formats" },
    ],
    stats: [
      { value: "200", label: "pages max" },
      { value: "5", label: "design styles" },
      { value: "8", label: "languages" },
    ],
  },
};

const FEATURE_ICONS = [BookOpen, Globe, ImagePlus, Palette];

export default function AuthShell({ children }: { children: ReactNode }) {
  const { dark, toggle } = useThemeStore();
  const lang = useLangStore((s) => s.lang);
  const setLang = useLangStore((s) => s.setLang);
  const langs: AppLang[] = ["en", "pl"];
  const c = PANEL_COPY[lang] || PANEL_COPY.en;

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors">
      {/* ── Left: form column ── */}
      <div className="flex w-full flex-col lg:w-[46%]">
        <div className="flex items-center justify-between px-6 pt-5 lg:px-10">
          <a href="https://inkmagnet.com" className="inline-flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary-600 to-fuchsia-500 text-white shadow-lg shadow-primary-600/25">
              <BookOpen className="h-5 w-5" />
            </span>
            <span className="font-display text-xl font-bold text-gray-900 dark:text-white">
              InkMagnet
            </span>
          </a>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-0.5 rounded-lg bg-gray-200/70 dark:bg-gray-800/70 p-0.5">
              {langs.map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLang(l)}
                  aria-pressed={lang === l}
                  className={`rounded-md px-2.5 py-1 text-xs font-bold transition-colors ${
                    lang === l
                      ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                      : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                  }`}
                >
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
            <button
              onClick={toggle}
              className="rounded-lg p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
              aria-label="Toggle theme"
            >
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="flex flex-1 items-start justify-center px-4 pb-12 pt-8 sm:items-center sm:pt-0">
          <div className="w-full max-w-md animate-fade-in">{children}</div>
        </div>
      </div>

      {/* ── Right: branded panel (decorative, lg+) ── */}
      <aside
        className="relative hidden flex-1 flex-col justify-center overflow-hidden px-12 lg:flex xl:px-20"
        style={{
          background:
            "radial-gradient(800px 500px at 85% -10%, rgba(217,70,239,.28), transparent 60%), radial-gradient(700px 500px at -10% 110%, rgba(124,58,237,.45), transparent 55%), linear-gradient(160deg, #17111f, #2e1065 45%, #4c1d95)",
        }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
          }}
        />

        <div className="relative max-w-xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-violet-100">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
            {c.badge}
          </span>

          <h2 className="mt-6 font-display text-4xl font-extrabold leading-[1.12] tracking-tight text-white xl:text-[2.9rem]">
            {c.line1}
            <br />
            <span className="bg-gradient-to-r from-primary-300 to-fuchsia-400 bg-clip-text text-transparent">
              {c.line2}
            </span>
          </h2>

          <p className="mt-5 text-lg text-violet-100/90">{c.lead}</p>

          <ul className="mt-8 space-y-3">
            {c.features.map((f, i) => {
              const Icon = FEATURE_ICONS[i] || BookOpen;
              return (
                <li
                  key={f.title}
                  className="flex items-center gap-4 rounded-xl border border-white/15 bg-white/[0.07] px-5 py-3.5 backdrop-blur"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/10 text-fuchsia-300">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-white">{f.title}</span>
                    <span className="block text-sm text-violet-100/70">{f.sub}</span>
                  </span>
                </li>
              );
            })}
          </ul>

          <div className="mt-8 grid grid-cols-3 gap-3">
            {c.stats.map((s) => (
              <div
                key={s.label}
                className="rounded-xl border border-white/15 bg-white/[0.06] px-4 py-4 text-center backdrop-blur"
              >
                <div className="font-display text-2xl font-extrabold text-white">{s.value}</div>
                <div className="mt-0.5 text-xs text-violet-100/70">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
