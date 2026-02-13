import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  BarChart3,
  Users,
  DollarSign,
  BookOpen,
  CheckCircle,
  Clock,
  AlertCircle,
  Loader2,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import apiClient from "@/lib/api";

export default function AdminDashboard() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: async () => {
      const res = await apiClient.get("/admin/dashboard");
      return res.data.data;
    },
    refetchInterval: 10000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-20 text-red-500">
        Failed to load admin data. Check ADMIN_EMAIL env var.
      </div>
    );
  }

  const { stats, recentProjects } = data;

  const stageColor = (stage: string) => {
    const colors: Record<string, string> = {
      BRIEF: "bg-gray-100 text-gray-700",
      PRICING: "bg-yellow-100 text-yellow-700",
      PAYMENT: "bg-orange-100 text-orange-700",
      STRUCTURE: "bg-blue-100 text-blue-700",
      STRUCTURE_REVIEW: "bg-indigo-100 text-indigo-700",
      IMAGES: "bg-purple-100 text-purple-700",
      GENERATING: "bg-cyan-100 text-cyan-700",
      COMPILING: "bg-teal-100 text-teal-700",
      COMPLETED: "bg-green-100 text-green-700",
      ERROR: "bg-red-100 text-red-700",
    };
    return colors[stage] || "bg-gray-100 text-gray-700";
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold font-display text-gray-900 dark:text-white">
            Admin Panel
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            BookForge.ai — full visibility
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <RefreshCw className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Projects", value: stats.projects, icon: BookOpen, color: "text-blue-500" },
          { label: "Users", value: stats.users, icon: Users, color: "text-purple-500" },
          { label: "Paid", value: stats.paid, icon: DollarSign, color: "text-green-500" },
          { label: "Completed", value: stats.completed, icon: CheckCircle, color: "text-emerald-500" },
        ].map((s) => (
          <div
            key={s.label}
            className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-500 dark:text-gray-400">{s.label}</span>
              <s.icon className={`w-5 h-5 ${s.color}`} />
            </div>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Revenue row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5">
          <span className="text-sm text-gray-500 dark:text-gray-400">Revenue</span>
          <p className="text-2xl font-bold text-green-600 mt-1">${stats.revenue?.toFixed(2)}</p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5">
          <span className="text-sm text-gray-500 dark:text-gray-400">Total Tokens</span>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
            {(stats.totalTokens || 0).toLocaleString()}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5">
          <span className="text-sm text-gray-500 dark:text-gray-400">API Cost</span>
          <p className="text-2xl font-bold text-orange-600 mt-1">${(stats.totalCost || 0).toFixed(4)}</p>
        </div>
      </div>

      {/* Projects table */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
        <div className="p-5 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            All Projects ({recentProjects.length})
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800/50">
                {["Title", "User", "Stage", "Payment", "Pages", "Chapters", "Tokens", "Cost", "Updated"].map(
                  (h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase"
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {recentProjects.map((p: any) => (
                <tr
                  key={p.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors"
                >
                  <td className="px-4 py-3">
                    <Link
                      to={`/admin/projects/${p.id}`}
                      className="font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 flex items-center gap-1"
                    >
                      {p.title || p.topic?.slice(0, 40) || "Untitled"}
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">
                    {p.user}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${stageColor(p.stage)}`}>
                      {p.stage}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs font-medium ${p.paymentStatus === "PAID" ? "text-green-600" : "text-gray-400"}`}
                    >
                      {p.price ? `$${p.price}` : "—"} {p.paymentStatus === "PAID" ? "✓" : ""}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{p.targetPages}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{p.chapters}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                    {p.tokens ? p.tokens.toLocaleString() : "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                    {p.cost ? `$${p.cost}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {new Date(p.updatedAt).toLocaleString("pl-PL", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
