// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BookForge — Version History Panel
// Shows all versions with per-format download buttons
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { useState, useEffect, useCallback } from "react";
import {
  History,
  Clock,
  Download,
  FileText,
  Smartphone,
  Code2,
  Loader2,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import apiClient from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";

interface FormatInfo {
  available: boolean;
  fileSize: number | null;
}

interface BookVersion {
  id: string;
  version: number;
  pageCount: number | null;
  note: string | null;
  createdAt: string;
  formats: {
    pdf: FormatInfo;
    epub: FormatInfo;
    tex: FormatInfo;
  };
}

interface VersionHistoryProps {
  projectId: string;
  /** Call this after recompile to refresh the list */
  refreshTrigger?: number;
}

export default function VersionHistory({
  projectId,
  refreshTrigger,
}: VersionHistoryProps) {
  const [versions, setVersions] = useState<BookVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const token = useAuthStore((s) => s.accessToken);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get(`/projects/${projectId}/versions`);
      setVersions(res.data.data || []);
    } catch {
      setVersions([]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  // Load on open
  useEffect(() => {
    if (open) load();
  }, [open, load]);

  // Reload when refreshTrigger changes (after recompile)
  useEffect(() => {
    if (open && refreshTrigger) load();
  }, [refreshTrigger]);

  const toggle = () => setOpen(!open);

  const downloadUrl = (version: number, format: string) =>
    `/api/projects/${projectId}/versions/${version}/download/${format}?token=${token}`;

  const formatSize = (bytes: number | null) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="mt-4">
      {/* Toggle button */}
      <button
        onClick={toggle}
        className={`inline-flex items-center gap-2 px-4 py-2 text-sm rounded-xl transition-colors ${
          open
            ? "bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300"
            : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
        }`}
      >
        {open ? (
          <ChevronDown className="w-4 h-4" />
        ) : (
          <ChevronRight className="w-4 h-4" />
        )}
        <History className="w-4 h-4" />
        Version History
        {versions.length > 0 && (
          <span className="text-xs bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded-md">
            {versions.length}
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div className="mt-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4" /> All Versions
          </h4>

          {loading ? (
            <div className="flex items-center gap-2 py-3 text-sm text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading...
            </div>
          ) : versions.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 py-2">
              No versions yet. Each compilation creates a new version.
            </p>
          ) : (
            <div className="space-y-3">
              {versions.map((v, idx) => (
                <div
                  key={v.id}
                  className={`bg-white dark:bg-gray-900 rounded-lg border px-4 py-3 ${
                    idx === 0
                      ? "border-primary-200 dark:border-primary-800"
                      : "border-gray-200 dark:border-gray-700"
                  }`}
                >
                  {/* Version header */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded ${
                          idx === 0
                            ? "text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-950/50"
                            : "text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800"
                        }`}
                      >
                        v{v.version}
                        {idx === 0 && " (latest)"}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {formatDate(v.createdAt)}
                      </span>
                      {v.pageCount && (
                        <span className="text-xs text-gray-400">
                          · {v.pageCount} pages
                        </span>
                      )}
                    </div>
                    {v.note && (
                      <span className="text-xs text-gray-400 italic">
                        {v.note}
                      </span>
                    )}
                  </div>

                  {/* Format download buttons */}
                  <div className="flex gap-2 flex-wrap">
                    {/* PDF */}
                    {v.formats.pdf.available ? (
                      <a
                        href={downloadUrl(v.version, "pdf")}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-primary-50 dark:bg-primary-950/30 text-primary-700 dark:text-primary-300 border border-primary-200 dark:border-primary-800 hover:bg-primary-100 dark:hover:bg-primary-950/50 transition-colors"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        PDF
                        {v.formats.pdf.fileSize && (
                          <span className="text-[10px] opacity-70">
                            ({formatSize(v.formats.pdf.fileSize)})
                          </span>
                        )}
                      </a>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-400 border border-gray-200 dark:border-gray-700 cursor-not-allowed">
                        <FileText className="w-3.5 h-3.5" /> PDF —
                      </span>
                    )}

                    {/* EPUB */}
                    {v.formats.epub.available ? (
                      <a
                        href={downloadUrl(v.version, "epub")}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-950/50 transition-colors"
                      >
                        <Smartphone className="w-3.5 h-3.5" />
                        EPUB
                        {v.formats.epub.fileSize && (
                          <span className="text-[10px] opacity-70">
                            ({formatSize(v.formats.epub.fileSize)})
                          </span>
                        )}
                      </a>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-400 border border-gray-200 dark:border-gray-700 cursor-not-allowed">
                        <Smartphone className="w-3.5 h-3.5" /> EPUB —
                      </span>
                    )}

                    {/* LaTeX */}
                    {v.formats.tex.available ? (
                      <a
                        href={downloadUrl(v.version, "tex")}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                      >
                        <Code2 className="w-3.5 h-3.5" />
                        LaTeX
                        {v.formats.tex.fileSize && (
                          <span className="text-[10px] opacity-70">
                            ({formatSize(v.formats.tex.fileSize)})
                          </span>
                        )}
                      </a>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-400 border border-gray-200 dark:border-gray-700 cursor-not-allowed">
                        <Code2 className="w-3.5 h-3.5" /> LaTeX —
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
