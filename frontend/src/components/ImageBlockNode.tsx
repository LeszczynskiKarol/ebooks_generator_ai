// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BookForge — ImageBlock TipTap Node
// Interactive image with alignment, resize, delete
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";
import { useState, useCallback, useRef } from "react";
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  X,
  Minus,
  Plus,
} from "lucide-react";

// ── Size presets ──
const SIZE_PRESETS = [
  { label: "S", value: 30 },
  { label: "M", value: 50 },
  { label: "L", value: 75 },
  { label: "Full", value: 100 },
];

const ALIGN_OPTIONS = [
  { value: "wrap-left", icon: AlignLeft, tip: "Wrap left" },
  { value: "center", icon: AlignCenter, tip: "Center" },
  { value: "wrap-right", icon: AlignRight, tip: "Wrap right" },
] as const;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// NodeView Component
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function ImageBlockView({
  node,
  updateAttributes,
  deleteNode,
  selected,
}: {
  node: any;
  updateAttributes: (attrs: Record<string, any>) => void;
  deleteNode: () => void;
  selected: boolean;
}) {
  const { src, alt, alignment, widthPercent, caption } = node.attrs;
  const [hovered, setHovered] = useState(false);
  const [dragging, setDragging] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(0);

  const showControls = selected || hovered;
  const clampWidth = (w: number) => Math.max(20, Math.min(100, w));

  // ── Drag to resize ──
  const onDragStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragging(true);
      dragStartX.current = e.clientX;
      dragStartWidth.current = widthPercent;

      const containerWidth =
        wrapperRef.current?.parentElement?.offsetWidth || 600;

      const onMove = (ev: MouseEvent) => {
        const dx = ev.clientX - dragStartX.current;
        const deltaPercent = Math.round((dx / containerWidth) * 100);
        const newWidth = clampWidth(dragStartWidth.current + deltaPercent);
        updateAttributes({ widthPercent: newWidth });
      };

      const onUp = () => {
        setDragging(false);
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [widthPercent, updateAttributes],
  );

  // ── Alignment justify ──
  const justify =
    alignment === "wrap-left"
      ? "flex-start"
      : alignment === "wrap-right"
        ? "flex-end"
        : "center";

  return (
    <NodeViewWrapper className="image-block-nodeview" data-drag-handle="">
      <div
        ref={wrapperRef}
        style={{ display: "flex", justifyContent: justify, margin: "1rem 0" }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div
          style={{
            width: `${widthPercent}%`,
            maxWidth: "100%",
            position: "relative",
          }}
        >
          {/* ── Delete button (always on hover) ── */}
          {showControls && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                deleteNode();
              }}
              title="Remove image"
              style={{
                position: "absolute",
                top: 6,
                right: 6,
                zIndex: 20,
                width: 24,
                height: 24,
                borderRadius: "50%",
                background: "rgba(239,68,68,0.9)",
                color: "#fff",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 2px 6px rgba(0,0,0,0.25)",
                transition: "transform 0.15s",
              }}
              onMouseEnter={(e) =>
                ((e.target as HTMLElement).style.transform = "scale(1.15)")
              }
              onMouseLeave={(e) =>
                ((e.target as HTMLElement).style.transform = "scale(1)")
              }
            >
              <X size={14} />
            </button>
          )}

          {/* ── Image ── */}
          <img
            src={src}
            alt={alt || ""}
            draggable={false}
            style={{
              width: "100%",
              height: "auto",
              borderRadius: 8,
              display: "block",
              border: selected
                ? "2px solid #7c3aed"
                : hovered
                  ? "2px solid #a78bfa"
                  : "2px solid transparent",
              boxShadow: selected ? "0 0 0 3px rgba(124,58,237,0.2)" : "none",
              transition: "border-color 0.15s, box-shadow 0.15s",
              cursor: "pointer",
              userSelect: "none",
            }}
          />

          {/* ── Resize handle (right edge) ── */}
          {showControls && (
            <div
              onMouseDown={onDragStart}
              title="Drag to resize"
              style={{
                position: "absolute",
                right: -4,
                top: "50%",
                transform: "translateY(-50%)",
                width: 8,
                height: 40,
                borderRadius: 4,
                background: dragging ? "#7c3aed" : "#a78bfa",
                cursor: "ew-resize",
                zIndex: 15,
                opacity: dragging ? 1 : 0.7,
                transition: "opacity 0.15s, background 0.15s",
              }}
              onMouseEnter={(e) =>
                ((e.target as HTMLElement).style.opacity = "1")
              }
              onMouseLeave={(e) => {
                if (!dragging) (e.target as HTMLElement).style.opacity = "0.7";
              }}
            />
          )}

          {/* ── Controls toolbar (on select) ── */}
          {selected && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: 4,
                marginTop: 6,
                padding: "6px 8px",
                background: "rgba(255,255,255,0.97)",
                borderRadius: 10,
                boxShadow: "0 2px 12px rgba(0,0,0,0.12)",
                border: "1px solid #e5e7eb",
              }}
            >
              {/* Alignment */}
              {ALIGN_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const active = alignment === opt.value;
                return (
                  <button
                    key={opt.value}
                    title={opt.tip}
                    onClick={(e) => {
                      e.stopPropagation();
                      updateAttributes({ alignment: opt.value });
                    }}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 6,
                      border: "none",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: active ? "#7c3aed" : "#f3f4f6",
                      color: active ? "#fff" : "#6b7280",
                      transition: "all 0.15s",
                    }}
                  >
                    <Icon size={14} />
                  </button>
                );
              })}

              {/* Separator */}
              <div
                style={{
                  width: 1,
                  height: 20,
                  background: "#e5e7eb",
                  margin: "0 2px",
                }}
              />

              {/* Size presets */}
              {SIZE_PRESETS.map((p) => {
                const active =
                  widthPercent >= p.value - 2 && widthPercent <= p.value + 2;
                return (
                  <button
                    key={p.value}
                    title={`${p.value}%`}
                    onClick={(e) => {
                      e.stopPropagation();
                      updateAttributes({ widthPercent: p.value });
                    }}
                    style={{
                      height: 26,
                      padding: "0 8px",
                      borderRadius: 6,
                      border: "none",
                      cursor: "pointer",
                      fontSize: 11,
                      fontWeight: 600,
                      background: active ? "#7c3aed" : "#f3f4f6",
                      color: active ? "#fff" : "#6b7280",
                      transition: "all 0.15s",
                    }}
                  >
                    {p.label}
                  </button>
                );
              })}

              {/* Separator */}
              <div
                style={{
                  width: 1,
                  height: 20,
                  background: "#e5e7eb",
                  margin: "0 2px",
                }}
              />

              {/* Fine +/- controls */}
              <button
                title="Shrink 5%"
                onClick={(e) => {
                  e.stopPropagation();
                  updateAttributes({
                    widthPercent: clampWidth(widthPercent - 5),
                  });
                }}
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 6,
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "#f3f4f6",
                  color: "#6b7280",
                }}
              >
                <Minus size={12} />
              </button>

              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#374151",
                  minWidth: 32,
                  textAlign: "center",
                }}
              >
                {widthPercent}%
              </span>

              <button
                title="Grow 5%"
                onClick={(e) => {
                  e.stopPropagation();
                  updateAttributes({
                    widthPercent: clampWidth(widthPercent + 5),
                  });
                }}
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 6,
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "#f3f4f6",
                  color: "#6b7280",
                }}
              >
                <Plus size={12} />
              </button>
            </div>
          )}

          {/* ── Caption ── */}
          {caption && (
            <p
              style={{
                fontSize: 12,
                color: "#6b7280",
                textAlign: "center",
                marginTop: 4,
                fontStyle: "italic",
              }}
            >
              {caption}
            </p>
          )}
        </div>
      </div>
    </NodeViewWrapper>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TipTap Extension
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const ImageBlock = Node.create({
  name: "imageBlock",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      src: { default: null },
      alt: { default: "" },
      alignment: {
        default: "center",
        parseHTML: (el) => el.getAttribute("data-alignment") || "center",
        renderHTML: (attrs) => ({ "data-alignment": attrs.alignment }),
      },
      widthPercent: {
        default: 80,
        parseHTML: (el) => parseInt(el.getAttribute("data-width") || "80", 10),
        renderHTML: (attrs) => ({ "data-width": String(attrs.widthPercent) }),
      },
      caption: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-caption") || "",
        renderHTML: (attrs) =>
          attrs.caption ? { "data-caption": attrs.caption } : {},
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "img[src]",
        getAttrs: (el) => {
          const dom = el as HTMLElement;
          return {
            src: dom.getAttribute("src"),
            alt: dom.getAttribute("alt") || "",
            alignment: dom.getAttribute("data-alignment") || "center",
            widthPercent: parseInt(dom.getAttribute("data-width") || "80", 10),
            caption: dom.getAttribute("data-caption") || "",
          };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const { src, alt, alignment, widthPercent, caption, ...rest } =
      HTMLAttributes;
    return [
      "img",
      mergeAttributes(rest, {
        src,
        alt: alt || "",
        "data-alignment": alignment || "center",
        "data-width": String(widthPercent || 80),
        ...(caption ? { "data-caption": caption } : {}),
        class: "wysiwyg-image",
      }),
    ];
  },

  addCommands() {
    return {
      setImageBlock:
        (attrs: {
          src: string;
          alt?: string;
          alignment?: string;
          widthPercent?: number;
          caption?: string;
        }) =>
        ({ commands }: any) => {
          return commands.insertContent({
            type: this.name,
            attrs: {
              src: attrs.src,
              alt: attrs.alt || "",
              alignment: attrs.alignment || "center",
              widthPercent: Math.min(
                100,
                Math.max(20, attrs.widthPercent || 80),
              ),
              caption: attrs.caption || "",
            },
          });
        },
    } as any;
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageBlockView);
  },
});

export default ImageBlock;
