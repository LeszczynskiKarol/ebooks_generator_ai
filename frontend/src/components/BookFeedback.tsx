import { useEffect, useState } from "react";
import { Loader2, Star, UserCheck } from "lucide-react";
import toast from "react-hot-toast";
import apiClient from "@/lib/api";
import { useT } from "@/lib/i18n";

// Finished-book feedback (backend routes/feedbackRoutes.ts):
//  - RATING: 1–5 stars, reasons at 1–3, comment, consent to publish at 4–5.
//    The form appears once the customer has downloaded the book (a rating
//    given before reading says nothing); a saved rating is always shown.
//  - CHECK BY A HUMAN: describe what to fix → the editor's queue. One open
//    request per book, a few in total (limits come from the API).

const REASONS = [
  "too_short",
  "repetitive",
  "factual",
  "style",
  "sources",
  "layout",
  "cover",
  "images",
] as const;

interface Feedback {
  rating: number;
  reasons: string[];
  comment: string | null;
  publishConsent: boolean;
  publishName: string | null;
}
interface Correction {
  id: string;
  chapterNumber: number | null;
  message: string;
  status: "open" | "in_progress" | "done" | "rejected";
  adminNote: string | null;
  createdAt: string;
}
interface State {
  feedback: Feedback | null;
  corrections: Correction[];
  correctionLimits: { max: number; used: number; open: number; canRequest: boolean };
  chapters: { chapterNumber: number; title: string }[];
}

/** DownloadPanel calls this when the customer downloads the PDF/EPUB. */
export function markBookDownloaded(projectId: string) {
  try {
    localStorage.setItem(`im-downloaded-${projectId}`, "1");
  } catch {
    /* private mode — the event below still unlocks the form for this visit */
  }
  window.dispatchEvent(new CustomEvent("im-book-downloaded", { detail: projectId }));
}

const inputCls =
  "w-full px-3 py-2.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none";
const cardCls =
  "rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/40 p-4 sm:p-5";

export default function BookFeedback({ projectId }: { projectId: string }) {
  const [state, setState] = useState<State | null>(null);

  useEffect(() => {
    let alive = true;
    apiClient
      .get(`/projects/${projectId}/feedback`)
      .then(({ data }) => alive && setState(data.data))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [projectId]);

  if (!state) return null;
  return (
    <div className="grid gap-4 lg:grid-cols-2 mt-6">
      <Rating
        projectId={projectId}
        saved={state.feedback}
        onSaved={(feedback) => setState((s) => (s ? { ...s, feedback } : s))}
      />
      <Corrections
        projectId={projectId}
        state={state}
        onChange={(next) => setState((s) => (s ? { ...s, ...next } : s))}
      />
    </div>
  );
}

// ── Rating ────────────────────────────────────────────────────────────

function Stars({
  value,
  onChange,
  size = "w-8 h-8",
}: {
  value: number;
  onChange?: (n: number) => void;
  size?: string;
}) {
  const t = useT();
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <div className="inline-flex gap-1" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!onChange}
          onMouseEnter={() => onChange && setHover(n)}
          onClick={() => onChange?.(n)}
          aria-label={t("feedback.starLabel", { n })}
          className={onChange ? "cursor-pointer transition-transform hover:scale-110" : "cursor-default"}
        >
          <Star
            className={
              size +
              " " +
              (n <= shown ? "fill-amber-400 text-amber-400" : "text-gray-300 dark:text-gray-600")
            }
          />
        </button>
      ))}
    </div>
  );
}

