// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BookForge — Download Panel (PDF + EPUB)
// Shows download buttons for both formats with status
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { useState, useEffect, useCallback } from "react";
import {
  Download,
  FileText,
  Smartphone,
  Loader2,
  RefreshCw,
  BookOpen,
} from "lucide-react";
import toast from "react-hot-toast";
import apiClient from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";

interface DownloadPanelProps {
  projectId: string;
  projectTitle: string;
  currentStage: string;
  generationStatus: string;
}

export default function DownloadPanel({
  projectId,
  projectTitle,
  currentStage,
  generationStatus,
}: DownloadPanelProps) {
  const [epubAvailable, setEpubAvailable] = useState(false);
  const [epubGenerating, setEpubGenerating] = useState(false);
  const [checkingEpub, setCheckingEpub] = useState(true);

  const token = useAuthStore((s) => s.accessToken);

  const isCompleted = currentStage === "COMPLETED";

  // ── Check EPUB status ──
  const checkEpubStatus = useCallback(async () => {
    try {
      const res = await apiClient.get(`/projects/${projectId}/epub/status`);
      const { available, generationStatus: genStatus } = res.data.data;
      setEpubAvailable(available);
      setEpubGenerating(genStatus === "COMPILING_EPUB");
    } catch {
      setEpubAvailable(false);
    } finally {
      setCheckingEpub(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (isCompleted) {
      checkEpubStatus();
    }
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
          toast.success("EPUB is ready for download!");
        }
      } catch {
        // ignore polling errors
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

  // Also trigger check when generationStatus changes externally
  useEffect(() => {
    if (generationStatus === "COMPILING_EPUB") {
      setEpubGenerating(true);
    } else if (generationStatus === "COMPLETED" && epubGenerating) {
      checkEpubStatus();
    }
  }, [generationStatus]);

  // ── Regenerate EPUB ──
  const handleRegenerateEpub = async () => {
    setEpubGenerating(true);
    try {
      await apiClient.post(`/projects/${projectId}/epub/regenerate`);
      toast("EPUB generation started...", { icon: "📱" });
    } catch (err: any) {
      toast.error(
        err.response?.data?.error || "Failed to start EPUB generation",
      );
      setEpubGenerating(false);
    }
  };

  // ── Download URLs ──
  const pdfUrl = `/api/projects/${projectId}/download/pdf?token=${token}`;
  const epubUrl = `/api/projects/${projectId}/download/epub?token=${token}`;

  if (!isCompleted) return null;

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-5">
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* ── PDF Download ── */}
        <a
          href={pdfUrl}
          className="group flex items-center gap-4 p-4 rounded-xl border-2 border-primary-200 dark:border-primary-800 bg-primary-50 dark:bg-primary-950/30 hover:bg-primary-100 dark:hover:bg-primary-950/50 hover:border-primary-300 dark:hover:border-primary-700 transition-all"
        >
          <div className="w-12 h-12 rounded-lg bg-primary-500 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
            <FileText className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 dark:text-white">PDF</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Print-ready, styled layout
            </p>
          </div>
          <Download className="w-5 h-5 text-primary-500 flex-shrink-0 group-hover:translate-y-0.5 transition-transform" />
        </a>

        {/* ── EPUB Download / Status ── */}
        {checkingEpub ? (
          <div className="flex items-center gap-4 p-4 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <div className="w-12 h-12 rounded-lg bg-gray-300 dark:bg-gray-600 flex items-center justify-center flex-shrink-0">
              <Loader2 className="w-5 h-5 text-gray-500 animate-spin" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-gray-500">EPUB</p>
              <p className="text-xs text-gray-400">Checking availability...</p>
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
                Generating... ~30 seconds
              </p>
            </div>
          </div>
        ) : epubAvailable ? (
          <a
            href={epubUrl}
            className="group flex items-center gap-4 p-4 rounded-xl border-2 border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-950/50 hover:border-emerald-300 dark:hover:border-emerald-700 transition-all"
          >
            <div className="w-12 h-12 rounded-lg bg-emerald-500 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
              <Smartphone className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 dark:text-white">
                EPUB
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Kindle, Apple Books, Kobo
              </p>
            </div>
            <Download className="w-5 h-5 text-emerald-500 flex-shrink-0 group-hover:translate-y-0.5 transition-transform" />
          </a>
        ) : (
          <button
            onClick={handleRegenerateEpub}
            className="group flex items-center gap-4 p-4 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 hover:border-gray-400 dark:hover:border-gray-500 transition-all text-left"
          >
            <div className="w-12 h-12 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0 group-hover:bg-gray-300 dark:group-hover:bg-gray-600 transition-colors">
              <Smartphone className="w-6 h-6 text-gray-500 dark:text-gray-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-700 dark:text-gray-300">
                Generate EPUB
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                For e-readers & mobile
              </p>
            </div>
            <RefreshCw className="w-4 h-4 text-gray-400 flex-shrink-0" />
          </button>
        )}
      </div>

      {/* ── Regenerate EPUB hint ── */}
      {epubAvailable && (
        <div className="mt-3 flex items-center justify-between">
          <p className="text-xs text-gray-400 dark:text-gray-500">
            After editing chapters and recompiling, click below to regenerate
            the EPUB.
          </p>
          <button
            onClick={handleRegenerateEpub}
            disabled={epubGenerating}
            className="text-xs text-primary-500 hover:text-primary-700 dark:hover:text-primary-300 flex items-center gap-1 disabled:opacity-50"
          >
            <RefreshCw className="w-3 h-3" />
            Regenerate EPUB
          </button>
        </div>
      )}
    </div>
  );
}
