// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// InkMagnet — Heading numbering settings
// "Auto" = the author brief's decision; any other value pins a scheme on
// the project. Saved via PATCH /projects/:id/title-page (same endpoint as
// the other book-level settings); takes effect on the next recompile.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { useEffect, useState } from "react";
import { Hash, Loader2, Check, Save } from "lucide-react";
import toast from "react-hot-toast";
import apiClient from "@/lib/api";
import { useT } from "@/lib/i18n";
import {
  NUMBERING_MODES,
  type NumberingMode,
  type NumberingSpec,
} from "@/lib/numbering";

interface Props {
  projectId: string;
  /** Effective scheme as computed by the API (brief + override) */
  numbering: NumberingSpec;
  /** Raw override stored on the project (null = auto) */
  numberingMode: string | null | undefined;
  numberingLabel: string | null | undefined;
  onSaved: () => void;
}

const EXAMPLES: Record<NumberingMode, string> = {
  hierarchical: "1. → 1.1. → 1.1.1.",
  chapters: "1. → ••• → •••",
  none: "••• → ••• → •••",
  items: "1. → ••• → {label} 52",
};

export default function NumberingSettings({
  projectId,
  numbering,
  numberingMode,
  numberingLabel,
  onSaved,
}: Props) {
  const t = useT();
  const [mode, setMode] = useState<"auto" | NumberingMode>(
    (numberingMode as NumberingMode) || "auto",
  );
  const [label, setLabel] = useState(numberingLabel || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setMode((numberingMode as NumberingMode) || "auto");
    setLabel(numberingLabel || "");
  }, [numberingMode, numberingLabel]);

  const effectiveMode: NumberingMode = mode === "auto" ? numbering.mode : mode;
  const effectiveLabel =
    label.trim() || numbering.itemLabel || t("titlePage.numberingItemDefault");
  const dirty =
    mode !== ((numberingMode as NumberingMode) || "auto") ||
    (label || "") !== (numberingLabel || "");

  const save = async () => {
    setSaving(true);
    try {
      await apiClient.patch(`/projects/${projectId}/title-page`, {
        numberingMode: mode === "auto" ? null : mode,
        numberingLabel: effectiveMode === "items" ? label.trim() : "",
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      toast.success(t("titlePage.numberingSaved"));
      onSaved();
    } catch (err: any) {
      toast.error(err.response?.data?.error || t("titlePage.numberingSaveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const modeLabel = (m: "auto" | NumberingMode) =>
    m === "auto"
      ? `${t("titlePage.numberingAuto")} (${t(`titlePage.numbering_${numbering.mode}`)})`
      : t(`titlePage.numbering_${m}`);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="flex items-center gap-2 font-semibold text-gray-900 dark:text-white">
          <Hash className="w-4 h-4 text-primary-600" />
          {t("titlePage.numberingHeading")}
        </h3>
        <button
          onClick={save}
          disabled={!dirty || saving}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40 hover:bg-primary-700 transition-colors"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : saved ? (
            <Check className="w-4 h-4" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {t("titlePage.numberingSave")}
        </button>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        {t("titlePage.numberingIntro")}
      </p>

      <div className="grid gap-2 sm:grid-cols-2">
        {(["auto", ...NUMBERING_MODES] as const).map((m) => {
          const active = mode === m;
          const shown: NumberingMode = m === "auto" ? numbering.mode : m;
          return (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`text-left rounded-xl border px-4 py-3 transition-colors ${
                active
                  ? "border-primary-500 bg-primary-50 dark:bg-primary-950/30"
                  : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-sm text-gray-900 dark:text-white">
                  {modeLabel(m)}
                </span>
                <span className="font-mono text-[11px] text-gray-400 whitespace-nowrap">
                  {EXAMPLES[shown].replace("{label}", effectiveLabel)}
                </span>
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {t(`titlePage.numbering_${m}_desc`)}
              </p>
            </button>
          );
        })}
      </div>

      {effectiveMode === "items" && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="text-sm text-gray-700 dark:text-gray-300">
            {t("titlePage.numberingItemLabel")}
          </label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={numbering.itemLabel || t("titlePage.numberingItemDefault")}
            maxLength={40}
            className="w-48 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm text-gray-900 dark:text-white"
          />
          <span className="text-xs text-gray-400">
            {t("titlePage.numberingItemHint")}
          </span>
        </div>
      )}

      <p className="mt-3 text-xs text-gray-400">
        {numbering.source === "brief"
          ? t("titlePage.numberingFromBrief")
          : numbering.source === "project"
            ? t("titlePage.numberingFromProject")
            : t("titlePage.numberingFromDefault")}{" "}
        · {t("titlePage.recompileHint")}
      </p>
    </div>
  );
}
