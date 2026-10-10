import { useLangStore } from "@/lib/i18n";

// The InkMagnet logo — identical to the public site (site/src/components/
// Header.astro): white ink drop on the indigo rounded square, the wordmark in
// Inter Bold, the tagline under it. Keep the two in sync.

const TAGLINE: Record<string, string> = {
  en: "Ebook AI generator",
  pl: "Generator ebooków AI",
};

const INTER = '"Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';

export default function Logo({
  size = "md",
  tagline = true,
}: {
  size?: "md" | "lg";
  /** the small line under the wordmark */
  tagline?: boolean;
}) {
  const lang = useLangStore((s) => s.lang);
  const lg = size === "lg";
  return (
    <span className="inline-flex items-center gap-2.5">
      <span
        className={
          "flex shrink-0 items-center justify-center rounded-xl bg-[#4f46e5] " +
          (lg ? "h-10 w-10" : "h-9 w-9")
        }
      >
        <svg viewBox="0 0 24 24" fill="none" className={lg ? "h-[22px] w-[22px] text-white" : "h-5 w-5 text-white"} aria-hidden="true">
          <path
            d="M12 3c3.5 4.2 5.5 7.2 5.5 9.8a5.5 5.5 0 1 1-11 0C6.5 10.2 8.5 7.2 12 3Z"
            fill="currentColor"
          />
        </svg>
      </span>
      <span className="flex flex-col leading-none text-left" style={{ fontFamily: INTER }}>
        <span
          className={
            "font-bold tracking-tight text-[#0f172a] dark:text-white " + (lg ? "text-xl" : "text-lg")
          }
        >
          InkMagnet
        </span>
        {tagline && (
          <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#4f46e5]/90 dark:text-indigo-300">
            {TAGLINE[lang] || TAGLINE.en}
          </span>
        )}
      </span>
    </span>
  );
}
