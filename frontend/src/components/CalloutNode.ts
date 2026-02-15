// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BookForge — TipTap Custom Node: Callout Box
// Renders tipbox, keyinsight, warningbox, examplebox
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { Node, mergeAttributes } from "@tiptap/core";

export interface CalloutOptions {
  HTMLAttributes: Record<string, any>;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    callout: {
      /** Insert a callout box */
      setCallout: (attrs: { type: string; title?: string }) => ReturnType;
      /** Remove callout (unwrap to normal paragraphs) */
      unsetCallout: () => ReturnType;
    };
  }
}

export const Callout = Node.create<CalloutOptions>({
  name: "callout",
  group: "block",
  content: "block+",
  defining: true,

  addOptions() {
    return { HTMLAttributes: {} };
  },

  addAttributes() {
    return {
      type: {
        default: "tipbox",
        parseHTML: (el) => el.getAttribute("data-callout") || "tipbox",
        renderHTML: (attrs) => ({ "data-callout": attrs.type }),
      },
      title: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-title") || "",
        renderHTML: (attrs) => {
          if (!attrs.title) return {};
          return { "data-title": attrs.title };
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-callout]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
      0,
    ];
  },

  addCommands() {
    return {
      setCallout:
        (attrs) =>
        ({ commands }) => {
          return commands.wrapIn(this.name, attrs);
        },
      unsetCallout:
        () =>
        ({ commands }) => {
          return commands.lift(this.name);
        },
    };
  },
});

// ── Callout styling config (used by WysiwygEditor for rendering) ──

export const CALLOUT_STYLES: Record<
  string,
  {
    label: string;
    emoji: string;
    bgLight: string;
    bgDark: string;
    borderLight: string;
    borderDark: string;
    titleLight: string;
    titleDark: string;
  }
> = {
  tipbox: {
    label: "Tip",
    emoji: "💡",
    bgLight: "bg-emerald-50",
    bgDark: "dark:bg-emerald-950/30",
    borderLight: "border-l-emerald-500",
    borderDark: "dark:border-l-emerald-400",
    titleLight: "text-emerald-700",
    titleDark: "dark:text-emerald-400",
  },
  keyinsight: {
    label: "Key Insight",
    emoji: "🔑",
    bgLight: "bg-primary-50",
    bgDark: "dark:bg-primary-950/30",
    borderLight: "border-l-primary-500",
    borderDark: "dark:border-l-primary-400",
    titleLight: "text-primary-700",
    titleDark: "dark:text-primary-400",
  },
  warningbox: {
    label: "Warning",
    emoji: "⚠️",
    bgLight: "bg-amber-50",
    bgDark: "dark:bg-amber-950/30",
    borderLight: "border-l-amber-500",
    borderDark: "dark:border-l-amber-400",
    titleLight: "text-amber-700",
    titleDark: "dark:text-amber-400",
  },
  examplebox: {
    label: "Example",
    emoji: "📝",
    bgLight: "bg-blue-50",
    bgDark: "dark:bg-blue-950/30",
    borderLight: "border-l-blue-500",
    borderDark: "dark:border-l-blue-400",
    titleLight: "text-blue-700",
    titleDark: "dark:text-blue-400",
  },
};
