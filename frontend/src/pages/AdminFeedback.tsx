import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ChevronDown, Loader2, Star } from "lucide-react";
import toast from "react-hot-toast";
import apiClient from "@/lib/api";

// Admin: customer ratings + the "Check by a human" queue
// (backend routes/feedbackRoutes.ts).

type Status = "open" | "in_progress" | "done" | "rejected";

interface ProjectRef {
  id: string;
  title: string | null;
  topic: string;
  language: string;
  user: { email: string; name: string | null };
}
interface FeedbackRow {
  id: string;
  rating: number;
  reasons: string[];
  comment: string | null;
  publishConsent: boolean;
  publishName: string | null;
  createdAt: string;
  project: ProjectRef;
}
interface CorrectionRow {
  id: string;
  chapterNumber: number | null;
  chapterTitle: string | null;
  message: string;
  status: Status;
  adminNote: string | null;
  createdAt: string;
  resolvedAt: string | null;
  project: ProjectRef;
}

const STATUS_LABEL: Record<Status, string> = {
  open: "Open",
  in_progress: "In progress",
  done: "Done",
  rejected: "Rejected",
};
const STATUS_CLS: Record<Status, string> = {
  open: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  in_progress: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  done: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  rejected: "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
};

const card = "bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5";
const bookName = (p: ProjectRef) => p.title || p.topic;

function Stars({ n }: { n: number }) {
  return (
    <span className="inline-flex">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={"w-4 h-4 " + (i <= n ? "fill-amber-400 text-amber-400" : "text-gray-300 dark:text-gray-600")}
        />
      ))}
    </span>
  );
}

type Tab = "ratings" | "corrections" | "edits" | "messages";

export default function AdminFeedback() {
  const [params, setParams] = useSearchParams();
  const tabParam = params.get("tab");
  const tab: Tab =
    tabParam === "corrections" || tabParam === "edits" || tabParam === "messages" ? tabParam : "ratings";

  const ratings = useQuery({
    queryKey: ["admin-feedback"],
    queryFn: async () => (await apiClient.get("/admin/feedback")).data.data,
  });
  const corrections = useQuery({
    queryKey: ["admin-corrections"],
    queryFn: async () => (await apiClient.get("/admin/corrections")).data.data,
  });

  const edits = useQuery({
    queryKey: ["admin-ai-edits"],
    queryFn: async () => (await apiClient.get("/admin/ai-edits")).data.data,
    enabled: tab === "edits",
  });

  const messages = useQuery({
    queryKey: ["admin-contact"],
    queryFn: async () => (await apiClient.get("/admin/contact")).data.data,
  });

  const tabBtn = (key: Tab, label: string, badge?: number) => (
    <button
      type="button"
      onClick={() => setParams(key === "ratings" ? {} : { tab: key })}
      className={
        "px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer inline-flex items-center gap-2 " +
        (tab === key
          ? "bg-primary-600 text-white"
          : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700")
      }
    >
      {label}
      {badge ? (
        <span className="px-1.5 py-0.5 rounded-full text-xs bg-amber-400 text-gray-900 font-semibold">{badge}</span>
      ) : null}
    </button>
  );

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <Link to="/admin" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 mb-4">
        <ArrowLeft className="w-4 h-4" /> Admin
      </Link>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Feedback</h1>
      <p className="text-gray-500 dark:text-gray-400 mt-1">Customer ratings, correction requests, AI edits and contact messages</p>

      <div className="flex gap-2 mt-6 mb-6">
        {tabBtn("ratings", "Ratings")}
        {tabBtn("corrections", "Check by a human", corrections.data?.open)}
        {tabBtn("edits", "AI edits")}
        {tabBtn("messages", "Messages", messages.data?.open)}
      </div>

      {tab === "messages" ? (
        messages.isLoading ? (
          <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
        ) : (
          <MessagesTab rows={messages.data?.rows ?? []} />
        )
      ) : tab === "edits" ? (
        edits.isLoading ? (
          <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
        ) : (
          <EditsTab data={edits.data} />
        )
      ) : tab === "ratings" ? (
        ratings.isLoading ? (
          <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
        ) : (
          <RatingsTab data={ratings.data} />
        )
      ) : corrections.isLoading ? (
        <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
      ) : (
        <CorrectionsTab rows={corrections.data?.rows ?? []} />
      )}
    </div>
  );
}

