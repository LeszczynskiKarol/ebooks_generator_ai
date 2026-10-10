import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Sparkles, Undo2 } from "lucide-react";
import toast from "react-hot-toast";
import apiClient from "@/lib/api";
import { useT } from "@/lib/i18n";

// AI edit of a finished book (backend routes/aiEditRoutes.ts): pick a chapter
// or one section, say what to change, read the preview, keep it or discard it.
// The book does not change until the customer accepts; the last accepted edit
// can be undone. The edit itself runs for 1–2 minutes — we poll.

interface DiffBlock {
  type: "same" | "added" | "removed";
  text: string;
}
interface Gate {
  wordsBefore: number;
  wordsAfter: number;
  footnotesBefore: number;
  footnotesAfter: number;
}
interface Job {
  id: string;
  chapterNumber: number;
  sectionIndex: number | null;
  scopeLabel: string;
  prompt: string;
  status: "running" | "preview" | "accepted" | "rejected" | "reverted" | "failed";
  error: string | null;
  createdAt: string;
}
interface State {
  limit: number;
  used: number;
  remaining: number;
  maxFragment: number;
  available: boolean;
  active: (Job & { preview: { diff: DiffBlock[]; gate: Gate | null } | null }) | null;
  revertableId: string | null;
  history: Job[];
  scopes: {
    chapterNumber: number;
    title: string;
    chars: number;
    sections: { index: number; title: string; chars: number }[];
  }[];
}

const inputCls =
  "w-full px-3 py-2.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none";
const labelCls = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1";

const failKey = (error: string | null) => {
  if (!error) return "aiEdit.fail.other";
  if (error.startsWith("gate:")) return "aiEdit.fail.gate";
  if (["unchanged", "truncated", "chapter_changed"].includes(error)) return `aiEdit.fail.${error}`;
  return "aiEdit.fail.other";
};

