// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BookForge — Download Panel v2
// Smart downloads + inline regeneration
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Download,
  FileText,
  Smartphone,
  Loader2,
  RefreshCw,
  BookOpen,
  AlertTriangle,
  History,
  Clock,
  Check,
} from "lucide-react";
import toast from "react-hot-toast";
import apiClient from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";

// ── Types ──

interface BookVersion {
  id: string;
  version: number;
  fileSize: number | null;
  pageCount: number | null;
  note: string | null;
  createdAt: string;
}

interface DownloadPanelProps {
  projectId: string;
  projectTitle: string;
  currentStage: string;
  generationStatus: string;
  /** Number of unsaved chapters in the editor (from BookEditor) */
  unsavedChanges: number;
  /** Saves all dirty chapters. Returns true if all OK. */
  titlePageDirty?: boolean;
  onRecompiled?: () => void;
  onSaveAll: () => Promise<boolean>;
}

export default function DownloadPanel({
  projectId,
  projectTitle,
  currentStage,
  generationStatus,
  unsavedChanges,
  onSaveAll,
  titlePageDirty = false,
  onRecompiled,
}: DownloadPanelProps) {
  const [epubAvailable, setEpubAvailable] = useState(false);
  const [epubGenerating, setEpubGenerating] = useState(false);
  const [checkingEpub, setCheckingEpub] = useState(true);
  const [recompiling, setRecompiling] = useState(false);

  // Tracks whether user edited anything since last successful compile
  const [editedSinceCompile, setEditedSinceCompile] = useState(false);

  // After recompile finishes, auto-download the requested format
  const pendingDownload = useRef<"pdf" | "epub" | null>(null);

  // Version history
  const [versions, setVersions] = useState<BookVersion[]>([]);
  const [showVersions, setShowVersions] = useState(false);
  const [loadingVersions, setLoadingVersions] = useState(false);

  const token = useAuthStore((s) => s.accessToken);
  const isCompleted = currentStage === "COMPLETED";

  // Mark edited whenever unsavedChanges goes above 0
  useEffect(() => {
    if (unsavedChanges > 0) setEditedSinceCompile(true);
  }, [unsavedChanges]);

  // ── EPUB status ──

  const checkEpubStatus = useCallback(async () => {
    try {
      const res = await apiClient.get(`/projects/${projectId}/epub/status`);
      const { available, generationStatus: gs } = res.data.data;
      setEpubAvailable(available);
      setEpubGenerating(gs === "COMPILING_EPUB");
    } catch {
      setEpubAvailable(false);
    } finally {
      setCheckingEpub(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (isCompleted) checkEpubStatus();
  }, [isCompleted, checkEpubStatus]);

  // Poll while EPUB is generating
  useEffect(() => {
    if (!epubGenerating) return;
    const interval = setInterval(async () => {
      try {
        const res = await apiClient.get(`/projects/${projectId}/epub/status`);
        const { available, generationStatus: gs } = res.data.data;
        if (available && gs !== "COMPILING_EPUB") {
          setEpubAvailable(true);
          setEpubGenerating(false);
          toast.success("EPUB is ready!");
          // Auto-download if pending
          if (pendingDownload.current === "epub") {
            triggerDownload("epub");
            pendingDownload.current = null;
          }
        }
      } catch {
        /* ignore */
      }
    }, 3000);
    const timeout = setTimeout(() => {
      clearInterval(interval);
      setEpubGenerating(false);
    }, 120000);
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [epubGenerating, projectId]);

  useEffect(() => {
    if (generationStatus === "COMPILING_EPUB") setEpubGenerating(true);
    else if (generationStatus === "COMPLETED" && epubGenerating)
      checkEpubStatus();
  }, [generationStatus]);

  // ── Download helpers ──

  const pdfUrl = `/api/projects/${projectId}/download/pdf?token=${token}`;
  const epubUrl = `/api/projects/${projectId}/download/epub?token=${token}`;

  const triggerDownload = (format: "pdf" | "epub") => {
    const url = format === "pdf" ? pdfUrl : epubUrl;
    const a = document.createElement("a");
    a.href = url;
    a.download = "";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // ── Smart download: handles save → recompile → download ──

  const handleDownload = async (format: "pdf" | "epub") => {
    // No edits since last compile → instant download
    if (!editedSinceCompile && unsavedChanges === 0 && !titlePageDirty) {
      if (format === "epub" && !epubAvailable) {
        // EPUB not yet generated — trigger generation
        handleGenerateEpub();
        pendingDownload.current = "epub";
        return;
      }
      triggerDownload(format);
      return;
    }

    // Has edits → save + recompile first
    pendingDownload.current = format;

    // 1. Save dirty chapters
    if (unsavedChanges > 0) {
      toast("Saving changes...", { icon: "💾" });
      const ok = await onSaveAll();
      if (!ok) {
        toast.error("Some chapters failed to save. Fix errors and retry.");
        pendingDownload.current = null;
        return;
      }
    }

    // 2. Recompile
    setRecompiling(true);
    try {
      await apiClient.post(`/projects/${projectId}/recompile`);
      toast("Recompiling your book...", { icon: "📖" });
      pollForCompletion();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Recompile failed");
      setRecompiling(false);
      pendingDownload.current = null;
    }
  };

  const pollForCompletion = () => {
    const interval = setInterval(async () => {
      try {
        const res = await apiClient.get(`/projects/${projectId}`);
        const stage = res.data.data.currentStage;

        if (stage === "COMPLETED") {
          clearInterval(interval);
          setRecompiling(false);
          setEditedSinceCompile(false);
          onRecompiled?.();
          checkEpubStatus();
          loadVersions();
          toast.success("Book regenerated!");

          // Auto-download the requested format
          const fmt = pendingDownload.current;
          if (fmt === "pdf") {
            triggerDownload("pdf");
            pendingDownload.current = null;
          } else if (fmt === "epub") {
            // EPUB needs its own generation after PDF recompile
            handleGenerateEpub();
            // pendingDownload stays "epub" — will trigger in EPUB poll
          }
        } else if (stage === "ERROR") {
          clearInterval(interval);
          setRecompiling(false);
          pendingDownload.current = null;
          toast.error("Recompilation failed. Please try again.");
        }
      } catch {
        /* ignore */
      }
    }, 3000);

    setTimeout(() => {
      clearInterval(interval);
      if (recompiling) {
        setRecompiling(false);
        pendingDownload.current = null;
      }
    }, 180000);
  };

  // ── Generate EPUB ──

  const handleGenerateEpub = async () => {
    setEpubGenerating(true);
    try {
      await apiClient.post(`/projects/${projectId}/epub/regenerate`);
      toast("EPUB generation started...", { icon: "📱" });
    } catch (err: any) {
      toast.error(
        err.response?.data?.error || "Failed to start EPUB generation",
      );
      setEpubGenerating(false);
      pendingDownload.current = null;
    }
  };

  // ── Versions ──

  const loadVersions = async () => {
    setLoadingVersions(true);
    try {
      const res = await apiClient.get(`/projects/${projectId}/versions`);
      setVersions(res.data.data || []);
    } catch {
      setVersions([]);
    } finally {
      setLoadingVersions(false);
    }
  };

  const toggleVersions = () => {
    if (!showVersions && versions.length === 0) loadVersions();
    setShowVersions(!showVersions);
  };

  const formatSize = (bytes: number | null) => {
    if (!bytes) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  if (!isCompleted && !recompiling) return null;

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-primary-600 dark:text-primary-400" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900 dark:text-white">
              Download Your Book
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {projectTitle}
            </p>
          </div>
        </div>

        <button
          onClick={toggleVersions}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-colors ${
            showVersions
              ? "bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300"
              : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
          }`}
        >
          <History className="w-3.5 h-3.5" />
          Versions
          {versions.length > 0 && (
            <span className="text-[10px] bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded-md">
              {versions.length}
            </span>
          )}
        </button>
      </div>

      {/* ── Recompiling banner ── */}
      {recompiling && (
        <div className="mb-4 p-4 bg-primary-50 dark:bg-primary-950/30 rounded-xl border border-primary-200 dark:border-primary-800">
          <div className="flex items-center gap-3">
            <Loader2 className="w-5 h-5 text-primary-500 animate-spin flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-primary-800 dark:text-primary-300">
                Saving &amp; recompiling your book...
              </p>
              <p className="text-xs text-primary-600 dark:text-primary-400 mt-0.5">
                Your download will start automatically when ready (~30-60s).
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── "Changes pending" banner (not recompiling) ── */}
      {(editedSinceCompile || titlePageDirty) && !recompiling && (
        <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-xl border border-amber-200 dark:border-amber-800 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
          <p className="text-xs text-amber-700 dark:text-amber-400">
            {unsavedChanges > 0
              ? `${unsavedChanges} unsaved change${unsavedChanges > 1 ? "s" : ""}. Downloads will auto-save & regenerate first.`
              : "Chapters edited since last build. Downloads will regenerate automatically."}
          </p>
        </div>
      )}

      {/* ── Download buttons ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* PDF */}
        <button
          onClick={() => handleDownload("pdf")}
          disabled={recompiling}
          className={`group flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all ${
            recompiling
              ? "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 opacity-50 cursor-wait"
              : "border-primary-200 dark:border-primary-800 bg-primary-50 dark:bg-primary-950/30 hover:bg-primary-100 dark:hover:bg-primary-950/50 hover:border-primary-300 dark:hover:border-primary-700 cursor-pointer"
          }`}
        >
          <div className="w-12 h-12 rounded-lg bg-primary-500 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
            <FileText className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 dark:text-white">
              Download PDF
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Print-ready, styled layout
            </p>
          </div>
          {recompiling ? (
            <Loader2 className="w-5 h-5 text-gray-400 animate-spin flex-shrink-0" />
          ) : (
            <Download className="w-5 h-5 text-primary-500 flex-shrink-0 group-hover:translate-y-0.5 transition-transform" />
          )}
        </button>

        {/* EPUB */}
        {checkingEpub ? (
          <div className="flex items-center gap-4 p-4 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <div className="w-12 h-12 rounded-lg bg-gray-300 dark:bg-gray-600 flex items-center justify-center flex-shrink-0">
              <Loader2 className="w-5 h-5 text-gray-500 animate-spin" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-gray-500">EPUB</p>
              <p className="text-xs text-gray-400">Checking...</p>
            </div>
          </div>
        ) : epubGenerating ? (
          <div className="flex items-center gap-4 p-4 rounded-xl border-2 border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30">
            <div className="w-12 h-12 rounded-lg bg-amber-400 dark:bg-amber-600 flex items-center justify-center flex-shrink-0">
              <Loader2 className="w-5 h-5 text-white animate-spin" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-gray-900 dark:text-white">
                EPUB
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-400">
                {pendingDownload.current === "epub"
                  ? "Generating... will download automatically"
                  : "Generating... ~30s"}
              </p>
            </div>
          </div>
        ) : (
          <button
            onClick={() => handleDownload("epub")}
            disabled={recompiling}
            className={`group flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all ${
              recompiling
                ? "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 opacity-50 cursor-wait"
                : epubAvailable
                  ? "border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-950/50 hover:border-emerald-300 dark:hover:border-emerald-700 cursor-pointer"
                  : "border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 hover:border-gray-400 dark:hover:border-gray-500 cursor-pointer"
            }`}
          >
            <div
              className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform ${
                epubAvailable
                  ? "bg-emerald-500"
                  : "bg-gray-200 dark:bg-gray-700"
              }`}
            >
              <Smartphone
                className={`w-6 h-6 ${epubAvailable ? "text-white" : "text-gray-500 dark:text-gray-400"}`}
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 dark:text-white">
                {epubAvailable ? "Download EPUB" : "Generate EPUB"}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Kindle, Apple Books, Kobo
              </p>
            </div>
            {recompiling ? (
              <Loader2 className="w-5 h-5 text-gray-400 animate-spin flex-shrink-0" />
            ) : (
              <Download
                className={`w-5 h-5 flex-shrink-0 group-hover:translate-y-0.5 transition-transform ${
                  epubAvailable ? "text-emerald-500" : "text-gray-400"
                }`}
              />
            )}
          </button>
        )}
      </div>

      {/* ── Regenerate EPUB only (when already available) ── 
      {epubAvailable && !recompiling && !epubGenerating && (
        <div className="mt-3 flex items-center justify-end">
          <button
            onClick={() => {
              handleGenerateEpub();
            }}
            className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" />
            Regenerate EPUB only
          </button>
        </div>
      )}*/}

      {/* ── Version History ── */}
      {showVersions && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4" /> Version History
          </h4>
          {loadingVersions ? (
            <div className="flex items-center gap-2 py-3 text-sm text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading...
            </div>
          ) : versions.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 py-2">
              No versions yet. Each download regeneration creates a new version.
            </p>
          ) : (
            <div className="space-y-2">
              {versions.map((v, idx) => (
                <div
                  key={v.id}
                  className={`flex items-center justify-between bg-gray-50 dark:bg-gray-800/50 rounded-lg border px-4 py-3 ${
                    idx === 0
                      ? "border-primary-200 dark:border-primary-800"
                      : "border-gray-200 dark:border-gray-700"
                  }`}
                >
                  <div className="flex items-center gap-3">
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
                    <div>
                      <p className="text-sm text-gray-800 dark:text-gray-200">
                        {formatDate(v.createdAt)}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {formatSize(v.fileSize)}
                        {v.pageCount ? ` · ${v.pageCount} pages` : ""}
                        {v.note ? ` · ${v.note}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <a
                      href={`/api/projects/${projectId}/versions/${v.version}/download/pdf?token=${token}`}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs bg-primary-50 dark:bg-primary-950/30 text-primary-700 dark:text-primary-300 border border-primary-200 dark:border-primary-800 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-950/50 transition-colors"
                    >
                      <FileText className="w-3 h-3" /> PDF
                    </a>

                    <a
                      href={`/api/projects/${projectId}/versions/${v.version}/download/epub?token=${token}`}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-950/50 transition-colors"
                    >
                      <Smartphone className="w-3 h-3" /> EPUB
                    </a>

                    <a
                      href={`/api/projects/${projectId}/versions/${v.version}/download/tex?token=${token}`}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    >
                      <FileText className="w-3 h-3" /> TeX
                    </a>
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
