// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BookForge — Book Editor v3 (Visual + Code + Preview)
// Three editing modes with bidirectional LaTeX ↔ HTML
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { useState, useEffect, useCallback, useRef } from "react";
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  Save,
  RefreshCw,
  Loader2,
  Check,
  AlertTriangle,
  FileText,
  Eye,
  Code2,
  Type,
  Undo2,
  History,
  Download,
  Clock,
  Info,
} from "lucide-react";
import toast from "react-hot-toast";
import apiClient from "@/lib/api";
import LaTeXEditor from "@/components/LaTeXEditor";
import WysiwygEditor from "@/components/WysiwygEditor";
import { latexToHtml, htmlToLatex } from "@/lib/latexConverter";
import { useAuthStore } from "@/stores/authStore";

// ── Types ──

type EditorMode = "visual" | "code"; // | "preview";

interface ChapterData {
  id: string;
  chapterNumber: number;
  title: string;
  latexContent: string;
  targetPages: number;
  actualWords: number | null;
  actualPages: number | null;
}

interface BookVersion {
  id: string;
  version: number;
  fileSize: number | null;
  pageCount: number | null;
  note: string | null;
  createdAt: string;
}

interface Props {
  projectId: string;
  onRecompileStart: () => void;
  onRecompileDone: () => void;
}

// ── Mode config ──

const MODE_CONFIG: Record<
  EditorMode,
  { label: string; icon: typeof Type; description: string }
