// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BookForge — Book Editor v4 (Visual + Code)
// Editing-only — regeneration handled by DownloadPanel
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  useImperativeHandle,
  forwardRef,
} from "react";
import {
  ChevronDown,
  ChevronRight,
  Save,
  Loader2,
  Check,
  AlertTriangle,
  FileText,
  Code2,
  Type,
  Undo2,
  Info,
} from "lucide-react";
import toast from "react-hot-toast";
import apiClient from "@/lib/api";
import LaTeXEditor from "@/components/LaTeXEditor";
import WysiwygEditor from "@/components/WysiwygEditor";
import { latexToHtml, htmlToLatex } from "@/lib/latexConverter";
import { Image as ImageIcon } from "lucide-react";
import ImageLibrary, {
  type ImageInsertPayload,
} from "@/components/ImageLibrary";

// ── Types ──

type EditorMode = "visual" | "code";

interface ChapterData {
  id: string;
  chapterNumber: number;
  title: string;
  latexContent: string;
  targetPages: number;
  actualWords: number | null;
  actualPages: number | null;
}

/** Handle exposed to parent via ref */
export interface BookEditorHandle {
  /** Save all dirty chapters. Returns true if all succeeded. */
  saveAllDirty: () => Promise<boolean>;
  /** Current number of unsaved chapters */
  dirtyCount: number;
}

