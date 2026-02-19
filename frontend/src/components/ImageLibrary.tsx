// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BookForge — Image Library + Insert (WordPress-style) v2
// Uses backend proxy URLs for thumbnails (no CORS issues)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Upload,
  Loader2,
  Trash2,
  X,
  Image as ImageIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Minus,
  Plus,
  Check,
} from "lucide-react";
import toast from "react-hot-toast";
import apiClient from "@/lib/api";

// ── Types ──

export type ImageAlignment = "center" | "wrap-left" | "wrap-right";

export interface ProjectImageData {
  id: string;
  originalName: string;
  s3Key: string;
  s3Url: string;
  /** Backend proxy URL — use this for <img> display */
  displayUrl: string;
  description?: string | null;
  width?: number | null;
  height?: number | null;
  format?: string | null;
  createdAt?: string;
}

export interface ImageInsertPayload {
  imageId: string;
  /** S3 URL — stored in LaTeX, rewritten at compile time */
  src: string;
  /** Proxy URL — used for preview in editor */
  displaySrc: string;
  originalName: string;
  alignment: ImageAlignment;
  widthPercent: number;
  caption: string;
}

// ── Props ──

interface ImageLibraryProps {
  projectId: string;
  open: boolean;
  onClose: () => void;
  onInsert: (payload: ImageInsertPayload) => void;
}

const SIZE_PRESETS = [
  { label: "Small", value: 30 },
  { label: "Medium", value: 50 },
  { label: "Large", value: 75 },
  { label: "Full", value: 100 },
];

const ALIGNMENT_OPTIONS: {
  value: ImageAlignment;
  label: string;
  icon: typeof AlignCenter;
  desc: string;
}[] = [
  {
    value: "wrap-left",
    label: "Left",
    icon: AlignLeft,
    desc: "Text wraps on right",
  },
  {
    value: "center",
    label: "Center",
    icon: AlignCenter,
    desc: "Between paragraphs",
  },
  {
    value: "wrap-right",
    label: "Right",
    icon: AlignRight,
    desc: "Text wraps on left",
  },
];

