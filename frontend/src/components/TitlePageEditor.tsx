// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BookForge — Title Page Editor
// Edit book title, author name, subtitle
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { useState, forwardRef, useImperativeHandle, useEffect } from "react";
import {
  BookOpen,
  Save,
  Loader2,
  Check,
  User,
  Type,
  FileText,
} from "lucide-react";
import toast from "react-hot-toast";
import apiClient from "@/lib/api";

interface TitlePageEditorProps {
  projectId: string;
  currentTitle: string;
  currentAuthorName: string | null;
  currentSubtitle: string | null;
  language: string;
  onSaved: () => void; // triggers refetch
  /** Called when dirty state changes (true = has unsaved edits) */
  onDirtyChange?: (dirty: boolean) => void;
}

/** Handle exposed to parent via ref */
export interface TitlePageEditorHandle {
  /** Save if dirty. Returns true on success or if nothing to save. */
  save: () => Promise<boolean>;
  /** Whether there are unsaved changes */
  isDirty: boolean;
}

const TitlePageEditor = forwardRef<TitlePageEditorHandle, TitlePageEditorProps>(
  function TitlePageEditor(
    {
      projectId,
      currentTitle,
      currentAuthorName,
      currentSubtitle,
      language,
      onSaved,
      onDirtyChange,
    },
    ref,
  ) {
    const [title, setTitle] = useState(currentTitle || "");
    const [authorName, setAuthorName] = useState(currentAuthorName || "");
    const [subtitle, setSubtitle] = useState(currentSubtitle || "");
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    const isPolish = language === "pl";
    const defaultSubtitle = isPolish ? "" : "";

    const hasChanges =
      title !== (currentTitle || "") ||
      authorName !== (currentAuthorName || "") ||
      subtitle !== (currentSubtitle || "");

    // ── Notify parent of dirty state changes ──
    useEffect(() => {
      onDirtyChange?.(hasChanges);
    }, [hasChanges, onDirtyChange]);

    // ── Internal save logic (no toast, returns boolean) ──
    const saveInternal = async (): Promise<boolean> => {
      if (!hasChanges) return true; // nothing to save

      if (!title.trim()) {
        toast.error(isPolish ? "Tytuł jest wymagany" : "Title is required");
        return false;
      }

      setSaving(true);
      try {
        await apiClient.patch(`/projects/${projectId}/title-page`, {
          title: title.trim(),
          authorName: authorName.trim() || null,
          subtitle: subtitle.trim() || null,
        });
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
        onSaved();
        return true;
      } catch (err: any) {
        toast.error(err.response?.data?.error || "Save failed");
        return false;
      } finally {
        setSaving(false);
      }
    };

    // ── Expose handle to parent ──
    useImperativeHandle(ref, () => ({
      save: saveInternal,
      get isDirty() {
        return hasChanges;
      },
    }));

    // ── Public save (with toast) ──
    const handleSave = async () => {
      const ok = await saveInternal();
      if (ok && hasChanges) {
        // hasChanges was true before save
        toast.success(
          isPolish ? "Strona tytułowa zaktualizowana" : "Title page updated",
        );
      }
    };

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <BookOpen className="w-5 h-5 text-primary-500" />
          <h3 className="text-base font-bold text-gray-900 dark:text-white">
            {isPolish ? "Strona tytułowa" : "Title Page"}
          </h3>
        </div>

        {/* Title */}
        <div>
          <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            <Type className="w-3.5 h-3.5" />
            {isPolish ? "Tytuł książki" : "Book Title"}
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-colors"
            placeholder={isPolish ? "Tytuł Twojej książki" : "Your Book Title"}
          />
        </div>

        {/* Author */}
        <div>
          <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            <User className="w-3.5 h-3.5" />
            {isPolish ? "Autor" : "Author"}{" "}
            <span className="text-xs text-gray-400 font-normal">
              ({isPolish ? "opcjonalnie" : "optional"})
            </span>
          </label>
          <input
            type="text"
            value={authorName}
            onChange={(e) => setAuthorName(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-colors"
            placeholder={isPolish ? "Jan Kowalski" : "John Smith"}
          />
        </div>

        {/* Subtitle */}
        <div>
          <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            <FileText className="w-3.5 h-3.5" />
            {isPolish ? "Podtytuł" : "Subtitle"}{" "}
            <span className="text-xs text-gray-400 font-normal">
              ({isPolish ? "opcjonalnie" : "optional"})
            </span>
          </label>
          <input
            type="text"
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-colors"
            placeholder={defaultSubtitle}
          />
        </div>

        {/* Save button */}
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-gray-400">
            {isPolish
              ? "Zmiany pojawią się po rekompilacji PDF"
              : "Changes will appear after PDF recompilation"}
          </p>
          <button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg font-medium transition-colors ${
              hasChanges
                ? "bg-primary-600 text-white hover:bg-primary-700"
                : "bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed"
            }`}
          >
            {saving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : saved ? (
              <Check className="w-3.5 h-3.5" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            {saving
              ? isPolish
                ? "Zapisywanie..."
                : "Saving..."
              : saved
                ? isPolish
                  ? "Zapisano"
                  : "Saved"
                : isPolish
                  ? "Zapisz"
                  : "Save"}
          </button>
        </div>
      </div>
    );
  },
);

export default TitlePageEditor;
