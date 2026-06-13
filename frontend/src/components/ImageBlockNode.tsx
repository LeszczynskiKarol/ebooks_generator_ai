// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// InkMagnet — ImageBlock TipTap Node v3
// FIXED: renderHTML no longer overwrites data-attributes
// Interactive image with alignment (float!), resize, delete
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
  { value: "wrap-left", icon: AlignLeft, tip: "Float left (text wraps)" },
  { value: "center", icon: AlignCenter, tip: "Center (block)" },
  { value: "wrap-right", icon: AlignRight, tip: "Float right (text wraps)" },
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
  const [liveWidth, setLiveWidth] = useState(widthPercent);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(0);
  const dragSide = useRef<"left" | "right">("right");

  const showControls = selected || hovered;
  const clampWidth = (w: number) => Math.max(20, Math.min(100, w));
  const isFloating = alignment === "wrap-left" || alignment === "wrap-right";
  const displayWidth = dragging ? liveWidth : widthPercent;

  // ── Drag to resize (works from any edge/corner) ──
  // side: "right" → drag right = bigger; "left" → drag left = bigger
  const onDragStart = useCallback(
    (side: "left" | "right") => (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragging(true);
      dragSide.current = side;
      dragStartX.current = e.clientX;
      dragStartWidth.current = widthPercent;

      const editorEl = wrapperRef.current?.closest(".wysiwyg-content");
      const containerWidth = editorEl?.clientWidth || 600;

      const onMove = (ev: MouseEvent) => {
        const dx = ev.clientX - dragStartX.current;
        // Left handles: dragging LEFT = bigger, so invert
        const direction = dragSide.current === "left" ? -1 : 1;
        const deltaPercent = Math.round(
          ((dx * direction) / containerWidth) * 100,
        );
        const newWidth = clampWidth(dragStartWidth.current + deltaPercent);
        setLiveWidth(newWidth);
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

  // ── Wrapper styles based on alignment ──
  const wrapperStyle: React.CSSProperties = isFloating
    ? {
        float: alignment === "wrap-left" ? "left" : "right",
        width: `${widthPercent}%`,
        maxWidth: `${widthPercent}%`,
        margin:
          alignment === "wrap-left"
            ? "0.25rem 1.25rem 0.75rem 0"
            : "0.25rem 0 0.75rem 1.25rem",
        position: "relative",
      }
    : {
        display: "flex",
        justifyContent: "center",
        margin: "1rem 0",
        clear: "both" as const,
        width: "100%",
        position: "relative" as const,
      };

  const innerStyle: React.CSSProperties = isFloating
    ? { width: "100%", position: "relative" }
    : { width: `${widthPercent}%`, maxWidth: "100%", position: "relative" };

  return (
    <NodeViewWrapper
      className="image-block-nodeview"
      data-alignment={alignment}
      style={wrapperStyle}
      data-drag-handle=""
    >
      <div
        ref={wrapperRef}
        style={innerStyle}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* ── Delete button ── */}
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

        {/* ── Resize handles (corners + edges) — WordPress style ── */}
        {showControls && (
          <>
            {/* Percentage badge (visible during drag) */}
            {dragging && (
              <div
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  background: "rgba(124,58,237,0.9)",
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 700,
                  padding: "4px 12px",
                  borderRadius: 8,
                  zIndex: 30,
                  pointerEvents: "none",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
                  whiteSpace: "nowrap",
                }}
              >
                {displayWidth}%
              </div>
            )}

            {/* Left edge handle */}
            <div
              onMouseDown={onDragStart("left")}
              style={{
                position: "absolute",
                left: -3,
                top: "20%",
                height: "60%",
                width: 6,
                cursor: "ew-resize",
                zIndex: 15,
                borderRadius: 3,
                background:
                  dragging && dragSide.current === "left"
                    ? "#7c3aed"
                    : "transparent",
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "rgba(124,58,237,0.4)")
              }
              onMouseLeave={(e) => {
                if (!dragging) e.currentTarget.style.background = "transparent";
              }}
            />

            {/* Right edge handle */}
            <div
              onMouseDown={onDragStart("right")}
              style={{
                position: "absolute",
                right: -3,
                top: "20%",
                height: "60%",
                width: 6,
                cursor: "ew-resize",
                zIndex: 15,
                borderRadius: 3,
                background:
                  dragging && dragSide.current === "right"
                    ? "#7c3aed"
                    : "transparent",
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "rgba(124,58,237,0.4)")
              }
              onMouseLeave={(e) => {
                if (!dragging) e.currentTarget.style.background = "transparent";
              }}
            />

            {/* Corner handles — 4 visible squares */}
            {[
              {
                pos: { top: -4, left: -4 } as React.CSSProperties,
                cursor: "nwse-resize",
                side: "left" as const,
              },
              {
                pos: { top: -4, right: -4 } as React.CSSProperties,
                cursor: "nesw-resize",
                side: "right" as const,
              },
              {
                pos: { bottom: -4, left: -4 } as React.CSSProperties,
                cursor: "nesw-resize",
                side: "left" as const,
              },
              {
                pos: { bottom: -4, right: -4 } as React.CSSProperties,
                cursor: "nwse-resize",
                side: "right" as const,
              },
            ].map((handle, i) => (
              <div
                key={i}
                onMouseDown={onDragStart(handle.side)}
                style={{
                  position: "absolute",
                  ...handle.pos,
                  width: 10,
                  height: 10,
                  borderRadius: 2,
                  background: dragging ? "#7c3aed" : "#fff",
                  border: "2px solid #7c3aed",
                  cursor: handle.cursor,
                  zIndex: 16,
                  boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                  transition: "background 0.15s, transform 0.15s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#7c3aed";
                  e.currentTarget.style.transform = "scale(1.3)";
                }}
                onMouseLeave={(e) => {
                  if (!dragging) {
                    e.currentTarget.style.background = "#fff";
                    e.currentTarget.style.transform = "scale(1)";
                  }
                }}
              />
            ))}
          </>
        )}

        {/* ── Controls toolbar ── */}
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
              position: "relative",
              zIndex: 25,
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

            <div
              style={{
                width: 1,
                height: 20,
                background: "#e5e7eb",
                margin: "0 2px",
              }}
            />

            {/* Fine +/- */}
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

        {/* ── Editable Caption ── */}
        {(selected || caption) && (
          <div
            style={{
              marginTop: 6,
              position: "relative",
            }}
          >
            <input
              type="text"
              value={caption || ""}
              placeholder={selected ? "Add caption..." : ""}
              onChange={(e) => {
                e.stopPropagation();
                updateAttributes({ caption: e.target.value });
              }}
              onKeyDown={(e) => {
                // Prevent TipTap from capturing typing
                e.stopPropagation();
                if (e.key === "Escape") {
                  (e.target as HTMLInputElement).blur();
                }
              }}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              onFocus={(e) => e.stopPropagation()}
              style={{
                width: "100%",
                textAlign: "center",
                fontSize: 12,
                fontStyle: "italic",
                color: caption ? "#9ca3af" : "#6b7280",
                background: selected ? "rgba(124,58,237,0.04)" : "transparent",
                border: selected
                  ? "1px dashed #c4b5fd"
                  : "1px solid transparent",
                borderRadius: 6,
                padding: "4px 8px",
                outline: "none",
                transition: "all 0.15s",
                cursor: "text",
              }}
            />
            {/* Clear caption button */}
            {caption && selected && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  updateAttributes({ caption: "" });
                }}
                title="Remove caption"
                style={{
                  position: "absolute",
                  right: 4,
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  background: "rgba(156,163,175,0.5)",
                  color: "#fff",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11,
                  lineHeight: 1,
                  padding: 0,
                }}
              >
                ×
              </button>
            )}
          </div>
        )}
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
      src: {
        default: null,
        parseHTML: (el) => el.getAttribute("src"),
        renderHTML: (attrs) => ({ src: attrs.src }),
      },
      alt: {
        default: "",
        parseHTML: (el) => el.getAttribute("alt") || "",
        renderHTML: (attrs) => ({ alt: attrs.alt || "" }),
      },
      alignment: {
        default: "center",
        parseHTML: (el) => el.getAttribute("data-alignment") || "center",
        renderHTML: (attrs) => ({
          "data-alignment": attrs.alignment || "center",
        }),
      },
      widthPercent: {
        default: 80,
        parseHTML: (el) => parseInt(el.getAttribute("data-width") || "80", 10),
        renderHTML: (attrs) => ({
          "data-width": String(attrs.widthPercent ?? 80),
        }),
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
      },
    ];
  },

  // ★ CRITICAL FIX: Do NOT destructure/re-set data-alignment, data-width etc.
  // addAttributes().renderHTML already maps alignment→"data-alignment", widthPercent→"data-width".
  // Those are already in HTMLAttributes with the correct keys.
  // Just pass HTMLAttributes through and add the class.
  renderHTML({ HTMLAttributes }) {
    return [
      "img",
      mergeAttributes(HTMLAttributes, {
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
