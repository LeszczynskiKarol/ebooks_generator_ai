// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BookForge — LaTeX Editor (CodeMirror 6)
// Replaces raw textarea with syntax-highlighted editor
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { useCallback, useMemo, useEffect, useState } from "react";
import CodeMirror, { ReactCodeMirrorProps } from "@uiw/react-codemirror";
import { StreamLanguage } from "@codemirror/language";
import { stex } from "@codemirror/legacy-modes/mode/stex";
import { search, highlightSelectionMatches } from "@codemirror/search";
import { EditorView } from "@codemirror/view";
import { tags } from "@lezer/highlight";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";

// ── Dark mode detection (Tailwind class-based) ──
function useIsDark(): boolean {
  const [isDark, setIsDark] = useState(() =>
    document.documentElement.classList.contains("dark"),
  );

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains("dark"));
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  return isDark;
}

// ── Custom highlight styles ──
const lightHighlight = HighlightStyle.define([
  { tag: tags.keyword, color: "#7C3AED", fontWeight: "bold" }, // \commands
  { tag: tags.atom, color: "#059669" }, // environments
  { tag: tags.string, color: "#B45309" }, // {arguments}
  { tag: tags.comment, color: "#9CA3AF", fontStyle: "italic" },
  { tag: tags.bracket, color: "#6B7280" },
  { tag: tags.meta, color: "#2563EB" }, // special chars
  { tag: tags.name, color: "#7C3AED" },
  { tag: tags.tagName, color: "#059669", fontWeight: "bold" }, // \begin \end
]);

const darkHighlight = HighlightStyle.define([
  { tag: tags.keyword, color: "#A78BFA", fontWeight: "bold" },
  { tag: tags.atom, color: "#34D399" },
  { tag: tags.string, color: "#FBBF24" },
  { tag: tags.comment, color: "#6B7280", fontStyle: "italic" },
  { tag: tags.bracket, color: "#9CA3AF" },
  { tag: tags.meta, color: "#60A5FA" },
  { tag: tags.name, color: "#A78BFA" },
  { tag: tags.tagName, color: "#34D399", fontWeight: "bold" },
]);

// ── Editor themes ──
const lightTheme = EditorView.theme(
  {
    "&": {
      backgroundColor: "#FFFFFF",
      color: "#1F2937",
      fontSize: "13px",
    },
    ".cm-content": {
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
      padding: "12px 0",
      caretColor: "#7C3AED",
    },
    ".cm-cursor": { borderLeftColor: "#7C3AED" },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
      backgroundColor: "#EDE9FE !important",
    },
    ".cm-activeLine": { backgroundColor: "#F9FAFB" },
    ".cm-gutters": {
      backgroundColor: "#F9FAFB",
      color: "#9CA3AF",
      borderRight: "1px solid #E5E7EB",
      fontSize: "11px",
    },
    ".cm-activeLineGutter": {
      backgroundColor: "#F3F4F6",
      color: "#6B7280",
    },
    ".cm-matchingBracket": {
      backgroundColor: "#DDD6FE",
      outline: "1px solid #A78BFA",
    },
    ".cm-searchMatch": { backgroundColor: "#FEF3C7" },
    ".cm-searchMatch.cm-searchMatch-selected": { backgroundColor: "#FDE68A" },
    // Scrollbar styling
    ".cm-scroller::-webkit-scrollbar": { width: "8px", height: "8px" },
    ".cm-scroller::-webkit-scrollbar-track": { backgroundColor: "#F3F4F6" },
    ".cm-scroller::-webkit-scrollbar-thumb": {
      backgroundColor: "#D1D5DB",
      borderRadius: "4px",
    },
    ".cm-scroller::-webkit-scrollbar-thumb:hover": {
      backgroundColor: "#9CA3AF",
    },
  },
  { dark: false },
);

const darkTheme = EditorView.theme(
  {
    "&": {
      backgroundColor: "#111827",
      color: "#E5E7EB",
      fontSize: "13px",
    },
    ".cm-content": {
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
      padding: "12px 0",
      caretColor: "#A78BFA",
    },
    ".cm-cursor": { borderLeftColor: "#A78BFA" },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
      backgroundColor: "#312E81 !important",
    },
    ".cm-activeLine": { backgroundColor: "#1F2937" },
    ".cm-gutters": {
      backgroundColor: "#0F172A",
      color: "#4B5563",
      borderRight: "1px solid #1F2937",
      fontSize: "11px",
    },
    ".cm-activeLineGutter": {
      backgroundColor: "#1E293B",
      color: "#9CA3AF",
    },
    ".cm-matchingBracket": {
      backgroundColor: "#4C1D95",
      outline: "1px solid #7C3AED",
    },
    ".cm-searchMatch": { backgroundColor: "#78350F" },
    ".cm-searchMatch.cm-searchMatch-selected": { backgroundColor: "#92400E" },
    // Scrollbar styling
    ".cm-scroller::-webkit-scrollbar": { width: "8px", height: "8px" },
    ".cm-scroller::-webkit-scrollbar-track": { backgroundColor: "#1F2937" },
    ".cm-scroller::-webkit-scrollbar-thumb": {
      backgroundColor: "#374151",
      borderRadius: "4px",
    },
    ".cm-scroller::-webkit-scrollbar-thumb:hover": {
      backgroundColor: "#4B5563",
    },
  },
  { dark: true },
);

// ── Props ──
interface LaTeXEditorProps {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  minHeight?: string;
  maxHeight?: string;
  className?: string;
}

export default function LaTeXEditor({
  value,
  onChange,
  readOnly = false,
  minHeight = "300px",
  maxHeight = "600px",
  className = "",
}: LaTeXEditorProps) {
  const isDark = useIsDark();

  const extensions = useMemo(
    () => [
      StreamLanguage.define(stex),
      search(),
      highlightSelectionMatches(),
      syntaxHighlighting(isDark ? darkHighlight : lightHighlight),
      EditorView.lineWrapping,
      EditorView.editable.of(!readOnly),
      EditorView.theme({
        ".cm-scroller": {
          minHeight,
          maxHeight,
          overflow: "auto",
        },
      }),
    ],
    [isDark, readOnly, minHeight, maxHeight],
  );

  const handleChange = useCallback(
    (val: string) => {
      if (!readOnly) onChange(val);
    },
    [onChange, readOnly],
  );

  return (
    <div
      className={`rounded-lg border overflow-hidden ${
        isDark ? "border-gray-700 bg-gray-900" : "border-gray-200 bg-white"
      } ${className}`}
    >
      <CodeMirror
        value={value}
        onChange={handleChange}
        extensions={extensions}
        theme={isDark ? darkTheme : lightTheme}
        basicSetup={{
          lineNumbers: true,
          highlightActiveLineGutter: true,
          highlightActiveLine: true,
          bracketMatching: true,
          closeBrackets: true,
          autocompletion: false,
          foldGutter: true,
          indentOnInput: true,
          history: true,
          tabSize: 2,
        }}
        readOnly={readOnly}
      />
    </div>
  );
}
