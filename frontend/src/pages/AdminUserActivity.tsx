// Admin: one user's activity — who they are, where they came from, and a
// day-by-day timeline of everything we store (signup, funnel steps, projects,
// payments, previews, Play purchases, auth e-mails, notifications).
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Loader2,
  UserPlus,
  MousePointerClick,
  BookPlus,
  CreditCard,
  Cog,
  BookCheck,
  Eye,
  Smartphone,
  Mail,
  Bell,
  Activity,
} from "lucide-react";
import apiClient from "@/lib/api";

interface Item {
  at: string;
  kind: string;
  label: string;
  detail?: string | null;
  projectId?: string | null;
}

const ICON: Record<string, any> = {
  signup: UserPlus,
  funnel: MousePointerClick,
  project: BookPlus,
  paid: CreditCard,
  generation: Cog,
  version: BookCheck,
  preview: Eye,
  play: Smartphone,
  auth: Mail,
  notification: Bell,
};
const TONE: Record<string, string> = {
  signup: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
  paid: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  version: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  project: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
  preview: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
};

// funnel event → readable Polish label
const FUNNEL_LABEL: Record<string, string> = {
  dashboard_empty: "Pusty panel (brak książek)",
  new_project_open: "Otworzył formularz nowej książki",
  new_project_abandon: "Opuścił formularz",
  look_opened: "Otworzył wybór wyglądu",
  new_project_filled: "Wypełnił formularz",
  preview_requested: "Poprosił o darmowy plan",
  preview_edit: "Edytował plan",
  preview_shown: "Zobaczył plan",
  preview_regenerate: "Poprosił o nową wersję planu",
  sample_requested: "Poprosił o próbkę stron",
  checkout_start: "Przeszedł do płatności",
  checkout_created: "Otworzył stronę płatności Stripe",
};

const fmtTime = (s: string) => new Date(s).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
const fmtDay = (s: string) =>
  new Date(s).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const fmtDateTime = (s: string) =>
  new Date(s).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

// abandon/filled meta: show the useful bits, not raw JSON
function funnelDetail(detail?: string | null) {
  if (!detail) return null;
  try {
    const m = JSON.parse(detail);
    const parts: string[] = [];
    if (m.tier) parts.push(m.tier);
    if (m.pages) parts.push(`${m.pages} str.`);
    if (m.priceUsdCents) parts.push(`$${(m.priceUsdCents / 100).toFixed(2)}`);
    if (typeof m.seconds === "number") parts.push(`${m.seconds >= 60 ? Math.round(m.seconds / 60) + " min" : m.seconds + " s"} w formularzu`);
    if (m.filled === false) parts.push("niewypełniony");
    return parts.join(" · ") || null;
  } catch {
    return detail;
  }
}

export default function AdminUserActivity() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-user-activity", id],
    queryFn: async () => (await apiClient.get(`/admin/users/${id}/activity`)).data.data,
    refetchInterval: 30_000,
  });

  if (isLoading || !data)
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );

  const u = data.user;
  const timeline: Item[] = data.timeline;
  const days: { day: string; items: Item[] }[] = [];
  for (const it of timeline) {
    const d = fmtDay(it.at);
    const last = days[days.length - 1];
    if (last && last.day === d) last.items.push(it);
    else days.push({ day: d, items: [it] });
  }
  const minsSinceActive = u.lastActiveAt ? Math.round((Date.now() - new Date(u.lastActiveAt).getTime()) / 60000) : null;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <Link to="/admin/users" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 dark:hover:text-gray-200">
        <ArrowLeft className="w-4 h-4" /> Użytkownicy
      </Link>

      {/* karta użytkownika */}
      <div className="mt-4 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{u.name || u.email}</h1>
            <p className="text-sm text-gray-500">{u.email}</p>
          </div>
          {minsSinceActive !== null && minsSinceActive < 15 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
              <Activity className="w-3.5 h-3.5" /> aktywny {minsSinceActive} min temu
            </span>
          )}
        </div>
        <dl className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div><dt className="text-gray-400 text-xs uppercase tracking-wide">Rejestracja</dt><dd className="mt-1 text-gray-800 dark:text-gray-200">{fmtDateTime(u.createdAt)}</dd></div>
          <div><dt className="text-gray-400 text-xs uppercase tracking-wide">Ostatnia aktywność</dt><dd className="mt-1 text-gray-800 dark:text-gray-200">{u.lastActiveAt ? fmtDateTime(u.lastActiveAt) : "—"}</dd></div>
          <div><dt className="text-gray-400 text-xs uppercase tracking-wide">Skąd</dt><dd className="mt-1 text-gray-800 dark:text-gray-200">{[u.signupCountry, u.source].filter(Boolean).join(" · ") || "—"}</dd></div>
          <div><dt className="text-gray-400 text-xs uppercase tracking-wide">Konto</dt><dd className="mt-1 text-gray-800 dark:text-gray-200">{u.google ? "Google" : "e-mail"}{u.verified ? " · zweryfikowane" : " · niezweryfikowane"}</dd></div>
          <div><dt className="text-gray-400 text-xs uppercase tracking-wide">Książki</dt><dd className="mt-1 text-gray-800 dark:text-gray-200">{u.projects} (opłacone: {u.paid})</dd></div>
          <div><dt className="text-gray-400 text-xs uppercase tracking-wide">Darmowe podglądy</dt><dd className="mt-1 text-gray-800 dark:text-gray-200">{u.previews} · ${u.previewCost.toFixed(3)}</dd></div>
          <div className="col-span-2"><dt className="text-gray-400 text-xs uppercase tracking-wide">Strona wejścia</dt><dd className="mt-1 text-gray-800 dark:text-gray-200 break-all">{u.signupLanding || "—"}</dd></div>
        </dl>
        {u.signupUserAgent && <p className="mt-4 text-xs text-gray-400 break-all">{u.signupUserAgent}</p>}
      </div>

      {/* oś czasu */}
      <h2 className="mt-8 mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">Aktywność</h2>
      {days.map((d) => (
        <div key={d.day} className="mb-6">
          <div className="text-xs font-semibold text-gray-500 mb-2 capitalize">{d.day}</div>
          <ol className="relative border-l border-gray-200 dark:border-gray-800 ml-3">
            {d.items.map((it, i) => {
              const Icon = ICON[it.kind] ?? Activity;
              const label = it.kind === "funnel" ? FUNNEL_LABEL[it.label] ?? it.label : it.label;
              const detail = it.kind === "funnel" ? funnelDetail(it.detail) : it.detail;
              return (
                <li key={i} className="ml-6 mb-3">
                  <span className={`absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-white dark:ring-gray-950 ${TONE[it.kind] ?? "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"}`}>
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-xs tabular-nums text-gray-400">{fmtTime(it.at)}</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{label}</span>
                    {it.projectId && (
                      <Link to={`/admin/projects/${it.projectId}`} className="text-xs text-indigo-600 hover:underline">projekt</Link>
                    )}
                  </div>
                  {detail && <p className="text-xs text-gray-500 mt-0.5 break-words">{detail}</p>}
                </li>
              );
            })}
          </ol>
        </div>
      ))}
      <p className="text-xs text-gray-400 mt-6">
        Pokazujemy zapisane zdarzenia. Samego przeglądania aplikacji nie logujemy, tylko czas ostatniego żądania (Ostatnia aktywność).
      </p>
    </div>
  );
}
