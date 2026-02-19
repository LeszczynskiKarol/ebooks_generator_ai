// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BookForge — Colophon Editor (Copyright/Info Page)
// Visual editor with live book-page preview
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import {
  useState,
  useMemo,
  forwardRef,
  useImperativeHandle,
  useEffect,
} from "react";
import {
  Save,
  Loader2,
  Check,
  FileText,
  Eye,
  Type,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import toast from "react-hot-toast";
import apiClient from "@/lib/api";

// ── Default templates ──

const TEMPLATES: Record<string, string> = {
  pl: `© {{YEAR}} {{AUTHOR}}
Wszelkie prawa zastrzeżone.

Tytuł: {{TITLE}}

Żadna część tej publikacji nie może być powielana,
przechowywana w systemie wyszukiwania ani przesyłana
w żadnej formie ani za pomocą żadnych środków bez
uprzedniej pisemnej zgody autora.

Projekt i skład: BookForge.ai
Wydanie pierwsze

{{YEAR}}`,

  en: `© {{YEAR}} {{AUTHOR}}
All rights reserved.

Title: {{TITLE}}

No part of this publication may be reproduced,
stored in a retrieval system, or transmitted in any
form or by any means without the prior written
permission of the author.

Design and typesetting: BookForge.ai
First edition

{{YEAR}}`,

  de: `© {{YEAR}} {{AUTHOR}}
Alle Rechte vorbehalten.

Titel: {{TITLE}}

Kein Teil dieser Veröffentlichung darf ohne
vorherige schriftliche Genehmigung des Autors
vervielfältigt, in einem Abrufsystem gespeichert
oder in irgendeiner Form übertragen werden.

Gestaltung und Satz: BookForge.ai
Erste Ausgabe

{{YEAR}}`,
};

const FONT_SIZES = [
  { value: 8, label: "8pt — Tiny" },
  { value: 9, label: "9pt — Small" },
  { value: 10, label: "10pt — Standard" },
  { value: 11, label: "11pt — Medium" },
  { value: 12, label: "12pt — Large" },
  { value: 14, label: "14pt — Extra large" },
];

const PREVIEW_FONT_MAP: Record<number, string> = {
  8: "10px",
  9: "11px",
  10: "12px",
  11: "13px",
  12: "14.5px",
  14: "16.5px",
};

// ── Props ──

interface ColophonEditorProps {
  projectId: string;
  language: string;
  bookTitle: string;
  authorName: string | null;
  currentText: string | null;
  currentFontSize: number | null;
  currentEnabled: boolean;
  onSaved: () => void;
  /** Called when dirty state changes (true = has unsaved edits) */
  onDirtyChange?: (dirty: boolean) => void;
}

/** Handle exposed to parent via ref */
export interface ColophonEditorHandle {
  /** Save if dirty. Returns true on success or if nothing to save. */
  save: () => Promise<boolean>;
  /** Whether there are unsaved changes */
  isDirty: boolean;
}

const ColophonEditor = forwardRef<ColophonEditorHandle, ColophonEditorProps>(
  function ColophonEditor(
    {
      projectId,
      language,
      bookTitle,
      authorName,
      currentText,
      currentFontSize,
      currentEnabled,
      onSaved,
      onDirtyChange,
    },
    ref,
  ) {
    const [text, setText] = useState(currentText || "");
    const [fontSize, setFontSize] = useState(currentFontSize || 10);
    const [enabled, setEnabled] = useState(currentEnabled);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    const isPolish = language === "pl";

    const hasChanges =
      text !== (currentText || "") ||
      fontSize !== (currentFontSize || 10) ||
      enabled !== currentEnabled;

    // ── Notify parent of dirty state changes ──
    useEffect(() => {
      onDirtyChange?.(hasChanges);
    }, [hasChanges, onDirtyChange]);

    // ── Generate default from template ──
    const generateDefault = () => {
      const tpl = TEMPLATES[language] || TEMPLATES.en;
      const year = new Date().getFullYear().toString();
      const result = tpl
        .replace(/\{\{YEAR\}\}/g, year)
        .replace(
          /\{\{AUTHOR\}\}/g,
          authorName || (isPolish ? "Autor" : "Author"),
        )
        .replace(/\{\{TITLE\}\}/g, bookTitle);
      setText(result);
    };

    // ── Preview text with line breaks ──
    const previewLines = useMemo(() => {
      if (!text.trim()) return [];
      return text.split("\n");
    }, [text]);

    // ── Internal save logic (no toast, returns boolean) ──
    const saveInternal = async (): Promise<boolean> => {
      if (!hasChanges) return true; // nothing to save

      setSaving(true);
      try {
        await apiClient.patch(`/projects/${projectId}/title-page`, {
          colophonText: text.trim() || null,
          colophonFontSize: fontSize,
          colophonEnabled: enabled,
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
        toast.success(
          isPolish ? "Strona redakcyjna zapisana" : "Copyright page saved",
        );
      }
    };

    return (
      <div className="space-y-4">
        {/* ── Header with toggle ── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary-500" />
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              {isPolish ? "Strona redakcyjna" : "Copyright Page"}
            </h3>
          </div>

          <button
            onClick={() => setEnabled(!enabled)}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              enabled
                ? "bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300"
                : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
            }`}
          >
            {enabled ? (
              <ToggleRight className="w-5 h-5" />
            ) : (
              <ToggleLeft className="w-5 h-5" />
            )}
            {enabled
              ? isPolish
                ? "Włączona"
                : "Enabled"
              : isPolish
                ? "Wyłączona"
                : "Disabled"}
          </button>
        </div>

        {enabled && (
          <>
            {/* ── Controls row ── */}
            <div className="flex items-center gap-3 flex-wrap">
              {/* Font size */}
              <div className="flex items-center gap-2">
                <Type className="w-4 h-4 text-gray-400" />
                <select
                  value={fontSize}
                  onChange={(e) => setFontSize(parseInt(e.target.value))}
                  className="px-2.5 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500/20 outline-none"
                >
                  {FONT_SIZES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Template button */}
              {!text.trim() && (
                <button
                  onClick={generateDefault}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary-50 dark:bg-primary-950/30 text-primary-600 dark:text-primary-400 border border-primary-200 dark:border-primary-800 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-950/50 transition-colors font-medium"
                >
                  {isPolish ? "Wstaw szablon" : "Insert template"}
                </button>
              )}
            </div>

            {/* ── Editor + Preview side by side ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Textarea */}
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">
                  {isPolish ? "Treść" : "Content"}
                </label>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={14}
                  className="w-full px-3 py-2.5 text-sm font-mono leading-relaxed border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-colors resize-none"
                  placeholder={
                    isPolish
                      ? "Wpisz treść strony redakcyjnej lub kliknij 'Wstaw szablon'..."
                      : "Type copyright page content or click 'Insert template'..."
                  }
                />
                <p className="text-[10px] text-gray-400 mt-1">
                  {isPolish
                    ? "Każda linia = nowa linia w książce. Pusta linia = odstęp."
                    : "Each line = new line in book. Empty line = spacing."}
                </p>
              </div>

              {/* Live preview */}
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
                  <Eye className="w-3 h-3" />
                  {isPolish ? "Podgląd" : "Preview"}
                </label>
                <div
                  className="border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-950 overflow-hidden"
                  style={{ aspectRatio: "0.707" /* A5-ish */ }}
                >
                  <div className="h-full flex flex-col justify-end p-6 pb-8">
                    {previewLines.length > 0 ? (
                      <div
                        className="text-left text-gray-900 dark:text-gray-200 leading-relaxed"
                        style={{
                          fontSize: PREVIEW_FONT_MAP[fontSize] || "12px",
                          fontFamily: "Georgia, 'Times New Roman', serif",
                        }}
                      >
                        {previewLines.map((line, i) =>
                          line.trim() === "" ? (
                            <div key={i} className="h-2" />
                          ) : (
                            <div key={i}>{line}</div>
                          ),
                        )}
                      </div>
                    ) : (
                      <div className="text-center text-gray-300 dark:text-gray-600 text-sm italic">
                        {isPolish
                          ? "Podgląd strony redakcyjnej"
                          : "Copyright page preview"}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* ── Save button ── */}
            <div className="flex items-center justify-between pt-1">
              <p className="text-xs text-gray-400">
                {isPolish
                  ? "Pojawi się po stronie tytułowej po rekompilacji"
                  : "Appears after the title page upon recompilation"}
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
          </>
        )}

        {/* Disabled state — just the toggle, save if changed */}
        {!enabled && hasChanges && (
          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg font-medium bg-primary-600 text-white hover:bg-primary-700 transition-colors"
            >
              {saving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              {isPolish ? "Zapisz" : "Save"}
            </button>
          </div>
        )}
      </div>
    );
  },
);

export default ColophonEditor;