function Rating({
  projectId,
  saved,
  onSaved,
}: {
  projectId: string;
  saved: Feedback | null;
  onSaved: (f: Feedback | null) => void;
}) {
  const t = useT();
  const hideKey = `im-feedback-hidden-${projectId}`;
  const read = (k: string) => {
    try {
      return localStorage.getItem(k) === "1";
    } catch {
      return false;
    }
  };
  const [downloaded, setDownloaded] = useState(() => read(`im-downloaded-${projectId}`));
  const [hidden, setHidden] = useState(() => read(hideKey));
  const [editing, setEditing] = useState(false);
  const [rating, setRating] = useState(0);
  const [reasons, setReasons] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [consent, setConsent] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const on = (e: Event) => {
      if ((e as CustomEvent).detail === projectId) setDownloaded(true);
    };
    window.addEventListener("im-book-downloaded", on);
    return () => window.removeEventListener("im-book-downloaded", on);
  }, [projectId]);

  // Nothing unlocked the form and there is no earlier rating — stay silent.
  if (!saved && (!downloaded || hidden)) return null;

  const reset = () => {
    setEditing(false);
    setRating(0);
    setReasons([]);
    setComment("");
    setConsent(false);
    setName("");
  };
  const startEdit = () => {
    setRating(saved?.rating ?? 0);
    setReasons(saved?.reasons ?? []);
    setComment(saved?.comment ?? "");
    setConsent(saved?.publishConsent ?? false);
    setName(saved?.publishName ?? "");
    setEditing(true);
  };
  const send = async () => {
    if (!rating) return;
    setBusy(true);
    try {
      const { data } = await apiClient.put(`/projects/${projectId}/feedback`, {
        rating,
        reasons: rating <= 3 ? reasons : [],
        comment: comment.trim() || undefined,
        publishConsent: rating >= 4 && consent,
        publishName: rating >= 4 && consent ? name.trim() || undefined : undefined,
      });
      onSaved(data.data);
      reset();
      toast.success(t("feedback.thanks"));
    } catch {
      toast.error(t("feedback.error"));
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    setBusy(true);
    try {
      await apiClient.delete(`/projects/${projectId}/feedback`);
      onSaved(null);
      reset();
      toast.success(t("feedback.removed"));
    } catch {
      toast.error(t("feedback.error"));
    } finally {
      setBusy(false);
    }
  };
  const hide = () => {
    setHidden(true);
    try {
      localStorage.setItem(hideKey, "1");
    } catch {
      /* hidden until the end of this visit */
    }
  };

  // ── saved rating ──
  if (saved && !editing) {
    return (
      <div className={cardCls}>
        <p className="font-semibold text-gray-900 dark:text-white">{t("feedback.yourRating")}</p>
        <div className="mt-2">
          <Stars value={saved.rating} size="w-6 h-6" />
        </div>
        {saved.reasons.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {saved.reasons.map((r) => (
              <span
                key={r}
                className="px-2.5 py-1 rounded-full text-xs bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
              >
                {t(`feedback.reason.${r}`)}
              </span>
            ))}
          </div>
        )}
        {saved.comment && (
          <p className="text-sm text-gray-700 dark:text-gray-300 mt-3 whitespace-pre-wrap">{saved.comment}</p>
        )}
        {saved.publishConsent && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">{t("feedback.publishOn")}</p>
        )}
        <div className="flex gap-4 mt-4 text-sm">
          <button type="button" onClick={startEdit} className="text-primary-600 dark:text-primary-400 hover:underline cursor-pointer">
            {t("feedback.change")}
          </button>
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            className="text-gray-500 dark:text-gray-400 hover:underline cursor-pointer disabled:opacity-50"
          >
            {t("feedback.remove")}
          </button>
        </div>
      </div>
    );
  }

  // ── form ──
  return (
    <div className={cardCls}>
      <p className="font-semibold text-gray-900 dark:text-white">{t("feedback.rateTitle")}</p>
      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{t("feedback.rateText")}</p>
      <div className="mt-3">
        <Stars value={rating} onChange={setRating} />
      </div>

      {rating > 0 && (
        <div className="mt-4 space-y-3">
          {rating <= 3 && (
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t("feedback.reasonsTitle")}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {REASONS.map((r) => {
                  const on = reasons.includes(r);
                  return (
                    <button
                      key={r}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setReasons((cur) => (on ? cur.filter((x) => x !== r) : [...cur, r]))}
                      className={
                        "px-3 py-1.5 rounded-full text-sm border transition-colors cursor-pointer " +
                        (on
                          ? "bg-primary-600 border-primary-600 text-white"
                          : "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-primary-400")
                      }
                    >
                      {t(`feedback.reason.${r}`)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            maxLength={4000}
            placeholder={t("feedback.commentPlaceholder")}
            className={inputCls}
          />
          {rating >= 4 && (
            <div className="space-y-2">
              <label className="flex items-start gap-2.5 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500 cursor-pointer"
                />
                <span>{t("feedback.consent")}</span>
              </label>
              {consent && (
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={80}
                  placeholder={t("feedback.consentName")}
                  className={inputCls}
                />
              )}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 mt-4">
        <button
          type="button"
          onClick={send}
          disabled={!rating || busy}
          className="px-5 py-2.5 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors font-medium text-sm inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {busy && <Loader2 className="w-4 h-4 animate-spin" />}
          {saved ? t("feedback.update") : t("feedback.send")}
        </button>
        {saved ? (
          <button type="button" onClick={reset} className="text-sm text-gray-500 dark:text-gray-400 hover:underline cursor-pointer">
            {t("feedback.cancel")}
          </button>
        ) : (
          <button type="button" onClick={hide} className="text-sm text-gray-500 dark:text-gray-400 hover:underline cursor-pointer">
            {t("feedback.notNow")}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Check by a human ──────────────────────────────────────────────────

const STATUS_CLS: Record<Correction["status"], string> = {
  open: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  in_progress: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  done: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  rejected: "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
};

function Corrections({
  projectId,
  state,
  onChange,
}: {
  projectId: string;
  state: State;
  onChange: (next: Partial<State>) => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [chapter, setChapter] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const limits = state.correctionLimits;

  const chapterLabel = (n: number | null) => {
    if (n == null) return t("feedback.fixWhole");
    const ch = state.chapters.find((c) => c.chapterNumber === n);
    return t("feedback.fixChapter", { n, title: ch?.title ?? "" });
  };

  const send = async () => {
    if (message.trim().length < 10) {
      toast.error(t("feedback.fixTooShort"));
      return;
    }
    setBusy(true);
    try {
      const { data } = await apiClient.post(`/projects/${projectId}/corrections`, {
        message: message.trim(),
        chapterNumber: chapter === "" ? null : Number(chapter),
      });
      onChange(data.data);
      setOpen(false);
      setMessage("");
      setChapter("");
      toast.success(t("feedback.fixSent"));
    } catch (err: any) {
      toast.error(
        err.response?.data?.code === "CORRECTION_TOO_SHORT" ? t("feedback.fixTooShort") : t("feedback.error"),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cardCls}>
      <p className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
        <UserCheck className="w-5 h-5 text-primary-600 dark:text-primary-400" />
        {t("feedback.fixTitle")}
      </p>
      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{t("feedback.fixText")}</p>

      {limits.canRequest && !open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-3 px-5 py-2.5 border border-primary-600 text-primary-700 dark:text-primary-300 rounded-xl hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors font-medium text-sm cursor-pointer"
        >
          {t("feedback.fixCta")}
        </button>
      )}
      {!limits.canRequest && (
        <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
          {limits.open > 0 ? t("feedback.fixOpenInfo") : t("feedback.fixLimitInfo", { max: limits.max })}
        </p>
      )}

      {open && (
        <div className="mt-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t("feedback.fixScope")}
            </label>
            <select value={chapter} onChange={(e) => setChapter(e.target.value)} className={inputCls}>
              <option value="">{t("feedback.fixWhole")}</option>
              {state.chapters.map((c) => (
                <option key={c.chapterNumber} value={c.chapterNumber}>
                  {t("feedback.fixChapter", { n: c.chapterNumber, title: c.title })}
                </option>
              ))}
            </select>
          </div>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            maxLength={6000}
            placeholder={t("feedback.fixPlaceholder")}
            className={inputCls}
          />
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={send}
              disabled={busy}
              className="px-5 py-2.5 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors font-medium text-sm inline-flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}
              {t("feedback.fixSend")}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-sm text-gray-500 dark:text-gray-400 hover:underline cursor-pointer"
            >
              {t("feedback.cancel")}
            </button>
          </div>
        </div>
      )}

      {state.corrections.length > 0 && (
        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            {t("feedback.fixHistory")}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {t("feedback.fixLeft", { used: limits.used, max: limits.max })}
          </p>
          <ul className="mt-2 space-y-3">
            {state.corrections.map((c) => (
              <li key={c.id} className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3">
                <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <span className={"px-2 py-0.5 rounded-full font-medium " + STATUS_CLS[c.status]}>
                    {t(`feedback.status.${c.status}`)}
                  </span>
                  <span>{new Date(c.createdAt).toLocaleDateString()}</span>
                  <span>· {chapterLabel(c.chapterNumber)}</span>
                </div>
                <p className="text-sm text-gray-800 dark:text-gray-200 mt-2 whitespace-pre-wrap">{c.message}</p>
                {c.adminNote && (
                  <div className="mt-2 border-l-2 border-primary-500 pl-3">
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">{t("feedback.fixReply")}</p>
                    <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{c.adminNote}</p>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
