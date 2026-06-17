// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// InkMagnet — WYSIWYG Editor (TipTap) v2
// Word-like editing — images with float/wrap support
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { ImageBlock } from "./ImageBlockNode";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Undo2,
  Redo2,
  Table as TableIcon,
  Minus,
  Lightbulb,
  ChevronDown,
  Trash2,
  Plus,
} from "lucide-react";
import { Callout, CALLOUT_STYLES } from "./CalloutNode";
import { useT } from "@/lib/i18n";

// Map callout type → i18n key for the user-visible label
const CALLOUT_LABEL_KEY: Record<string, string> = {
  tipbox: "editor.calloutTipbox",
  keyinsight: "editor.calloutKeyinsight",
  warningbox: "editor.calloutWarningbox",
  examplebox: "editor.calloutExamplebox",
};

// ── Props ──
interface WysiwygEditorProps {
  content: string; // HTML content
  onChange: (html: string) => void;
  editorRef?: React.MutableRefObject<any>;
  readOnly?: boolean;
  minHeight?: string;
  maxHeight?: string;
  className?: string;
}

export default function WysiwygEditor({
  content,
  onChange,
  editorRef,
  readOnly = false,
  minHeight = "300px",
  maxHeight = "600px",
  className = "",
}: WysiwygEditorProps) {
  const t = useT();
  const [showCalloutMenu, setShowCalloutMenu] = useState(false);
  const calloutRef = useRef<HTMLDivElement>(null);
  // Declared before useEditor: onUpdate can fire synchronously during editor
  // creation, so prevContent must be initialized first (avoid TDZ error).
  const prevContent = useRef(content);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
        bulletList: { keepMarks: true },
        orderedList: { keepMarks: true },
      }),
      ImageBlock,
      Underline,
      Table.configure({
        resizable: false,
        HTMLAttributes: { class: "wysiwyg-table" },
      }),
      TableRow,
      TableCell,
      TableHeader,
      Placeholder.configure({
        placeholder: t("editor.startWriting"),
      }),
      Callout,
    ],
    content,
    editable: !readOnly,
    onUpdate: ({ editor: ed }) => {
      const html = ed.getHTML();
      prevContent.current = html;
      onChange(html);
    },
    editorProps: {
      attributes: {
        class: "wysiwyg-content focus:outline-none",
        style: `min-height: ${minHeight}; max-height: ${maxHeight}; overflow-y: auto; padding: 1rem;`,
      },
    },
  });

  // Expose editor instance to parent
  useEffect(() => {
    if (editorRef) editorRef.current = editor;
  }, [editor, editorRef]);

  // Update content when prop changes (e.g., mode switch)
  useEffect(() => {
    if (editor && content !== prevContent.current) {
      editor.commands.setContent(content, { emitUpdate: false });
      prevContent.current = content;
    }
  }, [content, editor]);

  // Close callout dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        calloutRef.current &&
        !calloutRef.current.contains(e.target as Node)
      ) {
        setShowCalloutMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (!editor) return null;

  // ── Toolbar button helper ──
  const Btn = ({
    onClick,
    active,
    disabled,
    title,
    children,
  }: {
    onClick: () => void;
    active?: boolean;
    disabled?: boolean;
    title: string;
    children: React.ReactNode;
  }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`w-8 h-8 flex items-center justify-center rounded-md transition-colors ${
        active
          ? "bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300"
          : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-200"
      } ${disabled ? "opacity-30 cursor-not-allowed" : ""}`}
    >
      {children}
    </button>
  );

  const Sep = () => (
    <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-0.5" />
  );

  const insertCallout = (type: string) => {
    const calloutTitle = CALLOUT_LABEL_KEY[type]
      ? t(CALLOUT_LABEL_KEY[type])
      : CALLOUT_STYLES[type]?.label ||
        type.charAt(0).toUpperCase() + type.slice(1);
    editor
      .chain()
      .focus()
      .insertContent({
        type: "callout",
        attrs: { type, title: calloutTitle },
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: t("editor.yourContentHere") }],
          },
        ],
      })
      .run();
    setShowCalloutMenu(false);
  };

  const insertTable = () => {
    editor
      .chain()
      .focus()
      .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
      .run();
  };

  return (
    <div
      className={`rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden ${className}`}
    >
      {/* ── Toolbar ── */}
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          {/* Undo/Redo */}
          <Btn
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            title={t("editor.undo")}
          >
            <Undo2 className="w-4 h-4" />
          </Btn>
          <Btn
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            title={t("editor.redo")}
          >
            <Redo2 className="w-4 h-4" />
          </Btn>

          <Sep />

          {/* Headings */}
          <Btn
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 3 }).run()
            }
            active={editor.isActive("heading", { level: 3 })}
            title={t("editor.sectionHeading")}
          >
            <Heading2 className="w-4 h-4" />
          </Btn>
          <Btn
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 4 }).run()
            }
            active={editor.isActive("heading", { level: 4 })}
            title={t("editor.subsectionHeading")}
          >
            <Heading3 className="w-4 h-4" />
          </Btn>

          <Sep />

          {/* Formatting */}
          <Btn
            onClick={() => editor.chain().focus().toggleBold().run()}
            active={editor.isActive("bold")}
            title={t("editor.bold")}
          >
            <Bold className="w-4 h-4" />
          </Btn>
          <Btn
            onClick={() => editor.chain().focus().toggleItalic().run()}
            active={editor.isActive("italic")}
            title={t("editor.italic")}
          >
            <Italic className="w-4 h-4" />
          </Btn>
          <Btn
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            active={editor.isActive("underline")}
            title={t("editor.underline")}
          >
            <UnderlineIcon className="w-4 h-4" />
          </Btn>

          <Sep />

          {/* Lists */}
          <Btn
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            active={editor.isActive("bulletList")}
            title={t("editor.bulletList")}
          >
            <List className="w-4 h-4" />
          </Btn>
          <Btn
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            active={editor.isActive("orderedList")}
            title={t("editor.numberedList")}
          >
            <ListOrdered className="w-4 h-4" />
          </Btn>

          <Sep />

          {/* Blockquote */}
          <Btn
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            active={editor.isActive("blockquote")}
            title={t("editor.quote")}
          >
            <Quote className="w-4 h-4" />
          </Btn>

          {/* Horizontal rule */}
          <Btn
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
            title={t("editor.horizontalRule")}
          >
            <Minus className="w-4 h-4" />
          </Btn>

          <Sep />

          {/* Callout boxes dropdown */}
          <div className="relative" ref={calloutRef}>
            <button
              type="button"
              onClick={() => setShowCalloutMenu(!showCalloutMenu)}
              title={t("editor.insertCallout")}
              className={`h-8 flex items-center gap-1 px-2 rounded-md text-sm transition-colors ${
                showCalloutMenu
                  ? "bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300"
                  : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
            >
              <Lightbulb className="w-4 h-4" />
              <span className="text-xs hidden sm:inline">{t("editor.callout")}</span>
              <ChevronDown className="w-3 h-3" />
            </button>

            {showCalloutMenu && (
              <div className="absolute top-full left-0 mt-1 z-50 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl py-1 w-48">
                {Object.entries(CALLOUT_STYLES).map(([type, style]) => (
                  <button
                    key={type}
                    onClick={() => insertCallout(type)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    <span>{style.emoji}</span>
                    <span>
                      {CALLOUT_LABEL_KEY[type]
                        ? t(CALLOUT_LABEL_KEY[type])
                        : style.label}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Table */}
          <Btn onClick={insertTable} title={t("editor.insertTable")}>
            <TableIcon className="w-4 h-4" />
          </Btn>

          {/* Table controls (visible when in table) */}
          {editor.isActive("table") && (
            <>
              <Sep />
              <Btn
                onClick={() => editor.chain().focus().addColumnAfter().run()}
                title={t("editor.addColumn")}
              >
                <Plus className="w-3.5 h-3.5" />
              </Btn>
              <Btn
                onClick={() => editor.chain().focus().addRowAfter().run()}
                title={t("editor.addRow")}
              >
                <Plus className="w-3.5 h-3.5 rotate-90" />
              </Btn>
              <Btn
                onClick={() => editor.chain().focus().deleteTable().run()}
                title={t("editor.deleteTable")}
              >
                <Trash2 className="w-3.5 h-3.5 text-red-500" />
              </Btn>
            </>
          )}
        </div>
      )}

      {/* ── Editor content ── */}
      <EditorContent editor={editor} />

      {/* ── Inline styles ── */}
      <style>{`
        .wysiwyg-content h2 {
          font-size: 1.5rem;
          font-weight: 700;
          margin-top: 1.5rem;
          margin-bottom: 0.75rem;
          clear: both;
        }
        .wysiwyg-content h3 {
          font-size: 1.25rem;
          font-weight: 600;
          margin-top: 1.25rem;
          margin-bottom: 0.5rem;
          clear: both;
        }
        .wysiwyg-content h4 {
          font-size: 1.1rem;
          font-weight: 600;
          margin-top: 1rem;
          margin-bottom: 0.5rem;
          clear: both;
        }
        .wysiwyg-content p {
          margin-bottom: 0.75rem;
          line-height: 1.7;
        }
        .wysiwyg-content ul, .wysiwyg-content ol {
          padding-left: 1.5rem;
          margin-bottom: 0.75rem;
          clear: both;
        }
        .wysiwyg-content ul { list-style-type: disc; }
        .wysiwyg-content ol { list-style-type: decimal; }
        .wysiwyg-content li { margin-bottom: 0.25rem; }
        .wysiwyg-content blockquote {
          border-left: 3px solid #a78bfa;
          padding-left: 1rem;
          margin: 1rem 0;
          font-style: italic;
          color: #6b7280;
          clear: both;
        }
        .dark .wysiwyg-content blockquote {
          border-left-color: #7c3aed;
          color: #9ca3af;
        }
        .wysiwyg-content hr {
          margin: 1.5rem 0;
          border-color: #e5e7eb;
          clear: both;
        }
        .dark .wysiwyg-content hr {
          border-color: #374151;
        }
        .wysiwyg-content strong { font-weight: 700; }
        .wysiwyg-content em { font-style: italic; }
        .wysiwyg-content u { text-decoration: underline; }
        .wysiwyg-content a {
          color: #7c3aed;
          text-decoration: underline;
        }

        /* ── Float support for image blocks ── */
        /* NodeViewWrapper gets float from inline style; text wraps naturally */
        .wysiwyg-content .image-block-nodeview[data-alignment="wrap-left"],
        .wysiwyg-content .image-block-nodeview[data-alignment="wrap-right"] {
          /* Ensure ProseMirror doesn't break float with its own styles */
          display: block !important;
        }
        /* Clearfix — prevent floats from leaking out of content area */
        .wysiwyg-content::after {
          content: '';
          display: table;
          clear: both;
        }
        /* Center-aligned images clear previous floats */
        .wysiwyg-content .image-block-nodeview[data-alignment="center"] {
          clear: both;
        }

        /* ── Callout boxes ── */
        .wysiwyg-content div[data-callout] {
          border-left: 4px solid;
          border-radius: 0 0.5rem 0.5rem 0;
          padding: 0.75rem 1rem;
          margin: 1rem 0;
          position: relative;
          clear: both;
        }
        .wysiwyg-content div[data-callout]::before {
          content: attr(data-title);
          display: block;
          font-weight: 700;
          font-size: 0.8rem;
          margin-bottom: 0.25rem;
        }
        .wysiwyg-content div[data-callout="tipbox"] {
          background: #ecfdf5;
          border-left-color: #059669;
        }
        .wysiwyg-content div[data-callout="tipbox"]::before { color: #059669; }
        .dark .wysiwyg-content div[data-callout="tipbox"] {
          background: rgba(5, 150, 105, 0.1);
          border-left-color: #34d399;
        }
        .dark .wysiwyg-content div[data-callout="tipbox"]::before { color: #34d399; }

        .wysiwyg-content div[data-callout="keyinsight"] {
          background: #eff6ff;
          border-left-color: #2563eb;
        }
        .wysiwyg-content div[data-callout="keyinsight"]::before { color: #2563eb; }
        .dark .wysiwyg-content div[data-callout="keyinsight"] {
          background: rgba(37, 99, 235, 0.1);
          border-left-color: #60a5fa;
        }
        .dark .wysiwyg-content div[data-callout="keyinsight"]::before { color: #60a5fa; }

        .wysiwyg-content div[data-callout="warningbox"] {
          background: #fffbeb;
          border-left-color: #d97706;
        }
        .wysiwyg-content div[data-callout="warningbox"]::before { color: #d97706; }
        .dark .wysiwyg-content div[data-callout="warningbox"] {
          background: rgba(217, 119, 6, 0.1);
          border-left-color: #fbbf24;
        }
        .dark .wysiwyg-content div[data-callout="warningbox"]::before { color: #fbbf24; }

        .wysiwyg-content div[data-callout="examplebox"] {
          background: #f0f9ff;
          border-left-color: #3b82f6;
        }
        .wysiwyg-content div[data-callout="examplebox"]::before { color: #3b82f6; }
        .dark .wysiwyg-content div[data-callout="examplebox"] {
          background: rgba(59, 130, 246, 0.1);
          border-left-color: #93c5fd;
        }
        .dark .wysiwyg-content div[data-callout="examplebox"]::before { color: #93c5fd; }

        /* ── Tables ── */
        .wysiwyg-table {
          width: 100%;
          border-collapse: collapse;
          margin: 1rem 0;
          clear: both;
        }
        .wysiwyg-table th, .wysiwyg-table td {
          border: 1px solid #e5e7eb;
          padding: 0.5rem 0.75rem;
          text-align: left;
          min-width: 80px;
        }
        .dark .wysiwyg-table th, .dark .wysiwyg-table td {
          border-color: #374151;
        }
        .wysiwyg-table th {
          background: #f9fafb;
          font-weight: 600;
        }
        .dark .wysiwyg-table th {
          background: #1f2937;
        }
        .wysiwyg-table td {
          background: transparent;
        }
        .wysiwyg-table .selectedCell {
          background: #ede9fe !important;
        }
        .dark .wysiwyg-table .selectedCell {
          background: #312e81 !important;
        }

        /* ── Placeholder ── */
        .wysiwyg-content .is-empty::before {
          content: attr(data-placeholder);
          float: left;
          color: #9ca3af;
          pointer-events: none;
          height: 0;
        }
      `}</style>
    </div>
  );
}
