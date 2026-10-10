import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import US from "country-flag-icons/react/3x2/US";
import PL from "country-flag-icons/react/3x2/PL";
import DE from "country-flag-icons/react/3x2/DE";
import ES from "country-flag-icons/react/3x2/ES";
import MX from "country-flag-icons/react/3x2/MX";
import AR from "country-flag-icons/react/3x2/AR";
import CO from "country-flag-icons/react/3x2/CO";
import BR from "country-flag-icons/react/3x2/BR";
import PT from "country-flag-icons/react/3x2/PT";
import { useT } from "@/lib/i18n";
import { LANGUAGE_LABEL_KEYS, languageLabelKey } from "@/lib/bookLanguages";

// Book-language picker with flags. A native <select> cannot show images, and
// flag emoji are not an option: Chrome on Windows renders them as letter
// pairs ("PL", "GB"). So: SVG flags in a small custom listbox.

const flagCls = "h-4 w-6 rounded-[2px] shadow-[0_0_0_1px_rgba(0,0,0,0.12)] shrink-0";

/** Flag(s) for a book language, in a fixed-width slot so labels line up.
 *  Latin American Spanish is not one country — three stacked flags (Mexico,
 *  Argentina, Colombia) stand for the region. */
export function LanguageFlag({ code }: { code: string }) {
  return (
    <span className="inline-flex w-9 shrink-0 items-center" aria-hidden>
      {flagFor(code)}
    </span>
  );
}

function flagFor(code: string) {
  switch (code) {
    case "en":
      return <US className={flagCls} />;
    case "pl":
      return <PL className={flagCls} />;
    case "de":
      return <DE className={flagCls} />;
    case "es":
    case "es-ES":
      return <ES className={flagCls} />;
    case "es-419":
      return (
        <>
          <MX className={flagCls} />
          <AR className={flagCls + " -ml-[18px]"} />
          <CO className={flagCls + " -ml-[18px]"} />
        </>
      );
    case "pt-BR":
      return <BR className={flagCls} />;
    case "pt-PT":
      return <PT className={flagCls} />;
    default:
      return null;
  }
}

export default function LanguageSelect({
  value,
  onChange,
  options,
  className,
  labelId,
}: {
  value: string;
  onChange: (code: string) => void;
  options: readonly string[];
  /** classes of the form's text inputs, so the trigger matches them */
  className: string;
  labelId?: string;
}) {
  const t = useT();
  const listId = useId();
  const root = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  // A stored value that is no longer listed (plain "es") still has to show.
  const all = options.includes(value) || !value ? options : [value, ...options];
  const [active, setActive] = useState(() => Math.max(0, all.indexOf(value)));
  const label = (code: string) =>
    t(languageLabelKey(code) ?? LANGUAGE_LABEL_KEYS.en);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const pick = (code: string) => {
    onChange(code);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) {
        setActive(Math.max(0, all.indexOf(value)));
        setOpen(true);
        return;
      }
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((i) => (i + step + all.length) % all.length);
      return;
    }
    if (e.key === "Home" && open) {
      e.preventDefault();
      setActive(0);
    }
    if (e.key === "End" && open) {
      e.preventDefault();
      setActive(all.length - 1);
    }
    if ((e.key === "Enter" || e.key === " ") && open) {
      e.preventDefault();
      pick(all[active]);
    }
  };

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-labelledby={labelId}
        onClick={() => {
          setActive(Math.max(0, all.indexOf(value)));
          setOpen((o) => !o);
        }}
        onKeyDown={onKeyDown}
        className={className + " flex items-center gap-3 text-left cursor-pointer"}
      >
        <LanguageFlag code={value} />
        <span className="flex-1 truncate">{label(value)}</span>
        <ChevronDown
          className={
            "w-4 h-4 shrink-0 text-gray-400 transition-transform " + (open ? "rotate-180" : "")
          }
        />
      </button>
      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-labelledby={labelId}
          className="absolute z-30 mt-1 w-full max-h-72 overflow-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg py-1"
        >
          {all.map((code, i) => {
            const selected = code === value;
            return (
              <li
                key={code}
                role="option"
                aria-selected={selected}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(code);
                }}
                className={
                  "flex items-center gap-3 px-4 py-2.5 cursor-pointer text-gray-900 dark:text-white " +
                  (i === active ? "bg-primary-50 dark:bg-primary-900/30" : "")
                }
              >
                <LanguageFlag code={code} />
                <span className="flex-1 truncate">{label(code)}</span>
                {selected && <Check className="w-4 h-4 shrink-0 text-primary-600 dark:text-primary-400" />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
