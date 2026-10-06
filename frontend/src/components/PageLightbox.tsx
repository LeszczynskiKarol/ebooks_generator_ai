import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Minus, Plus, X } from "lucide-react";
import { useT } from "@/lib/i18n";

// In-page viewer for the style-sample pages: close with ✕ / Esc / backdrop,
// zoom with the wheel, +/−, double click or two-finger pinch, drag to pan,
// ← → between pages.

const MIN = 1;
const MAX = 5;

export default function PageLightbox({
  urls,
  index,
  onClose,
}: {
  urls: string[];
  /** page to show, or null when closed */
  index: number | null;
  onClose: () => void;
}) {
  const t = useT();
  const [page, setPage] = useState(0);
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchStart = useRef<{ dist: number; scale: number } | null>(null);
  const dragStart = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  const open = index !== null;
  const reset = useCallback(() => {
    setScale(1);
    setPos({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    if (index !== null) {
      setPage(index);
      reset();
    }
  }, [index, reset]);

  const go = useCallback(
    (dir: number) => {
      setPage((p) => Math.min(urls.length - 1, Math.max(0, p + dir)));
      reset();
    },
    [urls.length, reset],
  );

  const zoomTo = useCallback((next: number) => {
    const s = Math.min(MAX, Math.max(MIN, next));
    setScale(s);
    if (s === 1) setPos({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "+" || e.key === "=") zoomTo(scale * 1.25);
      else if (e.key === "-") zoomTo(scale / 1.25);
    };
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [open, onClose, go, zoomTo, scale]);

  if (!open || !urls[page]) return null;

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinchStart.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), scale };
      dragStart.current = null;
    } else if (scale > 1) {
      dragStart.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y };
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinchStart.current && pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      zoomTo((pinchStart.current.scale * Math.hypot(a.x - b.x, a.y - b.y)) / pinchStart.current.dist);
    } else if (dragStart.current) {
      setPos({
        x: dragStart.current.px + (e.clientX - dragStart.current.x),
        y: dragStart.current.py + (e.clientY - dragStart.current.y),
      });
    }
  };
  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinchStart.current = null;
    if (pointers.current.size === 0) dragStart.current = null;
  };

  const btn =
    "w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer disabled:opacity-30 disabled:cursor-default";

  return createPortal(
    <div
      className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center select-none"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full h-full flex items-center justify-center overflow-hidden touch-none"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
        onWheel={(e) => zoomTo(scale * (e.deltaY < 0 ? 1.15 : 1 / 1.15))}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <img
          src={urls[page]}
          alt={t("sample.pageAlt", { s: page + 1 })}
          draggable={false}
          onDoubleClick={() => (scale > 1 ? zoomTo(1) : zoomTo(2.5))}
          className="max-h-[92vh] max-w-[94vw] object-contain bg-white rounded-md shadow-2xl"
          style={{
            transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`,
            transition: dragStart.current || pinchStart.current ? "none" : "transform 120ms ease-out",
            cursor: scale > 1 ? "grab" : "zoom-in",
          }}
        />
      </div>

      <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
        <span className="px-3 py-1.5 rounded-full bg-black/60 text-white text-sm pointer-events-auto">
          {page + 1} / {urls.length}
        </span>
        <div className="flex items-center gap-2 pointer-events-auto">
          <button type="button" className={btn} onClick={() => zoomTo(scale / 1.25)} aria-label={t("sample.zoomOut")} title={t("sample.zoomOut")}>
            <Minus className="w-5 h-5" />
          </button>
          <button type="button" className={btn} onClick={() => zoomTo(scale * 1.25)} aria-label={t("sample.zoomIn")} title={t("sample.zoomIn")}>
            <Plus className="w-5 h-5" />
          </button>
          <button type="button" className={btn} onClick={onClose} aria-label={t("sample.close")} title={t("sample.close")}>
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      {urls.length > 1 && (
        <>
          <button
            type="button"
            className={`${btn} absolute left-3 top-1/2 -translate-y-1/2`}
            onClick={() => go(-1)}
            disabled={page === 0}
            aria-label={t("sample.prev")}
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button
            type="button"
            className={`${btn} absolute right-3 top-1/2 -translate-y-1/2`}
            onClick={() => go(1)}
            disabled={page === urls.length - 1}
            aria-label={t("sample.next")}
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </>
      )}
    </div>,
    document.body,
  );
}
