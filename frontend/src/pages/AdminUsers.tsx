import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  Search,
  Trash2,
  ShieldCheck,
  ShieldOff,
  Pencil,
  ChevronDown,
  ChevronRight,
  Mail,
  BookOpen,
  CreditCard,
} from "lucide-react";
import apiClient from "@/lib/api";

interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
  verified: boolean;
  google: boolean;
  hasStripe: boolean;
  projectCount: number;
}

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

function UserRow({ u }: { u: AdminUser }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["admin-users"] });

  const setVerified = useMutation({
    mutationFn: (verified: boolean) =>
      apiClient.patch(`/admin/users/${u.id}`, { verified }),
    onSuccess: invalidate,
  });
  const rename = useMutation({
    mutationFn: (name: string) =>
      apiClient.patch(`/admin/users/${u.id}`, { name }),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: () => apiClient.delete(`/admin/users/${u.id}`),
    onSuccess: invalidate,
  });

  const detail = useQuery({
    queryKey: ["admin-user", u.id],
    queryFn: async () => (await apiClient.get(`/admin/users/${u.id}`)).data.data,
    enabled: open,
  });

  return (
    <>
      <tr className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50/60 dark:hover:bg-gray-800/40">
        <td className="px-3 py-2.5">
          <button
            onClick={() => setOpen((o) => !o)}
            className="inline-flex items-center gap-1.5 font-medium text-gray-900 dark:text-white"
          >
            {open ? (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-400" />
            )}
            {u.email}
          </button>
        </td>
        <td className="px-3 py-2.5 text-gray-600 dark:text-gray-300">
          {u.name || <span className="text-gray-400">—</span>}
        </td>
        <td className="px-3 py-2.5">
          <div className="flex flex-wrap gap-1">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                u.verified
                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                  : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
              }`}
            >
              {u.verified ? "verified" : "unverified"}
            </span>
            {u.google && (
              <span className="inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                google
              </span>
            )}
            {u.hasStripe && (
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                <CreditCard className="w-3 h-3" /> stripe
              </span>
            )}
          </div>
        </td>
        <td className="px-3 py-2.5 text-center tabular-nums">{u.projectCount}</td>
        <td className="px-3 py-2.5 text-gray-500 dark:text-gray-400 whitespace-nowrap">
          {fmtDate(u.createdAt)}
        </td>
        <td className="px-3 py-2.5">
          <div className="flex items-center justify-end gap-1">
            <button
              title={u.verified ? "Mark unverified" : "Mark verified"}
              onClick={() => setVerified.mutate(!u.verified)}
              disabled={setVerified.isPending}
              className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500"
            >
              {u.verified ? (
                <ShieldOff className="w-4 h-4" />
              ) : (
                <ShieldCheck className="w-4 h-4" />
              )}
            </button>
            <button
              title="Rename"
              onClick={() => {
                const name = window.prompt("New name:", u.name || "");
                if (name !== null) rename.mutate(name);
              }}
              disabled={rename.isPending}
              className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              title="Delete user (and all their books)"
              onClick={() => {
                if (
                  window.confirm(
                    `Delete ${u.email} and ALL their ${u.projectCount} book(s)? This cannot be undone.`,
                  )
                )
                  remove.mutate();
              }}
              disabled={remove.isPending}
              className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500"
            >
              {remove.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
            </button>
          </div>
        </td>
      </tr>
      {open && (
        <tr className="bg-gray-50/80 dark:bg-gray-900/60">
          <td colSpan={6} className="px-6 py-3">
            {detail.isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
            ) : detail.data?.projects?.length ? (
              <div className="space-y-1">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  Books ({detail.data.projects.length})
                </div>
                {detail.data.projects.map((p: any) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                  >
                    <BookOpen className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    <Link
                      to={`/admin/projects/${p.id}`}
                      className="text-primary-600 dark:text-primary-400 hover:underline truncate max-w-md"
                    >
                      {p.title || p.topic}
                    </Link>
                    <span className="text-[11px] text-gray-400">
                      {p.currentStage} · {p.paymentStatus} · {fmtDate(p.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-gray-400 flex items-center gap-2">
                <Mail className="w-3.5 h-3.5" /> No books yet.
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

export default function AdminUsers() {
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users", query],
    queryFn: async () =>
      (await apiClient.get(`/admin/users`, { params: query ? { q: query } : {} }))
        .data.data as AdminUser[],
  });

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            User management
          </h1>
          <p className="text-sm text-gray-500">
            {data ? `${data.length} user(s)` : ""}
          </p>
        </div>
        <Link
          to="/admin"
          className="text-sm text-primary-600 dark:text-primary-400 hover:underline"
        >
          ← Admin dashboard
        </Link>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(q.trim());
        }}
        className="relative mb-4 max-w-md"
      >
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search email or name…"
          className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </form>

      <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-x-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-primary-500 animate-spin" />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-gray-400">
                <th className="px-3 py-2.5 font-semibold">Email</th>
                <th className="px-3 py-2.5 font-semibold">Name</th>
                <th className="px-3 py-2.5 font-semibold">Status</th>
                <th className="px-3 py-2.5 font-semibold text-center">Books</th>
                <th className="px-3 py-2.5 font-semibold">Joined</th>
                <th className="px-3 py-2.5 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data?.map((u) => <UserRow key={u.id} u={u} />)}
              {data?.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-10 text-center text-gray-400">
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