interface Props {
  projectId: string;
  /** Called whenever the dirty count changes (0 = all saved) */
  onDirtyChange?: (count: number) => void;
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
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const BookEditor = forwardRef<BookEditorHandle, Props>(function BookEditor(
  { projectId, onDirtyChange },
  ref,
) {
  const [chapters, setChapters] = useState<ChapterData[]>([]);
  const [editorKey, setEditorKey] = useState(0);
  const [imageLibraryOpen, setImageLibraryOpen] = useState(false);
  const [imageLibraryChapter, setImageLibraryChapter] = useState<number | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [expandedChapter, setExpandedChapter] = useState<number | null>(null);
  const [dirtyChapters, setDirtyChapters] = useState<Set<number>>(new Set());
  const [savingChapter, setSavingChapter] = useState<number | null>(null);

  const [chapterModes, setChapterModes] = useState<Record<number, EditorMode>>(
    {},
  );
  const htmlCache = useRef<Record<number, string>>({});
  const originalContent = useRef<Record<number, string>>({});
  const wysiwygRef = useRef<any>(null);

  // ── Notify parent of dirty count changes ──

  useEffect(() => {
    onDirtyChange?.(dirtyChapters.size);
  }, [dirtyChapters.size, onDirtyChange]);

  // ── Expose handle to parent (DownloadPanel uses this) ──

  useImperativeHandle(ref, () => ({
    saveAllDirty: async () => {
      const nums = Array.from(dirtyChapters);
      for (const num of nums) {
        const ok = await saveChapterInternal(num);
        if (!ok) return false;
      }
      return true;
    },
    get dirtyCount() {
      return dirtyChapters.size;
    },
  }));

  // ── Helpers ──

  const getMode = (chapterNumber: number): EditorMode =>
    chapterModes[chapterNumber] || "visual";

  const setMode = (chapterNumber: number, mode: EditorMode) => {
    const currentMode = getMode(chapterNumber);
    const chapter = chapters.find((c) => c.chapterNumber === chapterNumber);
    if (!chapter) return;

    // Leaving Visual → flush HTML → LaTeX
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

    // Entering Visual → convert LaTeX → HTML
    if (mode === "visual") {
      htmlCache.current[chapterNumber] = latexToHtml(chapter.latexContent);
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

  // ── Content updates ──

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

  const updateHtmlContent = useCallback(
    (chapterNumber: number, html: string) => {
      htmlCache.current[chapterNumber] = html;
      setDirtyChapters((prev) => new Set(prev).add(chapterNumber));
    },
    [],
  );

  const handleInsertImage = useCallback(
    (chapterNumber: number, payload: ImageInsertPayload) => {
      const mode = getMode(chapterNumber);
      console.log("🖼️ [IMG] handleInsertImage called", {
        chapterNumber,
        mode,
        alignment: payload.alignment,
        widthPercent: payload.widthPercent,
        src: payload.src,
      });

      if (mode === "visual") {
        const editor = wysiwygRef.current;
        if (editor) {
          // Use custom setImageBlock command with full params
          (editor as any)
            .chain()
            .focus()
            .setImageBlock({
              src: payload.src,
              alt: payload.caption || payload.originalName,
              alignment: payload.alignment,
              widthPercent: Math.min(100, Math.max(20, payload.widthPercent)),
              caption: payload.caption || "",
            })
            .run();

          // Sync htmlCache from editor's actual HTML
          const updatedHtml = editor.getHTML();
          htmlCache.current[chapterNumber] = updatedHtml;
          setDirtyChapters((prev) => new Set(prev).add(chapterNumber));

          setChapters((prev) =>
            prev.map((ch) =>
              ch.chapterNumber === chapterNumber
                ? { ...ch, latexContent: htmlToLatex(updatedHtml) }
                : ch,
            ),
          );

          console.log("🖼️ [IMG] Visual insert via setImageBlock", {
            alignment: payload.alignment,
            widthPercent: payload.widthPercent,
            htmlLength: updatedHtml.length,
            hasImg: updatedHtml.includes("<img"),
          });
        } else {
          console.error("🖼️ [IMG] No editor ref available!");
        }
      } else {
        // Code mode: insert LaTeX directly
        const chapter = chapters.find((c) => c.chapterNumber === chapterNumber);
        if (!chapter) return;

        const wf = (payload.widthPercent / 100).toFixed(2);
        let latex: string;

        if (
          payload.alignment === "wrap-left" ||
          payload.alignment === "wrap-right"
        ) {
          const side = payload.alignment === "wrap-left" ? "l" : "r";
          latex = `\n\\begin{wrapfigure}{${side}}{${wf}\\textwidth}\n  \\centering\n  \\includegraphics[width=\\linewidth]{${payload.src}}\n${payload.caption ? `  \\caption{${payload.caption}}\n` : ""}\\end{wrapfigure}\n`;
        } else {
          latex = `\n\\begin{figure}[H]\n  \\centering\n  \\includegraphics[width=${wf}\\textwidth]{${payload.src}}\n${payload.caption ? `  \\caption{${payload.caption}}\n` : ""}\\end{figure}\n`;
        }

        updateLatexContent(chapterNumber, chapter.latexContent + latex);
        console.log("🖼️ [IMG] Code insert done", {
          latexSnippet: latex.substring(0, 150),
        });
      }
    },
    [chapters, getMode, updateLatexContent],
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
      // Force re-mount editor with original content
      setEditorKey((k) => k + 1);
    }
  }, []);

  // ── Save (internal — returns boolean, no toast) ──

  const saveChapterInternal = async (
    chapterNumber: number,
  ): Promise<boolean> => {
    const mode = getMode(chapterNumber);
    let latexToSave: string;

    if (mode === "visual") {
      const cachedHtml = htmlCache.current[chapterNumber];
      if (cachedHtml !== undefined) {
        latexToSave = htmlToLatex(cachedHtml);

        console.group(`📝 [SAVE] Chapter ${chapterNumber} — Visual mode`);
        console.log("HTML cache length:", cachedHtml.length);
        console.log("Converted LaTeX length:", latexToSave.length);
        console.groupEnd();

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
      const payload = { latexContent: latexToSave };
      const res = await apiClient.put(
        `/projects/${projectId}/chapters/${chapterNumber}`,
        payload,
      );

      setChapters((prev) =>
        prev.map((ch) =>
          ch.chapterNumber === chapterNumber
            ? {
                ...ch,
                latexContent: latexToSave,
                actualWords: res.data.data?.actualWords,
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
      return true;
    } catch (err: any) {
      console.error(`❌ [SAVE] Failed:`, err.response?.data || err.message);
      toast.error(
        err.response?.data?.error || `Save chapter ${chapterNumber} failed`,
      );
      return false;
    } finally {
      setSavingChapter(null);
    }
  };

  // Public save (with toast)
  const saveChapter = async (chapterNumber: number) => {
    const ok = await saveChapterInternal(chapterNumber);
    if (ok) toast.success(`Chapter ${chapterNumber} saved`);
  };

  // ── Utils ──

  const countWords = (latex: string) =>
    latex
      .replace(/\\[a-zA-Z]+(\{[^}]*\})?/g, "")
      .split(/\s+/)
      .filter(Boolean).length;

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
        {totalDirty > 0 && (
          <span className="text-sm text-amber-600 dark:text-amber-400 flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" />
            {totalDirty} unsaved {totalDirty === 1 ? "change" : "changes"}
          </span>
        )}
      </div>

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
              {/* Chapter header */}
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

              {/* Expanded editor */}
              {isExpanded && (
                <div className="border-t border-gray-200 dark:border-gray-700 p-4">
                  {/* Toolbar */}
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

                      {isDirty && (
                        <button
                          onClick={() => undoChanges(chapter.chapterNumber)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                        >
                          <Undo2 className="w-3.5 h-3.5" /> Undo All
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setImageLibraryChapter(chapter.chapterNumber);
                          setImageLibraryOpen(true);
                        }}
                        title="Insert image"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors"
                      >
                        <ImageIcon className="w-3.5 h-3.5" /> Image
                      </button>
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

                  {/* Visual mode hint */}
                  {mode === "visual" && (
                    <div className="mb-3 flex items-start gap-2 px-3 py-2 bg-primary-50 dark:bg-primary-950/20 rounded-lg border border-primary-100 dark:border-primary-900/50">
                      <Info className="w-4 h-4 text-primary-500 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-primary-700 dark:text-primary-400 leading-relaxed">
                        Visual editor — edit like in Word. Click an image to
                        resize, reposition, or delete. Switch to Code mode for
                        raw LaTeX.
                      </p>
                    </div>
                  )}

                  {/* Editor */}
                  {mode === "visual" && (
                    <WysiwygEditor
                      key={`wysiwyg-${chapter.chapterNumber}-${editorKey}`}
                      editorRef={wysiwygRef}
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

                  {/* Stats */}
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
                    <span>{currentWords.toLocaleString()} words</span>
                    <span>~{Math.round(currentWords / 300)} pages</span>
                    <span>
                      {chapter.latexContent.length.toLocaleString()} chars
                    </span>
                    <span className="ml-auto text-gray-400 dark:text-gray-500">
                      {MODE_CONFIG[mode].label} mode
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <ImageLibrary
        projectId={projectId}
        open={imageLibraryOpen}
        onClose={() => {
          setImageLibraryOpen(false);
          setImageLibraryChapter(null);
        }}
        onInsert={(payload) => {
          console.log("🖼️ [IMG] onInsert fired", {
            imageLibraryChapter,
            payload,
          });
          if (imageLibraryChapter !== null) {
            handleInsertImage(imageLibraryChapter, payload);
          }
        }}
      />
    </div>
  );
});

export default BookEditor;
