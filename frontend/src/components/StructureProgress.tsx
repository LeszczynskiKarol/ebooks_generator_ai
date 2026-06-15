import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, Globe, ListTree, Sparkles } from "lucide-react";
import { useT } from "@/lib/i18n";

interface Props {
  /** true once web research finished and Claude is designing chapters */
  researchDone: boolean;
}

interface Step {
  label: string;
  desc: string;
  icon: React.ReactNode;
}

function fmtElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Live view of structure generation (research → chapter design).
 * Replaces the old static "takes 10-30 seconds" card that lied about timing.
 */
export default function StructureProgress({ researchDone }: Props) {
  const t = useT();
  const startRef = useRef(Date.now());
  const [, force] = useState(0);

  // tick every second for the elapsed counter
  useEffect(() => {
    const t = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const steps: Step[] = [
    {
      label: t("generation.structure.0.label"),
      desc: t("generation.structure.0.desc"),
      icon: <Globe className="w-5 h-5" />,
    },
    {
      label: t("generation.structure.1.label"),
      desc: t("generation.structure.1.desc"),
      icon: <ListTree className="w-5 h-5" />,
    },
    {
      label: t("generation.structure.2.label"),
      desc: t("generation.structure.2.desc"),
      icon: <Sparkles className="w-5 h-5" />,
    },
  ];
  // step 0 active until research done, then step 1; step 2 is always "next"
  const activeIdx = researchDone ? 1 : 0;

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white">
          {t("generation.structure.title")}
        </h3>
        <span className="text-sm font-mono text-gray-400 dark:text-gray-500 tabular-nums">
          {fmtElapsed(Date.now() - startRef.current)}
        </span>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        {t("generation.structure.subtitle")}
      </p>

      <ol className="space-y-1">
        {steps.map((step, i) => {
          const done = i < activeIdx;
          const active = i === activeIdx;
          return (
            <li
              key={step.label}
              className={`flex items-start gap-4 rounded-xl p-3.5 transition-colors ${
                active ? "bg-primary-50 dark:bg-primary-950/40" : ""
              }`}
            >
              <span
                className={`mt-0.5 flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center border-2 transition-colors ${
                  done
                    ? "border-emerald-500 bg-emerald-500 text-white"
                    : active
                      ? "border-primary-500 text-primary-600 dark:text-primary-400"
                      : "border-gray-200 dark:border-gray-700 text-gray-300 dark:text-gray-600"
                }`}
              >
                {done ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : active ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  step.icon
                )}
              </span>
              <div className="min-w-0 pt-1">
                <p
                  className={`text-sm font-semibold ${
                    done
                      ? "text-gray-500 dark:text-gray-400 line-through decoration-emerald-500/40"
                      : active
                        ? "text-gray-900 dark:text-white"
                        : "text-gray-400 dark:text-gray-500"
                  }`}
                >
                  {step.label}
                  {active && <AnimatedDots />}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {step.desc}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function AnimatedDots() {
  return (
    <span className="inline-flex w-6 justify-start" aria-hidden="true">
      <span className="animate-pulse">.</span>
      <span className="animate-pulse [animation-delay:200ms]">.</span>
      <span className="animate-pulse [animation-delay:400ms]">.</span>
    </span>
  );
}
