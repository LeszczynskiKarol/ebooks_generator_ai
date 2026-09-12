// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// InkMagnet — TipTap inline atoms that carry raw LaTeX through the WYSIWYG
//
//   Footnote  <sup data-footnote="…LaTeX…" class="footnote">[*]</sup>
//   RawLatex  <span data-latex-raw="\label{…}|\ref{…}" class="latex-raw">
//
// Without these nodes ProseMirror's schema dropped the unknown <sup>/<span>
// and kept only their text: every footnote of a book edited in the WYSIWYG
// was lost on save (Melbourne Student Starter, 2026-09-12). The bodies are
// not editable here — they round-trip verbatim; edit them in the LaTeX view.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { Node, mergeAttributes } from "@tiptap/core";

export const Footnote = Node.create({
  name: "footnote",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      content: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-footnote") || "",
        renderHTML: (attrs) => ({ "data-footnote": attrs.content }),
      },
      title: {
        default: "",
        parseHTML: (el) => el.getAttribute("title") || "",
        renderHTML: (attrs) => (attrs.title ? { title: attrs.title } : {}),
      },
    };
  },

  parseHTML() {
    return [{ tag: "sup[data-footnote]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "sup",
      mergeAttributes(HTMLAttributes, {
        class: "footnote",
        contenteditable: "false",
      }),
      "[*]",
    ];
  },
});

export const RawLatex = Node.create({
  name: "rawLatex",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      latex: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-latex-raw") || "",
        renderHTML: (attrs) => ({ "data-latex-raw": attrs.latex }),
      },
      kind: {
        default: "ref",
        parseHTML: (el) => el.getAttribute("data-kind") || "ref",
        renderHTML: (attrs) => ({ "data-kind": attrs.kind }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-latex-raw]" }];
  },

  renderHTML({ HTMLAttributes, node }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        class: "latex-raw",
        contenteditable: "false",
        title: node.attrs.latex,
      }),
      node.attrs.kind === "label" ? "⚓" : "→ref",
    ];
  },
});