> = {
  visual: {
    label: "Visual",
    icon: Type,
    description: "Word-like editor — no LaTeX knowledge needed",
  },
  code: {
    label: "Code",
    icon: Code2,
    description: "LaTeX source with syntax highlighting",
  },
  //preview: {
  //label: "Preview",
  //icon: Eye,
  //description: "Read-only formatted preview",
  //},
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default function BookEditor({
  projectId,
  onRecompileStart,
  onRecompileDone,
}: Props) {
  const [chapters, setChapters] = useState<ChapterData[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedChapter, setExpandedChapter] = useState<number | null>(null);
  const [dirtyChapters, setDirtyChapters] = useState<Set<number>>(new Set());
  const [savingChapter, setSavingChapter] = useState<number | null>(null);
  const [recompiling, setRecompiling] = useState(false);

  // Per-chapter editor mode (defaults to visual for new users)
  const [chapterModes, setChapterModes] = useState<Record<number, EditorMode>>(
    {},
  );

  // HTML cache for visual mode (avoids re-converting on every render)
  const htmlCache = useRef<Record<number, string>>({});

  // Version history
  const [versions, setVersions] = useState<BookVersion[]>([]);
  const [showVersions, setShowVersions] = useState(false);
  const [loadingVersions, setLoadingVersions] = useState(false);

  const token = useAuthStore((s) => s.accessToken);

  // Store original LaTeX content for undo
  const originalContent = useRef<Record<number, string>>({});

  // ── Helpers ──

  const getMode = (chapterNumber: number): EditorMode =>
    chapterModes[chapterNumber] || "visual";

  const setMode = (chapterNumber: number, mode: EditorMode) => {
    const currentMode = getMode(chapterNumber);
    const chapter = chapters.find((c) => c.chapterNumber === chapterNumber);
    if (!chapter) return;

    // ── Leaving Visual → flush HTML back to LaTeX ──
    if (currentMode === "visual" && mode !== "visual") {
      const cachedHtml = htmlCache.current[chapterNumber];
      if (cachedHtml !== undefined) {
        const newLatex = htmlToLatex(cachedHtml);
        setChapters((prev) =>
          prev.map((ch) =>
            ch.chapterNumber === chapterNumber
              ? { ...ch, latexContent: newLatex }
              : ch,
          ),
        );
        setDirtyChapters((prev) => new Set(prev).add(chapterNumber));
      }
    }

    // ── Entering Visual → convert LaTeX to HTML ──
    if (mode === "visual") {
      const latexSource =
        currentMode === "visual"
          ? chapter.latexContent
          : chapters.find((c) => c.chapterNumber === chapterNumber)
              ?.latexContent || "";
      htmlCache.current[chapterNumber] = latexToHtml(latexSource);
    }

    setChapterModes((prev) => ({ ...prev, [chapterNumber]: mode }));
  };

  // ── Load chapters ──

  useEffect(() => {
    loadChapters();
  }, [projectId]);

  const loadChapters = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get(`/projects/${projectId}/chapters`);
      const data: ChapterData[] = res.data.data;
      setChapters(data);

      const originals: Record<number, string> = {};
      data.forEach((ch) => {
        originals[ch.chapterNumber] = ch.latexContent;
        // Pre-convert to HTML for visual mode
        htmlCache.current[ch.chapterNumber] = latexToHtml(ch.latexContent);
      });
      originalContent.current = originals;

      if (data.length > 0 && expandedChapter === null) {
        setExpandedChapter(data[0].chapterNumber);
      }
    } catch {
      toast.error("Failed to load chapters");
    } finally {
      setLoading(false);
    }
  };

  // ── Load versions ──

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

  // ── Content updates ──

  /** Called by CodeMirror (code mode) — updates LaTeX directly */
  const updateLatexContent = useCallback(
    (chapterNumber: number, latex: string) => {
      setChapters((prev) =>
        prev.map((ch) =>
          ch.chapterNumber === chapterNumber
            ? { ...ch, latexContent: latex }
            : ch,
        ),
      );
      setDirtyChapters((prev) => new Set(prev).add(chapterNumber));
    },
    [],
  );

  /** Called by TipTap (visual mode) — updates HTML cache, marks dirty */
  const updateHtmlContent = useCallback(
    (chapterNumber: number, html: string) => {
      htmlCache.current[chapterNumber] = html;
      setDirtyChapters((prev) => new Set(prev).add(chapterNumber));
    },
    [],
  );

  // ── Undo ──

  const undoChanges = useCallback((chapterNumber: number) => {
    const original = originalContent.current[chapterNumber];
    if (original !== undefined) {
      setChapters((prev) =>
        prev.map((ch) =>
          ch.chapterNumber === chapterNumber
            ? { ...ch, latexContent: original }
            : ch,
        ),
      );
      htmlCache.current[chapterNumber] = latexToHtml(original);
      setDirtyChapters((prev) => {
        const next = new Set(prev);
        next.delete(chapterNumber);
        return next;
      });
    }
  }, []);

  // ── Save (always sends LaTeX to backend) ──

  const saveChapter = async (chapterNumber: number) => {
    // If in visual mode, flush HTML → LaTeX first
    const mode = getMode(chapterNumber);
    let latexToSave: string;

    if (mode === "visual") {
      const cachedHtml = htmlCache.current[chapterNumber];
      if (cachedHtml !== undefined) {
        latexToSave = htmlToLatex(cachedHtml);
        // Sync back to state
        setChapters((prev) =>
          prev.map((ch) =>
            ch.chapterNumber === chapterNumber
              ? { ...ch, latexContent: latexToSave }
              : ch,
          ),
        );
      } else {
        latexToSave =
          chapters.find((c) => c.chapterNumber === chapterNumber)
            ?.latexContent || "";
      }
    } else {
      latexToSave =
        chapters.find((c) => c.chapterNumber === chapterNumber)?.latexContent ||
        "";
    }

    setSavingChapter(chapterNumber);
    try {
      const res = await apiClient.put(
        `/projects/${projectId}/chapters/${chapterNumber}`,
        { latexContent: latexToSave },
      );
      setChapters((prev) =>
        prev.map((ch) =>
          ch.chapterNumber === chapterNumber
            ? {
                ...ch,
                latexContent: latexToSave,
                actualWords: res.data.data.actualWords,
              }
            : ch,
        ),
      );
      originalContent.current[chapterNumber] = latexToSave;
      htmlCache.current[chapterNumber] = latexToHtml(latexToSave);
      setDirtyChapters((prev) => {
        const next = new Set(prev);
        next.delete(chapterNumber);
        return next;
      });
      toast.success(`Chapter ${chapterNumber} saved`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Save failed");
    } finally {
      setSavingChapter(null);
    }
  };

  const saveAllDirty = async () => {
    for (const num of Array.from(dirtyChapters)) {
      await saveChapter(num);
    }
  };

  // ── Recompile ──

  const handleRecompile = async () => {
    if (dirtyChapters.size > 0) {
      toast("Saving changes first...", { icon: "💾" });
      await saveAllDirty();
    }

    setRecompiling(true);
    onRecompileStart();
    try {
      await apiClient.post(`/projects/${projectId}/recompile`);
      toast.success("Recompilation started! This may take a minute...");
      pollForCompletion();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Recompile failed");
      setRecompiling(false);
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
          onRecompileDone();
          loadVersions();
          toast.success("eBook regenerated successfully!");
        } else if (stage === "ERROR") {
          clearInterval(interval);
          setRecompiling(false);
          toast.error("Recompilation failed. Please try again.");
        }
      } catch {
        /* ignore polling errors */
      }
    }, 3000);

    setTimeout(() => {
      clearInterval(interval);
      if (recompiling) {
        setRecompiling(false);
        toast.error(
          "Recompilation timed out. Please refresh and check status.",
        );
      }
    }, 180000);
  };

  // ── Render preview HTML ──

  const renderPreview = (latex: string) => {
    // Use the same latexToHtml converter for consistency
    return latexToHtml(latex);
  };

  // ── Utils ──

  const countWords = (latex: string) =>
    latex
      .replace(/\\[a-zA-Z]+(\{[^}]*\})?/g, "")
      .split(/\s+/)
      .filter(Boolean).length;

  const formatSize = (bytes: number | null) => {
    if (!bytes) return "—";
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

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // RENDER
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 text-primary-500 animate-spin" />
        <span className="ml-2 text-gray-500">Loading chapters...</span>
      </div>
    );
  }

  if (chapters.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No chapters available for editing.
      </div>
    );
  }

  const totalDirty = dirtyChapters.size;

  return (
    <div className="space-y-4">
      {/* ── Editor header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText className="w-5 h-5 text-primary-500" />
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
            Edit Your Book
          </h3>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {chapters.length} chapters
          </span>
        </div>
        <div className="flex items-center gap-3">
          {totalDirty > 0 && (
            <span className="text-sm text-amber-600 dark:text-amber-400 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              {totalDirty} unsaved {totalDirty === 1 ? "change" : "changes"}
            </span>
          )}
          <button
            onClick={toggleVersions}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-colors ${
              showVersions
                ? "bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300"
                : "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600"
            }`}
          >
            <History className="w-3.5 h-3.5" />
            Versions
          </button>
        </div>
      </div>

      {/* ── Version History Panel ── */}
      {showVersions && (
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4" /> PDF Version History
          </h4>
          {loadingVersions ? (
            <div className="flex items-center gap-2 py-3 text-sm text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading...
            </div>
          ) : versions.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 py-2">
              No previous versions yet. Each recompilation creates a version.
            </p>
          ) : (
            <div className="space-y-2">
              {versions.map((v) => (
                <div
                  key={v.id}
                  className="flex items-center justify-between bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-950/50 px-2 py-0.5 rounded">
                      v{v.version}
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
                  <a
                    href={`/api/projects/${projectId}/versions/${v.version}/download?token=${token}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" /> PDF
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Chapters ── */}
      <div className="space-y-2">
        {chapters.map((chapter) => {
          const isExpanded = expandedChapter === chapter.chapterNumber;
          const isDirty = dirtyChapters.has(chapter.chapterNumber);
          const isSaving = savingChapter === chapter.chapterNumber;
          const mode = getMode(chapter.chapterNumber);
          const currentWords = countWords(chapter.latexContent);

          return (
            <div
              key={chapter.id}
              className={`bg-gray-50 dark:bg-gray-800/50 rounded-xl border transition-colors ${
                isDirty
                  ? "border-amber-300 dark:border-amber-700"
                  : "border-gray-200 dark:border-gray-700"
              }`}
            >
              {/* ── Chapter header (collapsible) ── */}
              <button
                onClick={() =>
                  setExpandedChapter(isExpanded ? null : chapter.chapterNumber)
                }
                className="w-full flex items-center gap-3 p-4 text-left"
              >
                {isExpanded ? (
                  <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                )}
                <span className="text-xs font-bold text-primary-600 dark:text-primary-400 flex-shrink-0">
                  CH {chapter.chapterNumber}
                </span>
                <span className="font-medium text-gray-900 dark:text-white truncate flex-1">
                  {chapter.title}
                </span>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {currentWords.toLocaleString()} words
                  </span>
                  {isDirty && (
                    <span className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" />
                  )}
                </div>
              </button>

              {/* ── Expanded: toolbar + editor ── */}
              {isExpanded && (
                <div className="border-t border-gray-200 dark:border-gray-700 p-4">
                  {/* ── Chapter toolbar ── */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {/* Mode switcher */}
                      <div className="inline-flex items-center bg-gray-200 dark:bg-gray-700 rounded-lg p-0.5">
                        {(
                          Object.entries(MODE_CONFIG) as [
                            EditorMode,
                            (typeof MODE_CONFIG)[EditorMode],
                          ][]
                        ).map(([key, cfg]) => {
                          const Icon = cfg.icon;
                          const isActive = mode === key;
                          return (
                            <button
                              key={key}
                              onClick={() =>
                                setMode(chapter.chapterNumber, key)
                              }
                              title={cfg.description}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md font-medium transition-all ${
                                isActive
                                  ? "bg-white dark:bg-gray-900 text-primary-700 dark:text-primary-300 shadow-sm"
                                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                              }`}
                            >
                              <Icon className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">
                                {cfg.label}
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Undo */}
                      {isDirty && (
                        <button
                          onClick={() => undoChanges(chapter.chapterNumber)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                        >
                          <Undo2 className="w-3.5 h-3.5" /> Undo All
                        </button>
                      )}

                      {/* Hint */}
                      {mode === "code" && (
                        <span className="text-[10px] text-gray-400 dark:text-gray-500 ml-2 hidden lg:inline">
                          Ctrl+F to search · Ctrl+Z to undo
                        </span>
                      )}
                    </div>

                    {/* Save button */}
                    <button
                      onClick={() => saveChapter(chapter.chapterNumber)}
                      disabled={!isDirty || isSaving}
                      className={`inline-flex items-center gap-1.5 px-4 py-1.5 text-xs rounded-lg font-medium transition-colors ${
                        isDirty
                          ? "bg-primary-600 text-white hover:bg-primary-700"
                          : "bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed"
                      }`}
                    >
                      {isSaving ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : isDirty ? (
                        <Save className="w-3.5 h-3.5" />
                      ) : (
                        <Check className="w-3.5 h-3.5" />
                      )}
                      {isSaving ? "Saving..." : isDirty ? "Save" : "Saved"}
                    </button>
                  </div>

                  {/* ── Visual mode info banner (first time) ── */}
                  {mode === "visual" && (
                    <div className="mb-3 flex items-start gap-2 px-3 py-2 bg-primary-50 dark:bg-primary-950/20 rounded-lg border border-primary-100 dark:border-primary-900/50">
                      <Info className="w-4 h-4 text-primary-500 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-primary-700 dark:text-primary-400 leading-relaxed">
                        Visual editor — edit like in Word. Formatting is
                        automatically converted to LaTeX when you save or switch
                        modes. For advanced LaTeX features, switch to Code mode.
                      </p>
                    </div>
                  )}

                  {/* ── Editor area ── */}
                  {mode === "visual" && (
                    <WysiwygEditor
                      content={
                        htmlCache.current[chapter.chapterNumber] ||
                        latexToHtml(chapter.latexContent)
                      }
                      onChange={(html) =>
                        updateHtmlContent(chapter.chapterNumber, html)
                      }
                      minHeight="300px"
                      maxHeight="600px"
                    />
                  )}

                  {mode === "code" && (
                    <LaTeXEditor
                      value={chapter.latexContent}
                      onChange={(val) =>
                        updateLatexContent(chapter.chapterNumber, val)
                      }
                      minHeight="300px"
                      maxHeight="600px"
                    />
                  )}

                  {/* ── Preview mode 
                  {mode === "preview" && (
                    <div
                      className="prose prose-sm dark:prose-invert max-w-none p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 min-h-[300px] max-h-[600px] overflow-y-auto"
                      dangerouslySetInnerHTML={{
                        __html: renderPreview(chapter.latexContent),
                      }}
                    />
                  )}── */}

                  {/* ── Chapter stats ── */}
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
                    <span>{currentWords.toLocaleString()} words</span>
                    <span>~{Math.round(currentWords / 300)} pages</span>
                    <span>
                      {chapter.latexContent.length.toLocaleString()} chars
                    </span>
                    <span className="ml-auto text-gray-400 dark:text-gray-500">
                      Editing in{" "}
                      <span className="font-medium">
                        {MODE_CONFIG[mode].label}
                      </span>{" "}
                      mode
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Recompile action ── */}
      <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-4">
          {totalDirty > 0 && (
            <button
              onClick={saveAllDirty}
              className="px-5 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium text-sm"
            >
              Save All Changes
            </button>
          )}
          <button
            onClick={handleRecompile}
            disabled={recompiling}
            className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors font-semibold text-lg shadow-lg shadow-primary-600/25 disabled:opacity-50"
          >
            {recompiling ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Recompiling...
              </>
            ) : (
              <>
                <RefreshCw className="w-5 h-5" />
                Regenerate eBook
              </>
            )}
          </button>
        </div>

        {recompiling && (
          <div className="mt-4 p-4 bg-primary-50 dark:bg-primary-950/30 rounded-xl border border-primary-200 dark:border-primary-800">
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-primary-500 animate-spin flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-primary-800 dark:text-primary-300">
                  Recompiling your eBook...
                </p>
                <p className="text-xs text-primary-600 dark:text-primary-400 mt-0.5">
                  Assembling LaTeX → PDF + EPUB. This usually takes 30-60
                  seconds.
                </p>
              </div>
            </div>
          </div>
        )}

        <p className="text-xs text-gray-500 dark:text-gray-400 mt-3 text-center">
          Changes are saved per chapter. "Regenerate eBook" recompiles all
          chapters into a new PDF &amp; EPUB. Previous versions are preserved.
        </p>
      </div>
    </div>
  );
}