export default function BookAiEdit({
  projectId,
  unsavedChanges,
  onBookChanged,
}: {
  projectId: string;
  /** unsaved edits in the chapter editor — an AI edit works on the SAVED text */
  unsavedChanges: number;
  /** an edit was applied or undone: the book is being rebuilt */
  onBookChanged: () => void;
}) {
  const t = useT();
  const [state, setState] = useState<State | null>(null);
  const [chapter, setChapter] = useState<number | null>(null);
  const [section, setSection] = useState<string>("");
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [showSame, setShowSame] = useState(false);
  const timer = useRef<number | null>(null);

  const load = useCallback(async () => {
    try {
      const { data } = await apiClient.get(`/projects/${projectId}/ai-edit`);
      setState(data.data);
    } catch {
      /* the card simply stays hidden */
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Poll while the edit is being made.
  const running = state?.active?.status === "running";
  useEffect(() => {
    if (!running) return;
    timer.current = window.setInterval(load, 5000);
    return () => {
      if (timer.current) window.clearInterval(timer.current);
    };
  }, [running, load]);

  if (!state || state.scopes.length === 0) return null;

  const errorText = (err: any) => {
    const code = err?.response?.data?.code;
    const key = `aiEdit.err.${code}`;
    const msg = t(key);
    return msg === key ? t("aiEdit.err.other") : msg;
  };

  const currentChapter = state.scopes.find((c) => c.chapterNumber === (chapter ?? state.scopes[0].chapterNumber))!;
  const scopeChars =
    section === ""
      ? currentChapter.chars
      : currentChapter.sections.find((s) => String(s.index) === section)?.chars ?? currentChapter.chars;
  const tooLarge = scopeChars > state.maxFragment;

  const start = async () => {
    if (prompt.trim().length < 5) {
      toast.error(t("aiEdit.err.PROMPT_TOO_SHORT"));
      return;
    }
    setBusy(true);
    try {
      const { data } = await apiClient.post(`/projects/${projectId}/ai-edit`, {
        chapterNumber: currentChapter.chapterNumber,
        sectionIndex: section === "" ? null : Number(section),
        prompt: prompt.trim(),
      });
      setState(data.data);
      setPrompt("");
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const decide = async (action: "accept" | "reject" | "revert", jobId: string) => {
    if (action === "revert" && !window.confirm(t("aiEdit.revertConfirm"))) return;
    setBusy(true);
    try {
      const { data } = await apiClient.post(`/projects/${projectId}/ai-edit/${jobId}/${action}`);
      setState(data.data);
      toast.success(t(action === "accept" ? "aiEdit.accepted" : action === "reject" ? "aiEdit.rejected" : "aiEdit.reverted"));
      if (action !== "reject") onBookChanged();
    } catch (err) {
      toast.error(errorText(err));
      void load();
    } finally {
      setBusy(false);
    }
  };

  const active = state.active;
  const lastJob = state.history[0];
  const lastFailed = !active && lastJob?.status === "failed" ? lastJob : null;
  const changed = active?.preview?.diff.filter((d) => d.type !== "same") ?? [];
  const sameCount = (active?.preview?.diff.length ?? 0) - changed.length;

  return (
    <div className="rounded-xl border border-primary-100 dark:border-primary-900 bg-primary-50/50 dark:bg-primary-950/20 p-4 sm:p-5 mt-6">
      <p className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-primary-600 dark:text-primary-400" />
        {t("aiEdit.title")}
      </p>
      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{t("aiEdit.text")}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
        {t("aiEdit.left", { n: state.remaining, max: state.limit })}
      </p>

      {/* ── running ── */}
      {active?.status === "running" && (
        <div className="flex items-start gap-3 mt-4">
          <Loader2 className="w-6 h-6 animate-spin text-primary-600 shrink-0" />
          <div>
            <p className="font-semibold text-gray-900 dark:text-white">{t("aiEdit.running")}</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">{t("aiEdit.runningText")}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{active.scopeLabel}</p>
          </div>
        </div>
      )}

      {/* ── preview ── */}
      {active?.status === "preview" && active.preview && (
        <div className="mt-4">
          <p className="font-semibold text-gray-900 dark:text-white">{t("aiEdit.previewTitle")}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t("aiEdit.previewScope", { s: active.scopeLabel })}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{t("aiEdit.previewPrompt", { s: active.prompt })}</p>
          {active.preview.gate && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t("aiEdit.stats", { before: active.preview.gate.wordsBefore, after: active.preview.gate.wordsAfter })}
              {active.preview.gate.footnotesBefore > 0 &&
                " · " +
                  t("aiEdit.statsFootnotes", {
                    before: active.preview.gate.footnotesBefore,
                    after: active.preview.gate.footnotesAfter,
                  })}
            </p>
          )}
          <div className="flex items-center gap-4 mt-3 text-xs text-gray-600 dark:text-gray-400">
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-sm bg-red-200 dark:bg-red-900/60" /> {t("aiEdit.legendRemoved")}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-sm bg-green-200 dark:bg-green-900/60" /> {t("aiEdit.legendAdded")}
            </span>
            {sameCount > 0 && (
              <button
                type="button"
                onClick={() => setShowSame((v) => !v)}
                className="text-primary-600 dark:text-primary-400 hover:underline cursor-pointer"
              >
                {showSame ? t("aiEdit.hideUnchanged") : t("aiEdit.showUnchanged")}
              </button>
            )}
          </div>
          <div className="mt-2 max-h-[28rem] overflow-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 space-y-2 text-sm leading-relaxed">
            {collapse(active.preview.diff, showSame).map((d, i) =>
              d.type === "gap" ? (
                <p key={i} className="text-xs text-center text-gray-400 dark:text-gray-500 py-1">
                  ⋯ {t("aiEdit.unchangedCount", { n: d.count })} ⋯
                </p>
              ) : (
                <p
                  key={i}
                  className={
                    d.type === "removed"
                      ? "px-2 py-1 rounded bg-red-50 dark:bg-red-900/25 text-red-900 dark:text-red-200 line-through decoration-red-400/70"
                      : d.type === "added"
                        ? "px-2 py-1 rounded bg-green-50 dark:bg-green-900/25 text-green-900 dark:text-green-100"
                        : "px-2 py-1 text-gray-600 dark:text-gray-400"
                  }
                >
                  {d.text}
                </p>
              ),
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-4">
            <button
              type="button"
              disabled={busy}
              onClick={() => decide("accept", active.id)}
              className="px-5 py-2.5 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors font-medium text-sm inline-flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}
              {t("aiEdit.accept")}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => decide("reject", active.id)}
              className="px-5 py-2.5 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors font-medium text-sm disabled:opacity-50 cursor-pointer"
            >
              {t("aiEdit.reject")}
            </button>
          </div>
        </div>
      )}

      {/* ── form ── */}
      {!active && state.remaining > 0 && (
        <div className="mt-4 space-y-3">
          {lastFailed && (
            <div className="rounded-lg border border-amber-200 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-900/20 p-3 text-sm">
              <p className="font-medium text-gray-900 dark:text-white">{t("aiEdit.failedTitle")}</p>
              <p className="text-gray-700 dark:text-gray-300 mt-0.5">{t(failKey(lastFailed.error))}</p>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls}>{t("aiEdit.scopeChapter")}</label>
              <select
                value={currentChapter.chapterNumber}
                onChange={(e) => {
                  setChapter(Number(e.target.value));
                  setSection("");
                }}
                className={inputCls}
              >
                {state.scopes.map((c) => (
                  <option key={c.chapterNumber} value={c.chapterNumber}>
                    {t("aiEdit.chapterOption", { n: c.chapterNumber, title: c.title })}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>{t("aiEdit.scopeSection")}</label>
              <select value={section} onChange={(e) => setSection(e.target.value)} className={inputCls}>
                <option value="">
                  {t("aiEdit.wholeChapter")}
                  {currentChapter.chars > state.maxFragment ? " " + t("aiEdit.tooLarge") : ""}
                </option>
                {currentChapter.sections.map((s) => (
                  <option key={s.index} value={s.index}>
                    {s.title}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>{t("aiEdit.promptLabel")}</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder={t("aiEdit.promptPlaceholder")}
              className={inputCls}
            />
          </div>
          {unsavedChanges > 0 && (
            <p className="text-sm text-amber-700 dark:text-amber-400">{t("aiEdit.unsaved")}</p>
          )}
          {tooLarge && <p className="text-sm text-amber-700 dark:text-amber-400">{t("aiEdit.err.SCOPE_TOO_LARGE")}</p>}
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={start}
              disabled={busy || unsavedChanges > 0 || tooLarge || !state.available}
              className="px-5 py-2.5 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors font-medium text-sm inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {t("aiEdit.start")}
            </button>
          </div>
        </div>
      )}
      {!active && state.remaining === 0 && (
        <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">{t("aiEdit.noneLeft", { max: state.limit })}</p>
      )}

      {/* ── undo + history ── */}
      {!active && state.revertableId && (
        <button
          type="button"
          disabled={busy}
          onClick={() => decide("revert", state.revertableId!)}
          className="mt-4 text-sm text-gray-600 dark:text-gray-400 hover:underline inline-flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
        >
          <Undo2 className="w-4 h-4" /> {t("aiEdit.revert")}
        </button>
      )}
      {state.history.filter((j) => j.id !== active?.id).length > 0 && (
        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            {t("aiEdit.history")}
          </p>
          <ul className="mt-2 space-y-1.5">
            {state.history
              .filter((j) => j.id !== active?.id)
              .slice(0, 6)
              .map((j) => (
                <li key={j.id} className="text-sm text-gray-700 dark:text-gray-300">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {t(`aiEdit.status.${j.status}`)} · {j.scopeLabel}
                  </span>
                  <br />
                  {j.prompt}
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Hide runs of unchanged paragraphs behind a "⋯ N unchanged ⋯" line. */
function collapse(
  diff: DiffBlock[],
  showSame: boolean,
): Array<DiffBlock | { type: "gap"; count: number }> {
  if (showSame) return diff;
  const out: Array<DiffBlock | { type: "gap"; count: number }> = [];
  let run = 0;
  const flush = () => {
    if (run > 0) out.push({ type: "gap", count: run });
    run = 0;
  };
  for (const d of diff) {
    if (d.type === "same") run++;
    else {
      flush();
      out.push(d);
    }
  }
  flush();
  return out;
}
