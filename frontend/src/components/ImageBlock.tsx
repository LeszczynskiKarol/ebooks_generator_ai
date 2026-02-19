// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BookForge — ImageBlock (inline editor widget)
// Renders an embedded image in the Visual editor with
// resize handles and alignment toggle
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { useState, useRef } from "react";
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  Trash2,
  GripVertical,
} from "lucide-react";
import type { ImageAlignment } from "@/components/ImageLibrary";

interface ImageBlockProps {
  src: string;
  alignment: ImageAlignment;
  widthPercent: number;
  caption: string;
  onUpdate: (patch: {
    alignment?: ImageAlignment;
    widthPercent?: number;
    caption?: string;
  }) => void;
  onRemove: () => void;
}

export default function ImageBlock({
  src,
  alignment,
  widthPercent,
  caption,
  onUpdate,
  onRemove,
}: ImageBlockProps) {
  const [showControls, setShowControls] = useState(false);
  const [resizing, setResizing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);
  const startWidthRef = useRef(widthPercent);

  // ── Resize by drag ──
  const onResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setResizing(true);
    startXRef.current = e.clientX;
    startWidthRef.current = widthPercent;

    const onMove = (ev: MouseEvent) => {
      if (!containerRef.current) return;
      const containerWidth =
        containerRef.current.parentElement?.clientWidth || 600;
      const dx = ev.clientX - startXRef.current;
      const dPct = Math.round((dx / containerWidth) * 100);
      const newWidth = Math.max(
        20,
        Math.min(100, startWidthRef.current + dPct),
      );
      onUpdate({ widthPercent: newWidth });
    };

    const onUp = () => {
      setResizing(false);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  // ── Layout styles ──
  const wrapperStyle: React.CSSProperties = {};
  let wrapperClass = "my-4 relative group";

  if (alignment === "center") {
    wrapperClass += " flex flex-col items-center";
  } else if (alignment === "wrap-left") {
    wrapperStyle.float = "left";
    wrapperStyle.marginRight = "16px";
    wrapperStyle.marginBottom = "8px";
    wrapperStyle.width = `${widthPercent}%`;
  } else if (alignment === "wrap-right") {
    wrapperStyle.float = "right";
    wrapperStyle.marginLeft = "16px";
    wrapperStyle.marginBottom = "8px";
    wrapperStyle.width = `${widthPercent}%`;
  }

  const imgStyle: React.CSSProperties = {
    width: alignment === "center" ? `${widthPercent}%` : "100%",
    maxWidth: "100%",
    display: "block",
  };

  return (
    <div
      ref={containerRef}
      className={wrapperClass}
      style={wrapperStyle}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => !resizing && setShowControls(false)}
      contentEditable={false}
    >
      {/* Toolbar overlay */}
      {showControls && (
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg px-2 py-1">
          {/* Alignment buttons */}
          {(
            [
              {
                val: "wrap-left" as ImageAlignment,
                Icon: AlignLeft,
                tip: "Wrap left",
              },
              {
                val: "center" as ImageAlignment,
                Icon: AlignCenter,
                tip: "Center",
              },
              {
                val: "wrap-right" as ImageAlignment,
                Icon: AlignRight,
                tip: "Wrap right",
              },
            ] as const
          ).map(({ val, Icon, tip }) => (
            <button
              key={val}
              onClick={() => onUpdate({ alignment: val })}
              title={tip}
              className={`p-1.5 rounded transition-colors ${
                alignment === val
                  ? "bg-primary-100 dark:bg-primary-900 text-primary-600 dark:text-primary-400"
                  : "text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
              }`}
            >
              <Icon className="w-4 h-4" />
            </button>
          ))}

          <div className="w-px h-5 bg-gray-200 dark:bg-gray-600 mx-1" />

          {/* Size indicator */}
          <span className="text-[10px] text-gray-500 font-mono px-1">
            {widthPercent}%
          </span>

          <div className="w-px h-5 bg-gray-200 dark:bg-gray-600 mx-1" />

          {/* Delete */}
          <button
            onClick={onRemove}
            title="Remove image"
            className="p-1.5 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Image */}
      <div
        className="relative inline-block"
        style={alignment === "center" ? { width: `${widthPercent}%` } : {}}
      >
        <img
          src={src}
          alt={caption || ""}
          style={imgStyle}
          className={`rounded-lg border-2 transition-colors ${
            showControls
              ? "border-primary-400 dark:border-primary-500"
              : "border-transparent"
          }`}
          draggable={false}
        />

        {/* Resize handle (right edge) */}
        {showControls && (
          <div
            onMouseDown={onResizeStart}
            className="absolute top-1/2 -right-3 -translate-y-1/2 w-5 h-10 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-500 rounded-md cursor-col-resize flex items-center justify-center shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
          >
            <GripVertical className="w-3 h-3 text-gray-400" />
          </div>
        )}
      </div>

      {/* Caption (editable) */}
      {(caption || showControls) && (
        <div
          className="mt-1"
          style={alignment === "center" ? { width: `${widthPercent}%` } : {}}
        >
          <input
            type="text"
            value={caption}
            onChange={(e) => onUpdate({ caption: e.target.value })}
            placeholder={showControls ? "Add caption..." : ""}
            className={`w-full text-xs text-center italic bg-transparent border-none outline-none transition-colors ${
              caption
                ? "text-gray-500 dark:text-gray-400"
                : "text-gray-300 dark:text-gray-600 placeholder:text-gray-300"
            }`}
          />
        </div>
      )}

      {/* Clear float */}
      {(alignment === "wrap-left" || alignment === "wrap-right") && (
        <div style={{ clear: "none" }} />
      )}
    </div>
  );
}
