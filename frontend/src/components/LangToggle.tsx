import { useLangStore, type AppLang } from "@/lib/i18n";

/** EN | PL switch for the auth screens. Persists the choice (localStorage). */
export default function LangToggle() {
  const lang = useLangStore((s) => s.lang);
  const setLang = useLangStore((s) => s.setLang);
  const langs: AppLang[] = ["en", "pl"];

  return (
    <div className="fixed top-4 left-4 flex items-center gap-0.5 rounded-lg bg-gray-200/70 dark:bg-gray-800/70 p-0.5 backdrop-blur-sm">
      {langs.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLang(l)}
          aria-pressed={lang === l}
          className={`px-2.5 py-1 rounded-md text-xs font-bold transition-colors ${
            lang === l
              ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
              : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          }`}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