function RatingsTab({ data }: { data: any }) {
  const [filter, setFilter] = useState<number | "publish" | null>(null);
  const rows: FeedbackRow[] = data?.rows ?? [];
  const stats = data?.stats;
  const shown = rows.filter((r) =>
    filter == null ? true : filter === "publish" ? r.publishConsent : r.rating === filter,
  );
  const reasons = Object.entries((stats?.byReason ?? {}) as Record<string, number>).sort((a, b) => b[1] - a[1]);
  const chip = (active: boolean) =>
    "px-3 py-1.5 rounded-full text-sm border cursor-pointer transition-colors " +
    (active
      ? "bg-primary-600 border-primary-600 text-white"
      : "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300");

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <div className={card}>
          <p className="text-sm text-gray-500 dark:text-gray-400">Average</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">
            {stats?.avg != null ? stats.avg.toFixed(2) : "–"}
            <span className="text-base font-normal text-gray-500"> / 5 · {stats?.count ?? 0} ratings</span>
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            {stats?.publishable ?? 0} with consent to publish
          </p>
        </div>
        <div className={card}>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">By rating</p>
          {[5, 4, 3, 2, 1].map((n) => (
            <div key={n} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <Stars n={n} />
              <span className="tabular-nums">{stats?.byRating?.[n] ?? 0}</span>
            </div>
          ))}
        </div>
        <div className={card}>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Reasons at 1–3 stars</p>
          {reasons.length === 0 ? (
            <p className="text-sm text-gray-500">None yet</p>
          ) : (
            reasons.map(([k, v]) => (
              <div key={k} className="flex justify-between text-sm text-gray-700 dark:text-gray-300">
                <span>{k}</span>
                <span className="tabular-nums">{v}</span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" className={chip(filter == null)} onClick={() => setFilter(null)}>All</button>
        {[5, 4, 3, 2, 1].map((n) => (
          <button key={n} type="button" className={chip(filter === n)} onClick={() => setFilter(n)}>
            {n} ★
          </button>
        ))}
        <button type="button" className={chip(filter === "publish")} onClick={() => setFilter("publish")}>
          Publishable
        </button>
      </div>

      <div className="space-y-3">
        {shown.length === 0 && <p className="text-gray-500">No ratings.</p>}
        {shown.map((r) => (
          <div key={r.id} className={card}>
            <div className="flex flex-wrap items-center gap-3">
              <Stars n={r.rating} />
              <Link to={`/admin/projects/${r.project.id}`} className="font-semibold text-gray-900 dark:text-white hover:underline">
                {bookName(r.project)}
              </Link>
              <span className="text-xs text-gray-500">{r.project.language}</span>
              {r.publishConsent && (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300">
                  May publish{r.publishName ? `: ${r.publishName}` : ""}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {r.project.user.email} · {new Date(r.createdAt).toLocaleString()}
            </p>
            {r.reasons.length > 0 && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">Reasons: {r.reasons.join(", ")}</p>
            )}
            {r.comment && (
              <p className="text-sm text-gray-800 dark:text-gray-200 mt-2 whitespace-pre-wrap">{r.comment}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function CorrectionsTab({ rows }: { rows: CorrectionRow[] }) {
  return (
    <div className="space-y-3">
      {rows.length === 0 && <p className="text-gray-500">No requests.</p>}
      {rows.map((r) => (
        <CorrectionCard key={r.id} row={r} />
      ))}
    </div>
  );
}

function CorrectionCard({ row }: { row: CorrectionRow }) {
  const qc = useQueryClient();
  const [note, setNote] = useState(row.adminNote ?? "");
  const [busy, setBusy] = useState(false);
  const closed = row.status === "done" || row.status === "rejected";

  const save = async (status: Status) => {
    // Closing e-mails the customer — make sure it is meant.
    if ((status === "done" || status === "rejected") && !closed) {
      if (!window.confirm(`Close as "${STATUS_LABEL[status]}" and e-mail the customer?`)) return;
    }
    setBusy(true);
    try {
      await apiClient.patch(`/admin/corrections/${row.id}`, { status, adminNote: note });
      await qc.invalidateQueries({ queryKey: ["admin-corrections"] });
      toast.success("Saved");
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed");
    } finally {
      setBusy(false);
    }
  };

  const btn =
    "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer disabled:opacity-50 ";
  return (
    <div className={card}>
      <div className="flex flex-wrap items-center gap-3">
        <span className={"px-2 py-0.5 rounded-full text-xs font-medium " + STATUS_CLS[row.status]}>
          {STATUS_LABEL[row.status]}
        </span>
        <Link to={`/admin/projects/${row.project.id}`} className="font-semibold text-gray-900 dark:text-white hover:underline">
          {bookName(row.project)}
        </Link>
        <Link to={`/projects/${row.project.id}`} className="text-xs text-primary-600 dark:text-primary-400 hover:underline">
          customer view
        </Link>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
        {row.project.user.email} · {new Date(row.createdAt).toLocaleString()} ·{" "}
        {row.chapterNumber != null ? `Chapter ${row.chapterNumber}: ${row.chapterTitle ?? ""}` : "Whole book"} ·{" "}
        {row.project.language}
      </p>
      <p className="text-sm text-gray-800 dark:text-gray-200 mt-3 whitespace-pre-wrap">{row.message}</p>

      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={3}
        placeholder="Reply to the customer (e-mailed when you close the request)"
        className="mt-3 w-full px-3 py-2.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500"
      />
      <div className="flex flex-wrap items-center gap-2 mt-3">
        {busy && <Loader2 className="w-4 h-4 animate-spin text-primary-600" />}
        {!closed && row.status !== "in_progress" && (
          <button type="button" disabled={busy} onClick={() => save("in_progress")} className={btn + "bg-blue-600 text-white hover:bg-blue-700"}>
            Take (in progress)
          </button>
        )}
        {!closed && (
          <>
            <button type="button" disabled={busy} onClick={() => save("done")} className={btn + "bg-green-600 text-white hover:bg-green-700"}>
              Done + e-mail
            </button>
            <button type="button" disabled={busy} onClick={() => save("rejected")} className={btn + "bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300"}>
              Reject + e-mail
            </button>
          </>
        )}
        <button type="button" disabled={busy} onClick={() => save(row.status)} className={btn + "border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300"}>
          Save note
        </button>
        {closed && (
          <button type="button" disabled={busy} onClick={() => save("open")} className={btn + "text-gray-500 hover:underline"}>
            Reopen
          </button>
        )}
      </div>
    </div>
  );
}

// ── AI edits ──────────────────────────────────────────────────────────

type EditStatus = "running" | "preview" | "accepted" | "rejected" | "reverted" | "failed";

interface EditRow {
  id: string;
  scopeLabel: string;
  prompt: string;
  status: EditStatus;
  error: string | null;
  costUsd: number;
  gateResult: { wordsBefore: number; wordsAfter: number; footnotesBefore: number; footnotesAfter: number; violations?: string[] } | null;
  createdAt: string;
  project: ProjectRef;
}
interface EditDetail {
  diff: { type: "same" | "added" | "removed"; text: string }[] | null;
  before: string[] | null;
}

const EDIT_LABEL: Record<EditStatus, string> = {
  running: "Running",
  preview: "Waiting for customer",
  accepted: "Accepted",
  rejected: "Rejected",
  reverted: "Reverted",
  failed: "Failed (not counted)",
};
const EDIT_CLS: Record<EditStatus, string> = {
  running: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  preview: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  accepted: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  rejected: "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
  reverted: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
  failed: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
};

function EditsTab({ data }: { data: any }) {
  const [filter, setFilter] = useState<EditStatus | null>(null);
  const rows: EditRow[] = data?.rows ?? [];
  const stats = data?.stats;
  const shown = filter ? rows.filter((r) => r.status === filter) : rows;
  const n = (s: EditStatus) => stats?.byStatus?.[s] ?? 0;
  const chip = (active: boolean) =>
    "px-3 py-1.5 rounded-full text-sm border cursor-pointer transition-colors " +
    (active
      ? "bg-primary-600 border-primary-600 text-white"
      : "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300");

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <div className={card}>
          <p className="text-sm text-gray-500 dark:text-gray-400">Edits</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{stats?.count ?? 0}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            {n("accepted")} accepted · {n("rejected")} rejected · {n("reverted")} reverted
          </p>
        </div>
        <div className={card}>
          <p className="text-sm text-gray-500 dark:text-gray-400">Failed</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{n("failed")}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            {n("running") + n("preview")} in flight
          </p>
        </div>
        <div className={card}>
          <p className="text-sm text-gray-500 dark:text-gray-400">Model cost</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">${(stats?.costUsd ?? 0).toFixed(2)}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            {stats?.count ? `$${((stats.costUsd ?? 0) / stats.count).toFixed(4)} per edit` : "no edits yet"}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" className={chip(filter == null)} onClick={() => setFilter(null)}>All</button>
        {(Object.keys(EDIT_LABEL) as EditStatus[]).map((s) => (
          <button key={s} type="button" className={chip(filter === s)} onClick={() => setFilter(s)}>
            {EDIT_LABEL[s]} ({n(s)})
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {shown.length === 0 && <p className="text-gray-500">No AI edits.</p>}
        {shown.map((r) => (
          <EditCard key={r.id} row={r} />
        ))}
      </div>
    </div>
  );
}

function EditCard({ row }: { row: EditRow }) {
  const [open, setOpen] = useState(false);
  const detail = useQuery<EditDetail>({
    queryKey: ["admin-ai-edit", row.id],
    queryFn: async () => (await apiClient.get(`/admin/ai-edits/${row.id}`)).data.data,
    enabled: open,
  });
  const g = row.gateResult;
  return (
    <div className={card}>
      <div className="flex flex-wrap items-center gap-3">
        <span className={"px-2 py-0.5 rounded-full text-xs font-medium " + EDIT_CLS[row.status]}>
          {EDIT_LABEL[row.status]}
        </span>
        <Link to={`/admin/projects/${row.project.id}`} className="font-semibold text-gray-900 dark:text-white hover:underline">
          {bookName(row.project)}
        </Link>
        <span className="text-xs text-gray-500">{row.project.language}</span>
        <span className="text-xs text-gray-500 tabular-nums">${row.costUsd.toFixed(4)}</span>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
        {row.project.user.email} · {new Date(row.createdAt).toLocaleString()} · {row.scopeLabel}
      </p>
      <p className="text-sm text-gray-800 dark:text-gray-200 mt-3 whitespace-pre-wrap">{row.prompt}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
        {g ? `${g.wordsBefore} → ${g.wordsAfter} words · footnotes ${g.footnotesBefore} → ${g.footnotesAfter}` : "no measurements"}
        {row.error ? ` · reason: ${row.error}` : ""}
      </p>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mt-3 inline-flex items-center gap-1 text-sm text-primary-600 dark:text-primary-400 hover:underline cursor-pointer"
      >
        <ChevronDown className={"w-4 h-4 transition-transform " + (open ? "rotate-180" : "")} />
        {open ? "Hide the change" : "Show the change"}
      </button>
      {open && (
        <div className="mt-3 max-h-[32rem] overflow-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 p-3 space-y-2 text-sm leading-relaxed">
          {detail.isLoading && <Loader2 className="w-5 h-5 animate-spin text-primary-600" />}
          {detail.data?.diff?.map((d, i) => (
            <p
              key={i}
              className={
                d.type === "removed"
                  ? "px-2 py-1 rounded bg-red-50 dark:bg-red-900/25 text-red-900 dark:text-red-200 line-through decoration-red-400/70"
                  : d.type === "added"
                    ? "px-2 py-1 rounded bg-green-50 dark:bg-green-900/25 text-green-900 dark:text-green-100"
                    : "px-2 py-1 text-gray-500 dark:text-gray-500"
              }
            >
              {d.text}
            </p>
          ))}
          {detail.data && !detail.data.diff && (
            <>
              <p className="text-xs text-gray-500">No result was kept for this edit. The passage it was aimed at:</p>
              {(detail.data.before ?? []).map((t, i) => (
                <p key={i} className="px-2 py-1 text-gray-700 dark:text-gray-300">{t}</p>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Contact form messages ─────────────────────────────────────────────

interface ContactRow {
  id: string;
  name: string | null;
  email: string;
  topic: string;
  message: string;
  lang: string;
  country: string | null;
  flags: string[];
  handled: boolean;
  createdAt: string;
}

function MessagesTab({ rows }: { rows: ContactRow[] }) {
  const qc = useQueryClient();
  const [onlyOpen, setOnlyOpen] = useState(true);
  const shown = onlyOpen ? rows.filter((r) => !r.handled) : rows;
  const toggle = async (r: ContactRow) => {
    try {
      await apiClient.patch(`/admin/contact/${r.id}`, { handled: !r.handled });
      await qc.invalidateQueries({ queryKey: ["admin-contact"] });
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed");
    }
  };
  return (
    <div className="space-y-3">
      <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
        <input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} />
        Only not handled
      </label>
      {shown.length === 0 && <p className="text-gray-500">No messages.</p>}
      {shown.map((r) => (
        <div key={r.id} className={card}>
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={
                "px-2 py-0.5 rounded-full text-xs font-medium " +
                (r.handled
                  ? "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                  : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300")
              }
            >
              {r.handled ? "Handled" : "New"}
            </span>
            <span className="font-semibold text-gray-900 dark:text-white">{r.name || r.email}</span>
            <span className="text-xs text-gray-500">{r.topic}</span>
            {r.flags.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300">
                check: {r.flags.join(", ")}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {r.email} · {new Date(r.createdAt).toLocaleString()} · {r.lang}
            {r.country ? ` · ${r.country}` : ""}
          </p>
          <p className="text-sm text-gray-800 dark:text-gray-200 mt-3 whitespace-pre-wrap">{r.message}</p>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <a
              href={`mailto:${r.email}?subject=${encodeURIComponent("Re: InkMagnet")}`}
              className="px-3 py-1.5 rounded-lg text-sm font-medium bg-primary-600 text-white hover:bg-primary-700"
            >
              Reply by e-mail
            </a>
            <button
              type="button"
              onClick={() => toggle(r)}
              className="px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 cursor-pointer"
            >
              {r.handled ? "Mark as new" : "Mark as handled"}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
