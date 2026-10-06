import { useEffect, useRef, useState } from "react";
import { Eye, Loader2 } from "lucide-react";
import apiClient from "@/lib/api";
import { useT } from "@/lib/i18n";
import PageLightbox from "@/components/PageLightbox";
import { useAuthStore } from "@/stores/authStore";
import { track } from "@/lib/funnel";

export interface SampleState {
  status: "RUNNING" | "READY" | "FAILED";
  attempts: number;
  pages?: number;
  rev?: number;
}

// Free style sample: the opening of chapter 1, written and typeset like the
// final book (services/sampleGenerator.ts). Generated async — we poll.
export default function SamplePages({
  projectId,
  initial,
}: {
  projectId: string;
  initial?: SampleState | null;
}) {
  const t = useT();
  const token = useAuthStore((s) => s.accessToken);
  const [sample, setSample] = useState<SampleState | null>(initial ?? null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<number | null>(null);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  useEffect(() => {
    if (sample?.status !== "RUNNING") return;
    timer.current = window.setInterval(async () => {
      try {
        const { data } = await apiClient.get(`/projects/${projectId}/sample`);
        const s: SampleState | null = data.data.sample;
        if (s && s.status !== "RUNNING") setSample(s);
      } catch {
        /* keep polling */
      }
    }, 4000);
    return () => {
      if (timer.current) window.clearInterval(timer.current);
    };
  }, [sample?.status, projectId]);

  const start = async () => {
    setStarting(true);
    setError(null);
    track("sample_requested");
    try {
      const { data } = await apiClient.post(`/projects/${projectId}/sample`);
      setSample(data.data.sample);
    } catch (err: any) {
      setError(
        err.response?.status === 429
          ? t("sample.limit")
          : t("sample.failed"),
      );
    } finally {
      setStarting(false);
    }
  };

  const canRetry = sample?.status === "FAILED" && sample.attempts < 2;
  const pageUrls =
    sample?.status === "READY"
      ? Array.from(
          { length: sample.pages ?? 2 },
          (_, i) => `/api/projects/${projectId}/sample/page/${i + 1}?token=${token}&v=${sample.rev ?? 0}`,
        )
      : [];

  return (
    <div className="rounded-xl border border-primary-100 dark:border-primary-900 bg-primary-50/60 dark:bg-primary-950/30 p-4 sm:p-5">
      {sample?.status === "READY" ? (
        <div>
          <p className="font-semibold text-gray-900 dark:text-white">
            {t("sample.readyTitle")}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {t("sample.readyNote")}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
            {pageUrls.map((url, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setViewerIndex(i)}
                className="block cursor-zoom-in"
                title={t("sample.tapToZoom")}
              >
                <img
                  src={url}
                  alt={t("sample.pageAlt", { s: i + 1 })}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm bg-white"
                />
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
            {t("sample.tapToZoom")}
          </p>
          <PageLightbox urls={pageUrls} index={viewerIndex} onClose={() => setViewerIndex(null)} />
        </div>
      ) : sample?.status === "RUNNING" ? (
        <div className="flex items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-primary-600 shrink-0" />
          <div>
            <p className="font-semibold text-gray-900 dark:text-white">
              {t("sample.runningTitle")}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {t("sample.runningText")}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1">
            <p className="font-semibold text-gray-900 dark:text-white">
              {t("sample.ctaTitle")}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {sample?.status === "FAILED"
                ? canRetry
                  ? t("sample.failedRetry")
                  : t("sample.failedFinal")
                : t("sample.ctaText")}
            </p>
            {error && <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">{error}</p>}
          </div>
          {(!sample || canRetry) && (
            <button
              type="button"
              onClick={start}
              disabled={starting}
              className="px-5 py-2.5 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors font-medium inline-flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {starting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
              {t("sample.cta")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
