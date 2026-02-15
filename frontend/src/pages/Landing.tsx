// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BookForge.ai — Landing Page
// React + Tailwind + useThemeStore
// Route: / (no Layout wrapper)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { useThemeStore } from "@/stores/themeStore";
import {
  Search,
  BookOpen,
  Sparkles,
  Palette,
  Package,
  FileText,
  Smartphone,
  Code2,
  ChevronDown,
  Globe,
  Zap,
  Users,
  GraduationCap,
  Rocket,
  BarChart3,
  PenTool,
  Languages,
  Check,
  X,
  Sun,
  Moon,
  ArrowRight,
  Star,
  Menu,
  X as XIcon,
} from "lucide-react";

/* ─── SEO ─── */
function useSEO() {
  useEffect(() => {
    document.title =
      "BookForge.ai — AI Ebook Generator | Create Professional Ebooks with Artificial Intelligence";
    const set = (name: string, content: string) => {
      let el = document.querySelector(
        `meta[name="${name}"]`,
      ) as HTMLMetaElement;
      if (!el) {
        el = document.createElement("meta");
        el.name = name;
        document.head.appendChild(el);
      }
      el.content = content;
    };
    set(
      "description",
      "BookForge.ai is the most advanced AI ebook generator. Create research-backed, publication-quality ebooks with LaTeX typography, real web sources, and professional styling in PDF & EPUB. The AI ebook creator for consultants, educators, and entrepreneurs.",
    );
    set(
      "keywords",
      "AI ebook generator, artificial intelligence ebook creator, AI ebook maker, AI book generator, automated ebook creation, professional ebook generator, AI content creation, ebook publishing tool",
    );
  }, []);
}