export default function ImageLibrary({
  projectId,
  open,
  onClose,
  onInsert,
}: ImageLibraryProps) {
  const [images, setImages] = useState<ProjectImageData[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<ProjectImageData | null>(
    null,
  );
  const [alignment, setAlignment] = useState<ImageAlignment>("center");
  const [widthPercent, setWidthPercent] = useState(75);
  const [caption, setCaption] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Load images ──
  const loadImages = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get(`/projects/${projectId}/images`);
      setImages(res.data.data || []);
    } catch {
      toast.error("Failed to load images");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (open) {
      loadImages();
      setSelectedImage(null);
      setCaption("");
    }
  }, [open, loadImages]);

  // ── Upload ──
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Max 10 MB");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await apiClient.post(
        `/projects/${projectId}/images/upload`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } },
      );
      const newImage = res.data.data;
      setImages((prev) => [newImage, ...prev]);
      setSelectedImage(newImage);
      toast.success("Image uploaded!");
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // ── Delete ──
  const handleDelete = async (imageId: string) => {
    if (!confirm("Delete this image?")) return;
    try {
      await apiClient.delete(`/projects/${projectId}/images/${imageId}`);
      setImages((prev) => prev.filter((i) => i.id !== imageId));
      if (selectedImage?.id === imageId) setSelectedImage(null);
      toast.success("Deleted");
    } catch {
      toast.error("Delete failed");
    }
  };

  // ── Insert ──
  const handleInsert = () => {
    if (!selectedImage) return;
    onInsert({
      imageId: selectedImage.id,
      src: selectedImage.s3Url, // S3 URL for LaTeX storage
      displaySrc: selectedImage.displayUrl, // Proxy URL for editor preview
      originalName: selectedImage.originalName,
      alignment,
      widthPercent,
      caption,
    });
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-2xl w-[900px] max-w-[95vw] max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-primary-500" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              Insert Image
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* ── Left: Image grid ── */}
          <div className="w-[55%] border-r border-gray-200 dark:border-gray-700 flex flex-col">
            <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handleUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium disabled:opacity-50"
              >
                {uploading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                {uploading ? "Uploading..." : "Upload Image"}
              </button>
              <span className="ml-3 text-xs text-gray-500">
                JPEG, PNG, WebP, GIF · Max 10 MB
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 text-primary-500 animate-spin" />
                </div>
              ) : images.length === 0 ? (
                <div className="text-center py-12">
                  <ImageIcon className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                  <p className="text-sm text-gray-500">No images yet.</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  {images.map((img) => {
                    const isSelected = selectedImage?.id === img.id;
                    return (
                      <div
                        key={img.id}
                        className={`relative group cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${
                          isSelected
                            ? "border-primary-500 ring-2 ring-primary-500/30 shadow-lg"
                            : "border-transparent hover:border-gray-300 dark:hover:border-gray-600"
                        }`}
                        onClick={() => setSelectedImage(img)}
                      >
                        <div className="aspect-square bg-gray-100 dark:bg-gray-800">
                          {/* ★ Use displayUrl (proxy) — not s3Url */}
                          <img
                            src={img.s3Url}
                            alt={img.originalName}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        </div>
                        {isSelected && (
                          <div className="absolute top-2 right-2 w-6 h-6 bg-primary-500 rounded-full flex items-center justify-center">
                            <Check className="w-3.5 h-3.5 text-white" />
                          </div>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(img.id);
                          }}
                          className="absolute top-2 left-2 w-6 h-6 bg-red-500 text-white rounded-full items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hidden group-hover:flex"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-1.5">
                          <p className="text-[10px] text-white truncate">
                            {img.originalName}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ── Right: Controls ── */}
          <div className="w-[45%] flex flex-col">
            {selectedImage ? (
              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                {/* Preview */}
                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
                  <img
                    src={selectedImage.s3Url}
                    alt={selectedImage.originalName}
                    className="w-full rounded-lg object-contain max-h-48"
                  />
                  <p className="text-xs text-gray-500 mt-2 text-center truncate">
                    {selectedImage.originalName}
                    {selectedImage.width && selectedImage.height && (
                      <span className="ml-2 text-gray-400">
                        {selectedImage.width}×{selectedImage.height}px
                      </span>
                    )}
                  </p>
                </div>

                {/* Alignment */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Alignment
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {ALIGNMENT_OPTIONS.map((opt) => {
                      const Icon = opt.icon;
                      const isActive = alignment === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setAlignment(opt.value)}
                          className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all text-center ${
                            isActive
                              ? "border-primary-500 bg-primary-50 dark:bg-primary-950/30"
                              : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
                          }`}
                        >
                          <Icon
                            className={`w-5 h-5 ${isActive ? "text-primary-600 dark:text-primary-400" : "text-gray-500"}`}
                          />
                          <span
                            className={`text-xs font-medium ${isActive ? "text-primary-700 dark:text-primary-300" : "text-gray-600 dark:text-gray-400"}`}
                          >
                            {opt.label}
                          </span>
                          <span className="text-[10px] text-gray-400">
                            {opt.desc}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Size */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Size — {widthPercent}% of text width
                  </label>
                  <div className="flex gap-2 mb-3">
                    {SIZE_PRESETS.map((p) => (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => setWidthPercent(p.value)}
                        className={`flex-1 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                          widthPercent === p.value
                            ? "border-primary-500 bg-primary-50 dark:bg-primary-950/30 text-primary-700 dark:text-primary-300"
                            : "border-gray-200 dark:border-gray-700 text-gray-500 hover:border-gray-300"
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        setWidthPercent(Math.max(20, widthPercent - 5))
                      }
                      className="p-1 text-gray-400 hover:text-gray-600"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <input
                      type="range"
                      min={20}
                      max={100}
                      step={5}
                      value={widthPercent}
                      onChange={(e) =>
                        setWidthPercent(parseInt(e.target.value))
                      }
                      className="flex-1 accent-primary-600"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setWidthPercent(Math.min(100, widthPercent + 5))
                      }
                      className="p-1 text-gray-400 hover:text-gray-600"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Preview */}
                  <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                    <p className="text-[10px] text-gray-400 mb-2 text-center">
                      Layout preview
                    </p>
                    <AlignmentPreview
                      alignment={alignment}
                      widthPercent={widthPercent}
                    />
                  </div>
                </div>

                {/* Caption */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Caption (optional)
                  </label>
                  <input
                    type="text"
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    placeholder="e.g., Figure 1: Market share comparison"
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none"
                  />
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center p-8">
                <div className="text-center">
                  <ImageIcon className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                  <p className="text-sm text-gray-500">Select an image</p>
                  <p className="text-xs text-gray-400 mt-1">
                    or upload a new one
                  </p>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="px-5 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-end gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleInsert}
                disabled={!selectedImage}
                className="inline-flex items-center gap-2 px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Check className="w-4 h-4" />
                Insert Image
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AlignmentPreview({
  alignment,
  widthPercent,
}: {
  alignment: ImageAlignment;
  widthPercent: number;
}) {
  const imgW = `${Math.round(widthPercent * 0.6)}%`;
  const lines = (
    <>
      <div className="h-1.5 bg-gray-300 dark:bg-gray-600 rounded-full w-full" />
      <div className="h-1.5 bg-gray-300 dark:bg-gray-600 rounded-full w-[90%]" />
      <div className="h-1.5 bg-gray-300 dark:bg-gray-600 rounded-full w-[95%]" />
      <div className="h-1.5 bg-gray-300 dark:bg-gray-600 rounded-full w-[80%]" />
    </>
  );

  if (alignment === "center") {
    return (
      <div className="space-y-1.5">
        <div className="space-y-1">{lines}</div>
        <div className="flex justify-center py-1">
          <div
            className="h-8 bg-primary-200 dark:bg-primary-800 rounded"
            style={{ width: imgW }}
          />
        </div>
        <div className="space-y-1">{lines}</div>
      </div>
    );
  }

  const isLeft = alignment === "wrap-left";
  return (
    <div className="flex gap-2">
      {isLeft && (
        <div
          className="h-16 bg-primary-200 dark:bg-primary-800 rounded flex-shrink-0"
          style={{ width: imgW }}
        />
      )}
      <div className="flex-1 space-y-1">
        {lines}
        {lines}
      </div>
      {!isLeft && (
        <div
          className="h-16 bg-primary-200 dark:bg-primary-800 rounded flex-shrink-0"
          style={{ width: imgW }}
        />
      )}
    </div>
  );
}
