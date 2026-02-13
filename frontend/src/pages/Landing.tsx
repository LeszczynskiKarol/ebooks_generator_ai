import { useState } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { BookOpen, FileText, Image, Sparkles, Zap, Download, ArrowRight, Check, Moon, Sun } from "lucide-react";
import { calculatePrice, PRICING_TIERS, MIN_PAGES, MAX_PAGES } from "@/lib/types";
import { useThemeStore } from "@/stores/themeStore";

export default function Landing() {
  const [pages, setPages] = useState(80);
  const pricing = calculatePrice(pages);
  const { dark, toggle } = useThemeStore();

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 transition-colors">
      <Helmet>
        <title>BookForge — AI eBook Generator | Print-Ready PDF & EPUB</title>
        <meta name="description" content="Create professional eBooks with AI. From topic to print-ready PDF in minutes. LaTeX-quality typesetting, smart image placement." />
      </Helmet>

      {/* Nav */}
      <nav className="fixed top-0 w-full bg-white/80 dark:bg-gray-950/80 backdrop-blur-md border-b border-gray-100 dark:border-gray-800 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between h-16 items-center">
          <div className="flex items-center gap-2">
            <BookOpen className="w-7 h-7 text-primary-600" />
            <span className="text-xl font-bold font-display text-gray-900 dark:text-white">BookForge</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="#pricing" className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">Pricing</a>
            <button onClick={toggle} className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <Link to="/auth/login" className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">Sign In</Link>
            <Link to="/auth/register" className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium">Get Started</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary-50 dark:bg-primary-950 text-primary-700 dark:text-primary-400 rounded-full text-sm font-medium mb-6">
            <Sparkles className="w-4 h-4" /> AI-Powered Book Generation
          </div>
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold font-display text-gray-900 dark:text-white leading-tight mb-6">
            Create Professional<br /><span className="text-primary-600 dark:text-primary-400">eBooks with AI</span>
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            From topic to print-ready PDF in minutes. Professional LaTeX typesetting, smart image placement, and multi-format output.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/auth/register" className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-all text-lg font-semibold shadow-lg shadow-primary-600/25">
              Start Your Book <ArrowRight className="w-5 h-5" />
            </Link>
            <a href="#how-it-works" className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-lg font-medium">
              See How It Works
            </a>
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section id="how-it-works" className="py-20 bg-gray-50 dark:bg-gray-900 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold font-display text-center mb-4 text-gray-900 dark:text-white">Three Steps to Your Book</h2>
          <p className="text-gray-600 dark:text-gray-400 text-center mb-16 text-lg">No writing experience needed.</p>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: FileText, step: "01", title: "Describe Your Book", desc: "Enter your topic, set page count, add guidelines. Our AI understands what you need." },
              { icon: Sparkles, step: "02", title: "Review & Customize", desc: "Get a detailed table of contents. Edit the structure, add images, or let AI generate them." },
              { icon: Download, step: "03", title: "Download Your Book", desc: "Receive a professionally typeset PDF and EPUB. Print-ready, two-sided layout included." },
            ].map((item) => (
              <div key={item.step} className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-12 h-12 bg-primary-100 dark:bg-primary-900/50 rounded-xl flex items-center justify-center">
                    <item.icon className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                  </div>
                  <span className="text-sm font-bold text-primary-600 dark:text-primary-400">STEP {item.step}</span>
                </div>
                <h3 className="text-xl font-bold mb-3 text-gray-900 dark:text-white">{item.title}</h3>
                <p className="text-gray-600 dark:text-gray-400 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold font-display text-center mb-16 text-gray-900 dark:text-white">Why BookForge?</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: Zap, title: "LaTeX Typesetting", desc: "Professional book layout with proper margins, headers, and two-sided printing." },
              { icon: Sparkles, title: "AI Content Engine", desc: "Powered by Claude — generates coherent, well-researched chapters." },
              { icon: Image, title: "Smart Images", desc: "Upload your images or let AI generate them. Automatic contextual placement." },
              { icon: FileText, title: "PDF + EPUB", desc: "Print-ready PDF with professional layout and EPUB for e-readers." },
              { icon: BookOpen, title: "Structure Control", desc: "Review and edit the table of contents before generation." },
              { icon: Download, title: "Resumable", desc: "Every stage is saved. Pause at any time and come back later." },
            ].map((f) => (
              <div key={f.title} className="p-6 rounded-xl border border-gray-100 dark:border-gray-800 hover:border-primary-200 dark:hover:border-primary-800 transition-colors">
                <f.icon className="w-8 h-8 text-primary-600 dark:text-primary-400 mb-4" />
                <h3 className="text-lg font-bold mb-2 text-gray-900 dark:text-white">{f.title}</h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 bg-gray-50 dark:bg-gray-900 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold font-display text-center mb-4 text-gray-900 dark:text-white">Simple, Fair Pricing</h2>
          <p className="text-gray-600 dark:text-gray-400 text-center mb-12 text-lg">Pay once per book. No subscriptions.</p>

          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-sm border border-gray-100 dark:border-gray-700 mb-12">
            <div className="flex items-center justify-between mb-6">
              <label className="text-lg font-medium text-gray-700 dark:text-gray-300">How many pages?</label>
              <div className="text-right">
                <div className="text-4xl font-bold text-primary-600 dark:text-primary-400 font-display">{pricing.priceUsdFormatted}</div>
                <div className="text-sm text-gray-500 dark:text-gray-500">${(pricing.perPageCents / 100).toFixed(2)}/page</div>
              </div>
            </div>
            <input type="range" min={MIN_PAGES} max={MAX_PAGES} value={pages} onChange={(e) => setPages(+e.target.value)}
              className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary-600" />
            <div className="flex justify-between mt-2 text-sm text-gray-500">
              <span>{MIN_PAGES}</span>
              <span className="font-semibold text-gray-800 dark:text-gray-200 text-lg">{pages} pages</span>
              <span>{MAX_PAGES}</span>
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            {PRICING_TIERS.slice(0, 3).map((tier) => (
              <div key={tier.label} className={`rounded-xl p-6 border ${tier.label === "Professional" ? "border-primary-300 dark:border-primary-700 bg-primary-50 dark:bg-primary-950 shadow-md" : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"}`}>
                {tier.label === "Professional" && <div className="text-xs font-bold text-primary-600 dark:text-primary-400 uppercase mb-2">Most Popular</div>}
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">{tier.label}</h3>
                <p className="text-sm text-gray-500 mb-3">{tier.minPages}–{tier.maxPages} pages</p>
                <div className="text-3xl font-bold text-gray-900 dark:text-white mb-4">${(tier.priceUsdCents / 100).toFixed(2)}</div>
                <ul className="space-y-2">
                  {["LaTeX layout", "PDF + EPUB", "AI content", "Image placement"].map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <Check className="w-4 h-4 text-green-500 flex-shrink-0" />{f}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold font-display mb-6 text-gray-900 dark:text-white">Ready to Create Your eBook?</h2>
          <Link to="/auth/register" className="inline-flex items-center gap-2 px-8 py-4 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-all text-lg font-semibold shadow-lg shadow-primary-600/25">
            Create Your First Book <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 dark:bg-black text-gray-400 py-12 px-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2"><BookOpen className="w-5 h-5 text-primary-400" /><span className="font-bold text-white">BookForge</span></div>
          <p className="text-sm">&copy; {new Date().getFullYear()} BookForge. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
