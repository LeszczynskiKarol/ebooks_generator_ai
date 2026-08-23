// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// InkMagnet — Cover Editor v1
// Generate, preview, edit, upload book covers
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  forwardRef,
  useImperativeHandle,
} from "react";
import {
  BookOpen,
  Upload,
  Sparkles,
  Loader2,
  Check,
  X,
  RefreshCw,
  Trash2,
  Image as ImageIcon,
  Eye,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import toast from "react-hot-toast";
import apiClient from "@/lib/api";
import { useT } from "@/lib/i18n";
import { useAuthStore } from "@/stores/authStore";
import {
  COVER_LAYOUTS,
  type CoverParams,
  type CoverLayout,
  type CoverType,
} from "@/lib/coverTypes";

// ── Types ──

export interface CoverEditorHandle {
  isDirty: boolean;
  save: () => Promise<boolean>;
}

interface Props {
  projectId: string;
  language: string;
  bookFormat?: string;
  onDirtyChange?: (dirty: boolean) => void;
  onSaved?: () => void;
}

interface CoverData {
  coverType: CoverType;
  hasCoverPdf: boolean;
  hasCustomImage: boolean;
  coverParams: CoverParams;
  defaultParams: CoverParams;
  availableLayouts: CoverLayout[];
  previewUrl: string | null;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const CoverEditor = forwardRef<CoverEditorHandle, Props>(function CoverEditor(
  { projectId, language, bookFormat = "a5", onDirtyChange, onSaved },
  ref,
) {
  const t = useT();
  const [loading, setLoading] = useState(true);

  // ── Upload dimension info per format ──
  const FORMAT_DIMS: Record<string, { mm: string; px: string }> = {
    a5: { mm: "148 × 210 mm", px: "1748 × 2480 px" },
    b5: { mm: "176 × 250 mm", px: "2079 × 2953 px" },
    a4: { mm: "210 × 297 mm", px: "2480 × 3508 px" },
    letter: { mm: "216 × 279 mm", px: "2551 × 3295 px" },
  };
  const dims = FORMAT_DIMS[bookFormat] || FORMAT_DIMS.a5;

  const [generating, setGenerating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [coverData, setCoverData] = useState<CoverData | null>(null);

  // Editable params
  const [params, setParams] = useState<CoverParams | null>(null);
  const [previewKey, setPreviewKey] = useState(0); // force iframe refresh
  const fileInputRef = useRef<HTMLInputElement>(null);
  const token = useAuthStore((s) => s.accessToken);

  // ── Expose handle to parent ──
  useImperativeHandle(ref, () => ({
    get isDirty() {
      return dirty;
    },
    save: async () => {
      if (!dirty || !params) return true;
      return await handleGenerate();
    },
  }));

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  // ── Load cover data ──
  useEffect(() => {
    loadCover();
  }, [projectId]);

  const loadCover = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get(`/projects/${projectId}/cover`);
      const data: CoverData = res.data.data;
      setCoverData(data);
      setParams(data.coverParams || data.defaultParams);
    } catch (err) {
      console.error("Failed to load cover:", err);
    } finally {
      setLoading(false);
    }
  };

  // ── Update param helper ──
  const updateParam = useCallback((key: keyof CoverParams, value: any) => {
    setParams((prev) => (prev ? { ...prev, [key]: value } : prev));
    setDirty(true);
  }, []);

  // ── Generate cover ──
  const handleGenerate = async (): Promise<boolean> => {
    if (!params) return false;
    setGenerating(true);
    try {
      const res = await apiClient.post(
        `/projects/${projectId}/cover/generate`,
        params,
      );
      setCoverData((prev) =>
        prev
          ? {
              ...prev,
              coverType: "GENERATED",
              hasCoverPdf: res.data.data.compiled,
              previewUrl: res.data.data.previewUrl,
            }
          : prev,
      );
      setPreviewKey((k) => k + 1);
      setDirty(false);
      onSaved?.();
      toast.success(t("cover.toastGenerated"));
      return true;
    } catch (err: any) {
      toast.error(err.response?.data?.error || t("cover.toastGenerationFailed"));
      return false;
    } finally {
      setGenerating(false);
    }
  };

  // ── Upload custom cover ──
  const handleUpload = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    setUploading(true);
    try {
      const res = await apiClient.post(
        `/projects/${projectId}/cover/upload`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } },
      );
      setCoverData((prev) =>
        prev
          ? {
              ...prev,
              coverType: "CUSTOM_UPLOAD",
              hasCoverPdf: true,
              hasCustomImage: true,
              previewUrl: res.data.data.previewUrl,
            }
          : prev,
      );
      setPreviewKey((k) => k + 1);
      setDirty(false);
      onSaved?.();
      toast.success(t("cover.toastUploaded"));
    } catch (err: any) {
      toast.error(err.response?.data?.error || t("cover.toastUploadFailed"));
    } finally {
      setUploading(false);
    }
  };

  // ── Remove cover ──
  const handleRemove = async () => {
    try {
      await apiClient.delete(`/projects/${projectId}/cover`);
      setCoverData((prev) =>
        prev
          ? {
              ...prev,
              coverType: "NONE",
              hasCoverPdf: false,
              hasCustomImage: false,
              previewUrl: null,
            }
          : prev,
      );
      setDirty(false);
      onSaved?.();
      toast.success(t("cover.toastRemoved"));
    } catch (err: any) {
      toast.error(t("cover.toastRemoveFailed"));
    }
  };

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // RENDER
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  if (loading) {
    return (
      <div className="py-6 flex items-center justify-center">
        <Loader2 className="w-5 h-5 text-primary-500 animate-spin" />
      </div>
    );
  }

  const hasCover = coverData?.coverType !== "NONE";
  // #view=Fit + toolbar=0: wbudowany viewer PDF nie dokleja paska narzędzi
  // ani letterboxu (białe/czarne pasy wokół strony w szerokim kontenerze).
  const previewUrl = coverData?.previewUrl
    ? `${coverData.previewUrl}?token=${token}&t=${previewKey}#toolbar=0&navpanes=0&scrollbar=0&view=Fit`
    : null;

  return (
    <div className="mt-6">
      {/* ── Header row ── */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between py-3 text-left group"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-rose-100 dark:bg-rose-900/40 flex items-center justify-center">
            <BookOpen className="w-4 h-4 text-rose-600 dark:text-rose-400" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900 dark:text-white text-sm">
              {t("cover.heading")}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {coverData?.coverType === "GENERATED"
                ? t("cover.subAiGenerated")
                : coverData?.coverType === "CUSTOM_UPLOAD"
                  ? t("cover.subCustomUploaded")
                  : t("cover.subNone")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasCover && (
            <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
              <Check className="w-3 h-3" /> {t("cover.active")}
            </span>
          )}
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </button>

      {/* ── Expanded editor ── */}
      {expanded && (
        <div className="pt-4 space-y-5">
          {/* Mode selector */}
          <div className="grid grid-cols-3 gap-3">
            {/* Generate */}
            <button
              onClick={() => {
                if (coverData?.coverType !== "GENERATED") {
                  setParams(coverData?.defaultParams || null);
                  setDirty(true);
                }
              }}
              className={`p-4 rounded-xl border-2 text-center transition-all ${
                coverData?.coverType === "GENERATED" ||
                (coverData?.coverType === "NONE" && params)
                  ? "border-primary-500 bg-primary-50 dark:bg-primary-950/30"
                  : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
              }`}
            >
              <Sparkles className="w-6 h-6 mx-auto mb-2 text-primary-500" />
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {t("cover.generate")}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">{t("cover.generateDesc")}</p>
            </button>

            {/* Upload */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className={`p-4 rounded-xl border-2 text-center transition-all ${
                coverData?.coverType === "CUSTOM_UPLOAD"
                  ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30"
                  : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
              }`}
            >
              {uploading ? (
                <Loader2 className="w-6 h-6 mx-auto mb-2 text-gray-400 animate-spin" />
              ) : (
                <Upload className="w-6 h-6 mx-auto mb-2 text-emerald-500" />
              )}
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {t("cover.upload")}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">{t("cover.uploadDesc")}</p>
              <p className="text-[10px] text-gray-400 mt-1">
                {dims.mm} ({dims.px})
              </p>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleUpload(f);
                e.target.value = "";
              }}
              className="hidden"
            />

            {/* No cover */}
            <button
              onClick={hasCover ? handleRemove : undefined}
              className={`p-4 rounded-xl border-2 text-center transition-all ${
                !hasCover
                  ? "border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50"
                  : "border-gray-200 dark:border-gray-700 hover:border-red-300 dark:hover:border-red-700"
              }`}
            >
              <X className="w-6 h-6 mx-auto mb-2 text-gray-400" />
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {t("cover.none")}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">{t("cover.noneDesc")}</p>
            </button>
          </div>

          {/* ── Layout selector (for generated covers) ── */}
          {(coverData?.coverType === "GENERATED" || dirty) && params && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t("cover.layoutTemplate")}
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {COVER_LAYOUTS.map((layout) => (
                    <button
                      key={layout.id}
                      onClick={() => updateParam("layout", layout.id)}
                      title={layout.description}
                      className={`p-3 rounded-lg border-2 text-center transition-all ${
                        params.layout === layout.id
                          ? "border-primary-500 bg-primary-50 dark:bg-primary-950/30 shadow-sm"
                          : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                      }`}
                    >
                      <p
                        className={`text-xs font-semibold ${
                          params.layout === layout.id
                            ? "text-primary-700 dark:text-primary-300"
                            : "text-gray-700 dark:text-gray-300"
                        }`}
                      >
                        {layout.label}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Editable fields ── */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    {t("cover.title")}
                  </label>
                  <input
                    type="text"
                    value={params.title || ""}
                    onChange={(e) => updateParam("title", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    {t("cover.authorName")}
                  </label>
                  <input
                    type="text"
                    value={params.authorName || ""}
                    onChange={(e) => updateParam("authorName", e.target.value)}
                    placeholder={t("cover.optional")}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    {t("cover.subtitle")}
                  </label>
                  <input
                    type="text"
                    value={params.subtitle || ""}
                    onChange={(e) => updateParam("subtitle", e.target.value)}
                    placeholder={t("cover.optional")}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    {t("cover.tagline")}
                  </label>
                  <input
                    type="text"
                    value={params.tagline || ""}
                    onChange={(e) => updateParam("tagline", e.target.value)}
                    placeholder={t("cover.taglinePlaceholder")}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    {t("cover.authorCredentials")}
                  </label>
                  <input
                    type="text"
                    value={params.authorCredentials || ""}
                    onChange={(e) =>
                      updateParam("authorCredentials", e.target.value)
                    }
                    placeholder={t("cover.authorCredentialsPlaceholder")}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    {t("cover.featureBadgeText")}
                  </label>
                  <input
                    type="text"
                    value={params.featureText || ""}
                    onChange={(e) => updateParam("featureText", e.target.value)}
                    placeholder={t("cover.featureBadgeTextPlaceholder")}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    {t("cover.featureBadgeSubtext")}
                  </label>
                  <input
                    type="text"
                    value={params.featureSubtext || ""}
                    onChange={(e) =>
                      updateParam("featureSubtext", e.target.value)
                    }
                    placeholder={t("cover.featureBadgeSubtextPlaceholder")}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                  />
                </div>
              </div>

              {/* ── Topic Pillars (up to 3 boxes on cover) ── */}
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                  {t("cover.topicPillars")}
                </label>
                <div className="space-y-2">
                  {(params.pillars || []).map((pillar, i) => (
                    <div key={i} className="flex gap-2 items-start">
                      <input
                        type="text"
                        value={pillar.title}
                        onChange={(e) => {
                          const pillars = [...(params.pillars || [])];
                          pillars[i] = { ...pillars[i], title: e.target.value };
                          updateParam("pillars", pillars);
                        }}
                        placeholder={t("cover.pillarTitle")}
                        className="w-28 px-2 py-1.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-xs focus:ring-2 focus:ring-primary-500 outline-none"
                      />
                      <input
                        type="text"
                        value={pillar.description}
                        onChange={(e) => {
                          const pillars = [...(params.pillars || [])];
                          pillars[i] = {
                            ...pillars[i],
                            description: e.target.value,
                          };
                          updateParam("pillars", pillars);
                        }}
                        placeholder={t("cover.pillarDescription")}
                        className="flex-1 px-2 py-1.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-xs focus:ring-2 focus:ring-primary-500 outline-none"
                      />
                      <button
                        onClick={() => {
                          const pillars = (params.pillars || []).filter(
                            (_, idx) => idx !== i,
                          );
                          updateParam("pillars", pillars);
                        }}
                        className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  {(params.pillars || []).length < 3 && (
                    <button
                      onClick={() => {
                        const pillars = [
                          ...(params.pillars || []),
                          { title: "", description: "" },
                        ];
                        updateParam("pillars", pillars);
                      }}
                      className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
                    >
                      {t("cover.addPillar")}
                    </button>
                  )}
                </div>
              </div>

              {/* ── Action buttons ── */}
              <div className="flex items-center gap-3">
                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-colors ${
                    dirty
                      ? "bg-primary-600 text-white hover:bg-primary-700 shadow-md shadow-primary-600/20"
                      : "bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 hover:bg-primary-200 dark:hover:bg-primary-900/50"
                  }`}
                >
                  {generating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : dirty ? (
                    <Sparkles className="w-4 h-4" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  {generating
                    ? t("cover.generating")
                    : dirty
                      ? t("cover.generateCover")
                      : t("cover.regenerate")}
                </button>
                {hasCover && (
                  <button
                    onClick={handleRemove}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs text-gray-500 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> {t("cover.remove")}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── Preview ── */}
          {previewUrl && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 flex items-center gap-1">
                  <Eye className="w-3.5 h-3.5" /> {t("cover.preview")}
                </label>
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
                >
                  {t("cover.openFullSize")}
                </a>
              </div>
              <div className="bg-gray-100 dark:bg-gray-800 rounded-xl p-4 flex justify-center">
                <iframe
                  key={previewKey}
                  src={previewUrl}
                  className="border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg"
                  style={{
                    width: 280,
                    height: 396,
                    background: "white",
                  }}
                  title="Cover preview"
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export default CoverEditor;