/* ─── Scroll reveal ─── */
function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [vis, setVis] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) setVis(true);
      },
      { threshold: 0.08, rootMargin: "0px 0px -40px 0px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${vis ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/* ─── FAQ Item ─── */
function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-gray-200 dark:border-gray-800">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-5 text-left gap-4"
      >
        <span className="text-lg font-medium text-gray-900 dark:text-white">
          {q}
        </span>
        <ChevronDown
          className={`w-5 h-5 text-gray-400 shrink-0 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
        />
      </button>
      <div
        className={`overflow-hidden transition-all duration-400 ${open ? "max-h-96 pb-5" : "max-h-0"}`}
      >
        <p className="text-gray-600 dark:text-gray-400 leading-relaxed">{a}</p>
      </div>
    </div>
  );
}

/* ─── Comparison check/cross ─── */
const Ck = () => <span className="text-emerald-500 font-bold">✓</span>;
const Cr = () => <span className="text-gray-400">✗</span>;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MAIN COMPONENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default function Landing() {
  useSEO();
  const { dark, toggle } = useThemeStore();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  const scrollTo = useCallback((id: string) => {
    setMobileMenu(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 transition-colors">
      {/* ═══════════ NAV ═══════════ */}
      <nav
        className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
          scrolled
            ? "bg-white/80 dark:bg-gray-950/80 backdrop-blur-xl border-b border-gray-200 dark:border-gray-800"
            : "bg-transparent"
        }`}
      >
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link
            to="/"
            className="flex items-center gap-2 text-xl font-bold text-gray-900 dark:text-white"
          >
            <BookOpen className="w-6 h-6 text-primary-600 dark:text-primary-400" />
            BookForge
            <span className="text-primary-600 dark:text-primary-400">.ai</span>
          </Link>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-8">
            <button
              onClick={() => scrollTo("how-it-works")}
              className="text-sm text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
            >
              How It Works
            </button>
            <button
              onClick={() => scrollTo("features")}
              className="text-sm text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
            >
              Features
            </button>
            <button
              onClick={() => scrollTo("pricing")}
              className="text-sm text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
            >
              Pricing
            </button>
            <button
              onClick={() => scrollTo("faq")}
              className="text-sm text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
            >
              FAQ
            </button>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={toggle}
              className="w-9 h-9 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:border-primary-300 dark:hover:border-primary-600 transition-colors"
              aria-label="Toggle theme"
            >
              {dark ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>
            <Link
              to="/auth/login"
              className="hidden md:inline-flex text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
            >
              Log in
            </Link>
            <Link
              to="/auth/register"
              className="hidden md:inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold shadow-lg shadow-primary-600/20 hover:shadow-primary-600/30 transition-all"
            >
              Start Creating
            </Link>
            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileMenu(!mobileMenu)}
              className="md:hidden w-9 h-9 flex items-center justify-center"
            >
              {mobileMenu ? (
                <XIcon className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenu && (
          <div className="md:hidden bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 px-5 py-4 space-y-3">
            <button
              onClick={() => scrollTo("how-it-works")}
              className="block w-full text-left text-sm text-gray-700 dark:text-gray-300 py-2"
            >
              How It Works
            </button>
            <button
              onClick={() => scrollTo("features")}
              className="block w-full text-left text-sm text-gray-700 dark:text-gray-300 py-2"
            >
              Features
            </button>
            <button
              onClick={() => scrollTo("pricing")}
              className="block w-full text-left text-sm text-gray-700 dark:text-gray-300 py-2"
            >
              Pricing
            </button>
            <button
              onClick={() => scrollTo("faq")}
              className="block w-full text-left text-sm text-gray-700 dark:text-gray-300 py-2"
            >
              FAQ
            </button>
            <div className="pt-2 flex gap-3">
              <Link
                to="/auth/login"
                className="flex-1 text-center py-2 text-sm font-medium border border-gray-200 dark:border-gray-700 rounded-lg"
              >
                Log in
              </Link>
              <Link
                to="/auth/register"
                className="flex-1 text-center py-2 text-sm font-semibold bg-primary-600 text-white rounded-lg"
              >
                Start Creating
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* ═══════════ HERO ═══════════ */}
      <header className="relative pt-32 pb-20 md:pt-40 md:pb-28 overflow-hidden">
        {/* Background glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary-500/10 dark:bg-primary-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-primary-600/5 dark:bg-primary-400/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/3" />
        </div>

        <div className="max-w-6xl mx-auto px-5 relative">
          <div className="max-w-3xl mx-auto text-center">
            {/* Badge */}
            <Reveal>
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary-50 dark:bg-primary-950/50 border border-primary-200 dark:border-primary-800 text-sm text-primary-700 dark:text-primary-300 mb-6">
                <Star className="w-3.5 h-3.5" />
                AI Ebook Generator · Research-Backed · Publication Quality
              </div>
            </Reveal>

            {/* Headline */}
            <Reveal delay={100}>
              <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05]">
                Ebooks that read like they had{" "}
                <span className="bg-gradient-to-r from-primary-600 via-primary-500 to-purple-500 bg-clip-text text-transparent">
                  a research team behind them.
                </span>
              </h1>
            </Reveal>

            {/* Subhead */}
            <Reveal delay={200}>
              <p className="mt-6 text-lg md:text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto leading-relaxed">
                BookForge.ai is the AI ebook maker that scrapes real sources,
                generates LaTeX-typeset content, and delivers publication-ready
                PDF&nbsp;&amp;&nbsp;EPUB — in&nbsp;8&nbsp;languages.
              </p>
            </Reveal>

            {/* CTA buttons */}
            <Reveal delay={300}>
              <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
                <Link
                  to="/auth/register"
                  className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-semibold shadow-xl shadow-primary-600/25 hover:shadow-primary-600/40 transition-all hover:-translate-y-0.5"
                >
                  Create Your First Ebook
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <button
                  onClick={() => scrollTo("how-it-works")}
                  className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-semibold hover:border-primary-300 dark:hover:border-primary-700 hover:text-primary-600 dark:hover:text-primary-400 transition-all"
                >
                  See How It Works
                </button>
              </div>
            </Reveal>

            {/* Proof points */}
            <Reveal delay={400}>
              <div className="mt-12 flex flex-wrap gap-8 md:gap-12 justify-center">
                {[
                  ["30–200", "Pages per book"],
                  ["8", "Languages"],
                  ["PDF + EPUB", "Output formats"],
                  ["~15 min", "Generation time"],
                ].map(([value, label]) => (
                  <div key={label} className="text-center">
                    <div className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
                      {value}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                      {label}
                    </div>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>

          {/* Terminal mockup */}
          <Reveal delay={500} className="mt-16 max-w-3xl mx-auto">
            <div className="rounded-2xl overflow-hidden bg-gray-900 dark:bg-black border border-gray-800 shadow-2xl shadow-black/20">
              {/* Bar */}
              <div className="flex items-center gap-2 px-4 py-3 bg-gray-800/50 border-b border-gray-800">
                <div className="w-3 h-3 rounded-full bg-red-500/80" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                <div className="w-3 h-3 rounded-full bg-green-500/80" />
                <span className="flex-1 text-center text-xs text-gray-600 font-mono">
                  bookforge.ai/projects/generating
                </span>
              </div>
              {/* Content */}
              <div className="px-5 py-5 font-mono text-[13px] leading-7 text-gray-400 overflow-x-auto">
                <div>
                  <span className="text-gray-600 select-none mr-3">1</span>
                  <span className="text-gray-600 italic">
                    {"// BookForge pipeline — your topic becomes a book"}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600 select-none mr-3">2</span>
                  <span className="text-primary-400">research</span>{" "}
                  <span className="text-amber-400">
                    "AI in Healthcare 2025"
                  </span>{" "}
                  <span className="text-gray-600">
                    → 12 web sources scraped
                  </span>
                </div>
                <div>
                  <span className="text-gray-600 select-none mr-3">3</span>
                  <span className="text-primary-400">structure</span>{" "}
                  <span className="text-gray-600">
                    → 6 chapters, 22 sections generated
                  </span>
                </div>
                <div>
                  <span className="text-gray-600 select-none mr-3">4</span>
                  <span className="text-primary-400">write</span> ch.1{" "}
                  <span className="text-emerald-400">
                    "The Diagnostic Revolution"
                  </span>{" "}
                  <span className="text-gray-600">→ 3,200 words</span>{" "}
                  <span className="text-emerald-400">✓</span>
                </div>
                <div>
                  <span className="text-gray-600 select-none mr-3">5</span>
                  <span className="text-primary-400">write</span> ch.2{" "}
                  <span className="text-emerald-400">
                    "Drug Discovery at Scale"
                  </span>{" "}
                  <span className="text-gray-600">→ 2,800 words</span>{" "}
                  <span className="text-emerald-400">✓</span>
                </div>
                <div>
                  <span className="text-gray-600 select-none mr-3">6</span>
                  <span className="text-primary-400">write</span> ch.3{" "}
                  <span className="text-emerald-400">
                    "Surgical Robotics &amp; Beyond"
                  </span>{" "}
                  <span className="text-gray-600">→ writing...</span>{" "}
                  <span className="text-amber-400 animate-pulse">▋</span>
                </div>
                <div>
                  <span className="text-gray-600 select-none mr-3">7</span>
                </div>
                <div>
                  <span className="text-gray-600 select-none mr-3">8</span>
                  <span className="text-gray-600">
                    Progress: ████████████░░░░ 67% · Style: modern · Format: A5
                    · Lang: EN
                  </span>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </header>

      {/* ═══════════ FORMAT BAR ═══════════ */}
      <div className="border-y border-gray-200 dark:border-gray-800 py-8 bg-white dark:bg-gray-900/50">
        <div className="max-w-6xl mx-auto px-5">
          <p className="text-center text-sm text-gray-500 dark:text-gray-500 mb-4">
            Every book is delivered in professional, print-ready formats
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            {[
              {
                icon: FileText,
                color: "text-primary-500",
                label: "PDF — LaTeX typeset",
              },
              {
                icon: Smartphone,
                color: "text-emerald-500",
                label: "EPUB — Kindle, Apple Books, Kobo",
              },
              {
                icon: Code2,
                color: "text-amber-500",
                label: "LaTeX Source — Full editorial control",
              },
            ].map(({ icon: Icon, color, label }) => (
              <div
                key={label}
                className="flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-300"
              >
                <Icon className={`w-4 h-4 ${color}`} />
                {label}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ═══════════ HOW IT WORKS ═══════════ */}
      <section
        id="how-it-works"
        className="py-20 md:py-28 bg-gray-100/50 dark:bg-gray-900/30"
      >
        <div className="max-w-6xl mx-auto px-5">
          <Reveal className="text-center mb-14">
            <p className="text-xs font-bold tracking-widest uppercase text-primary-600 dark:text-primary-400 mb-2">
              How It Works
            </p>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight">
              From topic to finished ebook
              <br className="hidden md:block" /> in five steps.
            </h2>
            <p className="mt-4 text-gray-600 dark:text-gray-400 max-w-xl mx-auto">
              No templates. No copy-paste. BookForge runs a complete AI
              publishing pipeline — research, structure, write, design, compile.
            </p>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-6 md:gap-0">
            {[
              {
                icon: Search,
                num: "01",
                title: "Web Research",
                desc: "AI generates targeted queries, scrapes up to 20 live web sources, and selects the most data-rich content — both globally and per-chapter.",
              },
              {
                icon: BookOpen,
                num: "02",
                title: "Structure",
                desc: "A full book outline is generated with chapter descriptions, page allocations, and writing instructions. You review, edit, or regenerate it.",
              },
              {
                icon: Sparkles,
                num: "03",
                title: "Content Generation",
                desc: "Each chapter is written with full context of all previous chapters (up to 400K characters), ensuring style consistency and zero repetition.",
              },
              {
                icon: Palette,
                num: "04",
                title: "Design & Compile",
                desc: "Professional LaTeX typesetting with your chosen style preset and color palette. Self-healing compiler fixes AI output errors automatically.",
              },
              {
                icon: Package,
                num: "05",
                title: "PDF + EPUB + Edit",
                desc: "Download both formats. Edit any chapter with a syntax-highlighted LaTeX editor. Recompile instantly. Every version is preserved.",
              },
            ].map(({ icon: Icon, num, title, desc }, i) => (
              <Reveal key={num} delay={i * 80}>
                <div className="relative text-center px-4 py-6">
                  {/* Arrow between steps (desktop) */}
                  {i < 4 && (
                    <div className="hidden md:block absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 text-gray-300 dark:text-gray-700 text-2xl z-10">
                      →
                    </div>
                  )}
                  <div className="w-14 h-14 rounded-2xl bg-primary-50 dark:bg-primary-950/50 border border-primary-200 dark:border-primary-800 flex items-center justify-center mx-auto mb-4">
                    <Icon className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                  </div>
                  <p className="text-xs font-mono text-primary-600 dark:text-primary-400 mb-1">
                    {num}
                  </p>
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">
                    {title}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-500 leading-relaxed">
                    {desc}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ FEATURES ═══════════ */}
      <div id="features">
        {/* Feature 1: Research */}
        <section className="py-20 md:py-28 border-b border-gray-200 dark:border-gray-800">
          <div className="max-w-6xl mx-auto px-5">
            <Reveal>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                <div>
                  <p className="text-xs font-bold tracking-widest uppercase text-primary-600 dark:text-primary-400 mb-3">
                    Real Research, Real Data
                  </p>
                  <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
                    Every claim backed by{" "}
                    <span className="text-primary-600 dark:text-primary-400">
                      live web sources.
                    </span>
                  </h2>
                  <p className="mt-4 text-gray-600 dark:text-gray-400 leading-relaxed">
                    Most AI ebook generators rely on the model's training data
                    alone — producing vague, generic content. BookForge runs a
                    two-level research pipeline before a single word is written.
                  </p>
                  <ul className="mt-6 space-y-3">
                    {[
                      "Google Custom Search API finds the most relevant, data-dense sources for your topic",
                      "Dedicated scraping microservice extracts full-text content from up to 20 web pages",
                      "AI evaluates and selects 3–5 best global sources plus 2–3 chapter-specific sources",
                      "Strict deduplication ensures no URL is reused across chapters",
                      "Automatic English supplement when sources in the target language are insufficient",
                    ].map((t) => (
                      <li
                        key={t}
                        className="flex gap-3 text-sm text-gray-600 dark:text-gray-400"
                      >
                        <ArrowRight className="w-4 h-4 text-primary-500 shrink-0 mt-0.5" />
                        <span>{t}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                {/* Code visual */}
                <div className="rounded-2xl bg-gray-900 dark:bg-black border border-gray-800 p-5 font-mono text-[12px] leading-7 text-gray-400 overflow-x-auto">
                  <div>
                    <span className="text-primary-400">research</span>
                    <span className="text-gray-600"> global</span>
                  </div>
                  <div>
                    {" "}
                    <span className="text-gray-600">query:</span>{" "}
                    <span className="text-amber-400">
                      "AI healthcare diagnostics 2025"
                    </span>
                  </div>
                  <div>
                    {" "}
                    <span className="text-gray-600">found:</span> 18 results →
                    scraped 14 →{" "}
                    <span className="text-emerald-400">selected 4</span>
                  </div>
                  <div>
                    {" "}
                    <span className="text-gray-600">sources:</span>
                  </div>
                  <div>
                    {" "}
                    <span className="text-emerald-400">nature.com</span>{" "}
                    <span className="text-gray-600">
                      — 12,400 chars — clinical trial data
                    </span>
                  </div>
                  <div>
                    {" "}
                    <span className="text-emerald-400">mckinsey.com</span>{" "}
                    <span className="text-gray-600">
                      — 8,200 chars — market analysis
                    </span>
                  </div>
                  <div>
                    {" "}
                    <span className="text-emerald-400">who.int</span>{" "}
                    <span className="text-gray-600">
                      — 6,800 chars — global statistics
                    </span>
                  </div>
                  <div>
                    {" "}
                    <span className="text-emerald-400">arxiv.org</span>{" "}
                    <span className="text-gray-600">
                      — 15,100 chars — recent paper
                    </span>
                  </div>
                  <div className="mt-2">
                    <span className="text-primary-400">research</span>
                    <span className="text-gray-600"> chapter-3 </span>
                    <span className="text-amber-400">"Surgical Robotics"</span>
                  </div>
                  <div>
                    {" "}
                    <span className="text-gray-600">query:</span>{" "}
                    <span className="text-amber-400">
                      "da Vinci surgical robot outcomes"
                    </span>
                  </div>
                  <div>
                    {" "}
                    <span className="text-gray-600">found:</span> 9 results →{" "}
                    <span className="text-emerald-400">selected 2</span>{" "}
                    <span className="text-gray-600">★ chapter-specific</span>
                  </div>
                  <div>
                    {" "}
                    <span className="text-emerald-400">jama.com</span>{" "}
                    <span className="text-gray-600">
                      — surgery outcomes meta-analysis
                    </span>
                  </div>
                  <div>
                    {" "}
                    <span className="text-emerald-400">intuitive.com</span>{" "}
                    <span className="text-gray-600">
                      — procedure count data 2024
                    </span>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* Feature 2: Typography */}
        <section className="py-20 md:py-28 bg-gray-50 dark:bg-gray-900/30 border-b border-gray-200 dark:border-gray-800">
          <div className="max-w-6xl mx-auto px-5">
            <Reveal>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                {/* Visual first on desktop (reverse order) */}
                <div className="order-2 lg:order-1 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-lg p-6 md:p-8">
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-5 max-w-sm mx-auto">
                    <div className="text-2xl font-bold text-primary-600 dark:text-primary-400 mb-0.5">
                      Chapter 3
                    </div>
                    <div className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      Surgical Robotics &amp; Beyond
                    </div>
                    {/* Tip box */}
                    <div className="bg-emerald-50 dark:bg-emerald-950/30 border-l-[3px] border-emerald-500 rounded-r-lg px-4 py-3 mb-3">
                      <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mb-1">
                        💡 Key Insight
                      </div>
                      <div className="text-sm text-gray-700 dark:text-gray-300">
                        Da Vinci systems performed 1.2M procedures in 2024 — a
                        23% year-over-year increase.
                      </div>
                    </div>
                    {/* Warning box */}
                    <div className="bg-amber-50 dark:bg-amber-950/30 border-l-[3px] border-amber-500 rounded-r-lg px-4 py-3 mb-3">
                      <div className="text-xs font-bold text-amber-600 dark:text-amber-400 mb-1">
                        ⚠️ Common Mistake
                      </div>
                      <div className="text-sm text-gray-700 dark:text-gray-300">
                        Assuming robotic surgery always reduces recovery time —
                        outcomes depend heavily on procedure type.
                      </div>
                    </div>
                    {/* Mini table */}
                    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-2">
                        Comparison Table
                      </div>
                      <div className="grid grid-cols-3 gap-x-4 gap-y-1 text-xs text-gray-600 dark:text-gray-400">
                        <span className="font-semibold text-gray-900 dark:text-white">
                          System
                        </span>
                        <span className="font-semibold text-gray-900 dark:text-white">
                          Procedures
                        </span>
                        <span className="font-semibold text-gray-900 dark:text-white">
                          Cost
                        </span>
                        <span>Da Vinci Xi</span>
                        <span>1.2M/yr</span>
                        <span>$1.5–2M</span>
                        <span>Versius</span>
                        <span>50K/yr</span>
                        <span>$0.8M</span>
                        <span>Hugo RAS</span>
                        <span>12K/yr</span>
                        <span>$1M</span>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 text-center mt-4">
                    Actual chapter output — colored boxes, data tables, real
                    statistics
                  </p>
                </div>

                <div className="order-1 lg:order-2">
                  <p className="text-xs font-bold tracking-widest uppercase text-primary-600 dark:text-primary-400 mb-3">
                    Publication-Grade Design
                  </p>
                  <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
                    LaTeX typography.{" "}
                    <span className="text-primary-600 dark:text-primary-400">
                      Not markdown-to-PDF.
                    </span>
                  </h2>
                  <p className="mt-4 text-gray-600 dark:text-gray-400 leading-relaxed">
                    While other AI ebook makers convert markdown to a plain PDF,
                    BookForge generates real LaTeX — the same typesetting system
                    used by academic publishers, technical authors, and research
                    institutions worldwide.
                  </p>
                  <ul className="mt-6 space-y-3">
                    {[
                      "Professional booktabs tables, tcolorbox colored callouts, fancyhdr headers",
                      "5 design presets: Modern, Academic, Creative, Business, Minimal — each with distinct font choices",
                      "Custom color palette: pick 1–3 colors and the algorithm derives a complete, harmonious scheme",
                      "Microtype character protrusion and font expansion for optically perfect margins",
                      "4 page formats (A5, B5, A4, Letter) with proper inner/outer margins for print binding",
                    ].map((t) => (
                      <li
                        key={t}
                        className="flex gap-3 text-sm text-gray-600 dark:text-gray-400"
                      >
                        <ArrowRight className="w-4 h-4 text-primary-500 shrink-0 mt-0.5" />
                        <span>{t}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="flex flex-wrap gap-2 mt-5">
                    {[
                      "Modern",
                      "Academic",
                      "Creative",
                      "Business",
                      "Minimal",
                    ].map((p, i) => (
                      <span
                        key={p}
                        className={`px-3 py-1 rounded-lg text-xs font-medium border ${
                          i === 0
                            ? "bg-primary-50 dark:bg-primary-950/50 text-primary-700 dark:text-primary-300 border-primary-200 dark:border-primary-800"
                            : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700"
                        }`}
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* Feature 3: Consistency */}
        <section className="py-20 md:py-28 border-b border-gray-200 dark:border-gray-800">
          <div className="max-w-6xl mx-auto px-5">
            <Reveal>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                <div>
                  <p className="text-xs font-bold tracking-widest uppercase text-primary-600 dark:text-primary-400 mb-3">
                    Style Consistency
                  </p>
                  <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
                    One voice across{" "}
                    <span className="text-primary-600 dark:text-primary-400">
                      every chapter.
                    </span>
                  </h2>
                  <p className="mt-4 text-gray-600 dark:text-gray-400 leading-relaxed">
                    The #1 problem with AI-generated long-form content? Chapter
                    5 sounds nothing like Chapter 1. BookForge solves this by
                    passing the complete text of all previous chapters as
                    context — up to 400,000 characters — when generating each
                    new chapter.
                  </p>
                  <ul className="mt-6 space-y-3">
                    {[
                      "Full previous chapter text included in every generation call — not summaries, the real thing",
                      "Explicit anti-repetition rules prevent recycling examples, statistics, or arguments",
                      'Natural cross-references: "As we explored in Chapter 2…" emerge organically',
                      'deAIfy™ post-processing strips AI-isms like "In today\'s rapidly evolving…" in both English and Polish',
                      "Result: readers cannot detect a style shift between chapters",
                    ].map((t) => (
                      <li
                        key={t}
                        className="flex gap-3 text-sm text-gray-600 dark:text-gray-400"
                      >
                        <ArrowRight className="w-4 h-4 text-primary-500 shrink-0 mt-0.5" />
                        <span>{t}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-2xl bg-gray-900 dark:bg-black border border-gray-800 p-5 font-mono text-[12px] leading-7 text-gray-400 overflow-x-auto">
                  <div>
                    <span className="text-gray-600 italic">
                      {"// Chapter 4 generation context"}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">previous_chapters:</span>
                  </div>
                  <div>
                    {" "}
                    ch.1 <span className="text-emerald-400">
                      14,200 words
                    </span>{" "}
                    <span className="text-gray-600">— full LaTeX</span>
                  </div>
                  <div>
                    {" "}
                    ch.2 <span className="text-emerald-400">
                      11,800 words
                    </span>{" "}
                    <span className="text-gray-600">— full LaTeX</span>
                  </div>
                  <div>
                    {" "}
                    ch.3 <span className="text-emerald-400">
                      12,500 words
                    </span>{" "}
                    <span className="text-gray-600">— full LaTeX</span>
                  </div>
                  <div>
                    {" "}
                    <span className="text-gray-600">total context:</span>{" "}
                    <span className="text-amber-400">~280,000 chars</span>
                  </div>
                  <div className="mt-2">
                    <span className="text-gray-600">instructions:</span>
                  </div>
                  <div>
                    {" "}
                    <span className="text-primary-400">MATCH</span> writing
                    style EXACTLY
                  </div>
                  <div>
                    {" "}
                    <span className="text-primary-400">NEVER</span> repeat
                    examples from ch.1–3
                  </div>
                  <div>
                    {" "}
                    <span className="text-primary-400">BUILD</span> on concepts
                    introduced earlier
                  </div>
                  <div>
                    {" "}
                    <span className="text-primary-400">MAINTAIN</span>{" "}
                    consistent terminology
                  </div>
                  <div className="mt-2">
                    <span className="text-gray-600">
                      deAIfy filters (active):
                    </span>
                  </div>
                  <div>
                    {" "}
                    <span className="text-red-400">✗</span>{" "}
                    <span className="text-gray-600">
                      "In today's rapidly evolving…"
                    </span>
                  </div>
                  <div>
                    {" "}
                    <span className="text-red-400">✗</span>{" "}
                    <span className="text-gray-600">
                      "It's worth noting that…"
                    </span>
                  </div>
                  <div>
                    {" "}
                    <span className="text-red-400">✗</span>{" "}
                    <span className="text-gray-600">
                      "game-changer" / "cutting-edge"
                    </span>
                  </div>
                  <div>
                    {" "}
                    <span className="text-red-400">✗</span>{" "}
                    <span className="text-gray-600">
                      "paradigm shift" / "delve into"
                    </span>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* Feature 4: Edit + Version */}
        <section className="py-20 md:py-28 bg-gray-50 dark:bg-gray-900/30 border-b border-gray-200 dark:border-gray-800">
          <div className="max-w-6xl mx-auto px-5">
            <Reveal>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                {/* Editor mockup */}
                <div className="order-2 lg:order-1 rounded-2xl overflow-hidden bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-lg">
                  {/* Tab bar */}
                  <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-400">
                    <span className="font-semibold text-gray-900 dark:text-white">
                      CH 3
                    </span>
                    <span>Surgical Robotics & Beyond</span>
                    <span className="ml-auto text-xs text-gray-400">
                      3,200 words
                    </span>
                    <span className="w-2 h-2 bg-amber-400 rounded-full" />
                  </div>
                  {/* Toolbar */}
                  <div className="flex gap-2 px-4 py-2 border-b border-gray-200 dark:border-gray-700 text-xs">
                    <span className="px-2.5 py-1 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                      Preview
                    </span>
                    <span className="px-2.5 py-1 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                      Undo All
                    </span>
                    <span className="ml-auto px-3 py-1 rounded-md bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300 font-medium">
                      Save
                    </span>
                  </div>
                  {/* Code */}
                  <div className="px-4 py-4 font-mono text-[11px] leading-7 text-gray-600 dark:text-gray-400 max-h-48 overflow-hidden">
                    <div>
                      <span className="text-gray-400 select-none mr-2"> 1</span>{" "}
                      <span className="text-primary-600 dark:text-primary-400 font-medium">
                        \section
                      </span>
                      {`{The Da Vinci Ecosystem}`}
                    </div>
                    <div>
                      <span className="text-gray-400 select-none mr-2"> 2</span>
                    </div>
                    <div>
                      <span className="text-gray-400 select-none mr-2"> 3</span>{" "}
                      Intuitive Surgical's da Vinci platform
                    </div>
                    <div>
                      <span className="text-gray-400 select-none mr-2"> 4</span>{" "}
                      has dominated surgical robotics for over
                    </div>
                    <div>
                      <span className="text-gray-400 select-none mr-2"> 5</span>{" "}
                      two decades. With more than{" "}
                      <span className="text-primary-600 dark:text-primary-400 font-medium">
                        \textbf
                      </span>
                      {`{8,600}`}
                    </div>
                    <div>
                      <span className="text-gray-400 select-none mr-2"> 6</span>{" "}
                      systems installed worldwide...
                    </div>
                    <div>
                      <span className="text-gray-400 select-none mr-2"> 7</span>
                    </div>
                    <div>
                      <span className="text-gray-400 select-none mr-2"> 8</span>{" "}
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                        \begin
                      </span>
                      {`{keyinsight}{Market Position}`}
                    </div>
                    <div>
                      <span className="text-gray-400 select-none mr-2"> 9</span>{" "}
                      Despite growing competition from Medtronic
                    </div>
                  </div>
                  {/* Footer */}
                  <div className="px-4 py-2.5 border-t border-gray-200 dark:border-gray-700 flex gap-4 text-xs text-gray-400">
                    <span>
                      v1 · v2 ·{" "}
                      <span className="font-semibold text-primary-600 dark:text-primary-400">
                        v3 (latest)
                      </span>
                    </span>
                    <span className="ml-auto">PDF ↓ · EPUB ↓ · LaTeX ↓</span>
                  </div>
                </div>

                <div className="order-1 lg:order-2">
                  <p className="text-xs font-bold tracking-widest uppercase text-primary-600 dark:text-primary-400 mb-3">
                    Edit, Recompile, Version
                  </p>
                  <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
                    Your book is never{" "}
                    <span className="text-primary-600 dark:text-primary-400">
                      locked in.
                    </span>
                  </h2>
                  <p className="mt-4 text-gray-600 dark:text-gray-400 leading-relaxed">
                    AI-generated content is a starting point, not a final
                    product. BookForge gives you a full CodeMirror editor with
                    LaTeX syntax highlighting, live preview, and instant
                    recompilation — with every version preserved.
                  </p>
                  <ul className="mt-6 space-y-3">
                    {[
                      "Syntax-highlighted LaTeX editor with line numbers, search, bracket matching, and code folding",
                      "Preview mode renders LaTeX as formatted HTML — no compilation needed to see changes",
                      "Recompile generates a new PDF + EPUB + LaTeX source in one click",
                      "Full version history: download any format (PDF, EPUB, LaTeX) from any previous version",
                      "Self-healing compiler: three-layer LaTeX sanitization + auto-fix from pdflatex logs",
                    ].map((t) => (
                      <li
                        key={t}
                        className="flex gap-3 text-sm text-gray-600 dark:text-gray-400"
                      >
                        <ArrowRight className="w-4 h-4 text-primary-500 shrink-0 mt-0.5" />
                        <span>{t}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* Feature 5: Languages */}
        <section className="py-20 md:py-24 border-b border-gray-200 dark:border-gray-800 text-center">
          <div className="max-w-2xl mx-auto px-5">
            <Reveal>
              <p className="text-xs font-bold tracking-widest uppercase text-primary-600 dark:text-primary-400 mb-2">
                8 Languages
              </p>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
                Write in the language{" "}
                <span className="text-primary-600 dark:text-primary-400">
                  your audience reads.
                </span>
              </h2>
              <p className="mt-4 text-gray-600 dark:text-gray-400">
                Every part of the pipeline — research queries, structure
                generation, content writing, deAIfy patterns, and LaTeX babel
                configuration — adapts to your chosen language.
              </p>
              <div className="flex flex-wrap gap-3 justify-center mt-8">
                {[
                  "🇬🇧 English",
                  "🇵🇱 Polish",
                  "🇩🇪 German",
                  "🇪🇸 Spanish",
                  "🇫🇷 French",
                  "🇮🇹 Italian",
                  "🇵🇹 Portuguese",
                  "🇳🇱 Dutch",
                ].map((l) => (
                  <span
                    key={l}
                    className="px-4 py-2 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-300"
                  >
                    {l}
                  </span>
                ))}
              </div>
            </Reveal>
          </div>
        </section>
      </div>

      {/* ═══════════ COMPARISON TABLE ═══════════ */}
      <section className="py-20 md:py-28 bg-gray-100/50 dark:bg-gray-900/30">
        <div className="max-w-6xl mx-auto px-5">
          <Reveal className="text-center mb-10">
            <p className="text-xs font-bold tracking-widest uppercase text-primary-600 dark:text-primary-400 mb-2">
              BookForge vs. Alternatives
            </p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              Not all AI ebook creators are built the same.
            </h2>
          </Reveal>
          <Reveal>
            <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-800">
                    <th className="text-left px-5 py-4 font-semibold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider">
                      Feature
                    </th>
                    <th className="text-left px-5 py-4 font-semibold text-primary-600 dark:text-primary-400 text-xs uppercase tracking-wider bg-primary-50/50 dark:bg-primary-950/30">
                      BookForge.ai
                    </th>
                    <th className="text-left px-5 py-4 font-semibold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider">
                      ChatGPT / Claude
                    </th>
                    <th className="text-left px-5 py-4 font-semibold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider">
                      Other AI Tools
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {[
                    [
                      "Live web research per chapter",
                      "✓ Two-level",
                      "✗ Training data only",
                      "✗ None",
                    ],
                    [
                      "Professional typesetting",
                      "✓ LaTeX",
                      "✗ Markdown",
                      "✗ Basic PDF",
                    ],
                    [
                      "Cross-chapter consistency",
                      "✓ 400K context",
                      "✗ ~8K window",
                      "✗ No context",
                    ],
                    ["PDF + EPUB output", "✓ Both", "✗ Text only", "PDF only"],
                    [
                      "Post-generation editing",
                      "✓ Syntax editor",
                      "Copy-paste",
                      "✗ One-shot",
                    ],
                    ["Version history", "✓ All formats", "✗ None", "✗ None"],
                    [
                      "Custom design system",
                      "✓ 5 presets + colors",
                      "✗ No design",
                      "Template-based",
                    ],
                    [
                      "Multilingual pipeline",
                      "✓ 8 languages",
                      "Generation only",
                      "English only",
                    ],
                  ].map(([feature, bf, gpt, other]) => (
                    <tr
                      key={feature}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800/50"
                    >
                      <td className="px-5 py-3.5 font-medium text-gray-900 dark:text-white">
                        {feature}
                      </td>
                      <td className="px-5 py-3.5 bg-primary-50/30 dark:bg-primary-950/20">
                        <span
                          className={
                            bf.startsWith("✓")
                              ? "text-emerald-600 dark:text-emerald-400 font-semibold"
                              : "text-gray-500"
                          }
                        >
                          {bf}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={
                            gpt.startsWith("✗")
                              ? "text-gray-400"
                              : "text-gray-600 dark:text-gray-400"
                          }
                        >
                          {gpt}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={
                            other.startsWith("✗")
                              ? "text-gray-400"
                              : "text-gray-600 dark:text-gray-400"
                          }
                        >
                          {other}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══════════ USE CASES ═══════════ */}
      <section className="py-20 md:py-28">
        <div className="max-w-6xl mx-auto px-5">
          <Reveal className="text-center mb-12">
            <p className="text-xs font-bold tracking-widest uppercase text-primary-600 dark:text-primary-400 mb-2">
              Who Is It For
            </p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              Built for people who need{" "}
              <span className="text-primary-600 dark:text-primary-400">
                professional content, fast.
              </span>
            </h2>
          </Reveal>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              {
                icon: Zap,
                title: "Consultants & Coaches",
                desc: "Turn your expertise into a lead magnet ebook. Share it with prospects, use it in workshops, or sell it as a digital product. One topic, one click, one professional book.",
              },
              {
                icon: GraduationCap,
                title: "Educators & Course Creators",
                desc: "Generate comprehensive course materials, study guides, or supplementary readings. Multilingual support means you can create content for international students.",
              },
              {
                icon: Rocket,
                title: "Entrepreneurs & Startups",
                desc: "Establish thought leadership with a well-researched ebook on your industry. Use it for content marketing, investor decks, or Amazon KDP publishing.",
              },
              {
                icon: BarChart3,
                title: "Marketing Teams",
                desc: "Produce data-driven whitepapers and industry reports. The research pipeline ensures every claim is backed by real sources — not AI hallucinations.",
              },
              {
                icon: PenTool,
                title: "Non-Fiction Authors",
                desc: "Use BookForge as a powerful first draft engine. Generate the structure and content, then refine it in the built-in editor or export the LaTeX source for full control.",
              },
              {
                icon: Languages,
                title: "Multilingual Publishers",
                desc: "Create content in 8 languages with proper hyphenation, typography, and language-specific deAIfy rules. Reach audiences in their native language.",
              },
            ].map(({ icon: Icon, title, desc }, i) => (
              <Reveal key={title} delay={i * 60}>
                <div className="p-6 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:border-primary-200 dark:hover:border-primary-800 hover:-translate-y-1 hover:shadow-xl transition-all duration-300">
                  <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-950/50 flex items-center justify-center mb-4">
                    <Icon className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                  </div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                    {title}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-500 leading-relaxed">
                    {desc}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ PRICING ═══════════ */}
      <section
        id="pricing"
        className="py-20 md:py-28 bg-gray-100/50 dark:bg-gray-900/30"
      >
        <div className="max-w-6xl mx-auto px-5">
          <Reveal className="text-center mb-10">
            <p className="text-xs font-bold tracking-widest uppercase text-primary-600 dark:text-primary-400 mb-2">
              Simple Pricing
            </p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              Pay per book. No subscriptions.
            </h2>
            <p className="mt-3 text-gray-600 dark:text-gray-400">
              One-time payment. All formats included. Edit and recompile as many
              times as you need.
            </p>
          </Reveal>

          <Reveal>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {[
                {
                  tier: "Compact",
                  price: "6.99",
                  pages: "30–40",
                  chapters: 3,
                  featured: false,
                },
                {
                  tier: "Standard",
                  price: "9.99",
                  pages: "50–70",
                  chapters: 4,
                  featured: false,
                },
                {
                  tier: "Extended",
                  price: "14.99",
                  pages: "80–100",
                  chapters: 6,
                  featured: true,
                },
                {
                  tier: "Comprehensive",
                  price: "19.99",
                  pages: "130–150",
                  chapters: 8,
                  featured: false,
                },
                {
                  tier: "Complete",
                  price: "24.99",
                  pages: "170–200",
                  chapters: 10,
                  featured: false,
                },
              ].map(({ tier, price, pages, chapters, featured }) => (
                <div
                  key={tier}
                  className={`relative p-5 rounded-2xl text-center transition-all hover:-translate-y-1 hover:shadow-xl ${
                    featured
                      ? "bg-white dark:bg-gray-900 border-2 border-primary-500 shadow-lg shadow-primary-500/10"
                      : "bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800"
                  }`}
                >
                  {featured && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-primary-600 text-white text-[10px] font-bold uppercase tracking-wider">
                      Most Popular
                    </div>
                  )}
                  <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mt-1">
                    {tier}
                  </div>
                  <div className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                    <span className="text-lg align-top">$</span>
                    {price}
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    <span className="font-semibold text-gray-700 dark:text-gray-300">
                      {pages}
                    </span>{" "}
                    pages
                  </div>
                  <div className="text-xs text-gray-400 mb-4">
                    {chapters} chapters
                  </div>
                  <div className="border-t border-gray-100 dark:border-gray-800 pt-3 space-y-1.5 text-left">
                    {[
                      "Web research",
                      "PDF + EPUB + LaTeX",
                      "All design presets",
                      "Unlimited edits",
                    ].map((f) => (
                      <div
                        key={f}
                        className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400"
                      >
                        <Check className="w-3 h-3 text-emerald-500 shrink-0" />
                        {f}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══════════ FAQ ═══════════ */}
      <section id="faq" className="py-20 md:py-28">
        <div className="max-w-2xl mx-auto px-5">
          <Reveal className="text-center mb-10">
            <p className="text-xs font-bold tracking-widest uppercase text-primary-600 dark:text-primary-400 mb-2">
              FAQ
            </p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              Questions? Answered.
            </h2>
          </Reveal>

          <Reveal>
            <div>
              <FAQItem
                q="How is this different from just asking ChatGPT to write a book?"
                a="ChatGPT generates text from its training data in a single session with limited context. BookForge runs a full pipeline: live web research to find current data, structured chapter planning you can edit, content generation with up to 400K characters of context for style consistency, professional LaTeX typesetting, and output in PDF + EPUB. The result is a researched, professionally designed book — not a long chat response."
              />
              <FAQItem
                q="Are the sources real? Can I verify them?"
                a="Yes. BookForge uses Google Custom Search API to find live web pages, then scrapes their content through a dedicated microservice. The AI selects sources based on data density — prioritizing statistics, case studies, and named examples. Every claim in the output comes from real, publicly accessible web content."
              />
              <FAQItem
                q="Can I edit the content after generation?"
                a='Absolutely. The built-in editor features syntax-highlighted LaTeX editing with line numbers, search, and bracket matching. You also get a preview mode that renders your changes as formatted HTML. After editing, click "Regenerate" to compile a new PDF + EPUB. Every version is saved — you can always go back.'
              />
              <FAQItem
                q="What if I don't know LaTeX?"
                a="You don't need to. BookForge generates all the LaTeX automatically. The editor is there for power users who want fine control. Most users simply review the book structure before generation, download the PDF, and are done. If you want to make text changes, the preview mode shows formatted output without any LaTeX knowledge required."
              />
              <FAQItem
                q='Will the output look "AI-generated"?'
                a='BookForge actively fights against it. The deAIfy post-processing removes dozens of known AI patterns ("In todays rapidly evolving…", "Its worth noting…", "game-changer") in multiple languages. Combined with real research data, specific examples with company names and statistics, and professional typography — the output reads like expert-authored content, not AI filler.'
              />
              <FAQItem
                q="Can I use the generated book commercially?"
                a="Yes. You own full commercial rights to every book you generate. Use it as a lead magnet, sell it on Amazon KDP, include it in your course, distribute it to clients — it's yours. You also get the LaTeX source code for complete editorial control."
              />
              <FAQItem
                q="Why one-time payment instead of a subscription?"
                a='Because most people need 1–5 ebooks, not unlimited. Pay-per-book means you only pay when you create. No monthly fees, no unused credits, no pressure to "get your moneys worth." Each payment includes all formats, unlimited edits, and permanent version history.'
              />
              <FAQItem
                q="What languages are supported?"
                a="English, Polish, German, Spanish, French, Italian, Portuguese, and Dutch. The entire pipeline adapts — research queries, content generation, AI pattern removal, and LaTeX typography (hyphenation, babel configuration) are all language-aware."
              />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══════════ FINAL CTA ═══════════ */}
      <section className="py-20 md:py-28 bg-gray-900 dark:bg-black relative overflow-hidden">
        {/* Glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary-600/15 rounded-full blur-3xl" />
        </div>

        <div className="max-w-2xl mx-auto px-5 text-center relative">
          <Reveal>
            <p className="text-xs font-bold tracking-widest uppercase text-primary-400 mb-2">
              Ready?
            </p>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-white">
              Your ebook is 15 minutes away.
            </h2>
            <p className="mt-4 text-gray-400 text-lg">
              Pick a topic. Review the structure. Get a publication-ready book
              with real research, professional design, and full editing control.
            </p>
            <div className="mt-8">
              <Link
                to="/auth/register"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-primary-600 hover:bg-primary-500 text-white font-semibold text-lg shadow-xl shadow-primary-600/30 hover:shadow-primary-500/40 transition-all hover:-translate-y-0.5"
              >
                Start Creating — From $6.99
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
            <p className="mt-5 text-sm text-gray-500">
              No subscription · All formats included · Commercial rights ·
              Unlimited edits
            </p>
          </Reveal>
        </div>
      </section>

      {/* ═══════════ FOOTER ═══════════ */}
      <footer className="py-10 border-t border-gray-200 dark:border-gray-800">
        <div className="max-w-6xl mx-auto px-5">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-white">
                <BookOpen className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                BookForge
                <span className="text-primary-600 dark:text-primary-400">
                  .ai
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                The AI ebook generator with real research.
              </p>
            </div>
            <div className="flex gap-6">
              <Link
                to="/privacy"
                className="text-sm text-gray-500 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
              >
                Privacy
              </Link>
              <Link
                to="/terms"
                className="text-sm text-gray-500 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
              >
                Terms
              </Link>
              <a
                href="mailto:hello@bookforge.ai"
                className="text-sm text-gray-500 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
              >
                Contact
              </a>
            </div>
          </div>
          <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-800 text-center">
            <p className="text-xs text-gray-400">
              &copy; 2025 BookForge.ai — AI-powered ebook generation. All rights
              reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
