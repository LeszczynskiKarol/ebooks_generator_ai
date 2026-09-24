import { useEffect, useRef, useState } from "react";
import { FileText, Loader2, Paperclip, X, AlertCircle } from "lucide-react";
import apiClient from "@/lib/api";
import { useT } from "@/lib/i18n";

export interface UploadedMaterial {
  id: string;
  fileName: string;
  sizeBytes: number;
  charCount: number;
  truncated: boolean;
}

// Keep in sync with backend src/lib/materialExtract.ts + materialRoutes.ts
const ACCEPT =
  ".pdf,.doc,.docx,.odt,.ott,.rtf,.txt,.md,.csv,.html,.htm,.pptx,.odp";
const ALLOWED = new Set(ACCEPT.split(",").map((e) => e.slice(1)));
const MAX_FILES = 10;
const MAX_MB = 20;

interface Pending {
  key: string;
  fileName: string;
  error?: string;
}

function formatChars(n: number) {
  return n >= 1000 ? `${Math.round(n / 1000)}k` : String(n);
}

/**
 * Drop zone for reference files (guidelines, examples, sources, inspirations)
 * in the order form. Each file uploads immediately; the backend extracts its
 * text and returns an id that the form sends as `materialIds`.
 */
export default function MaterialsUpload({
  value,
  onChange,
  onBusyChange,
}: {
  value: UploadedMaterial[];
  onChange: (next: UploadedMaterial[]) => void;
  /** true while any file is still uploading — the form holds submit */
  onBusyChange?: (busy: boolean) => void;
}) {
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [pending, setPending] = useState<Pending[]>([]);
  // Uploads finish out of order — always append to the latest list.
  const latest = useRef(value);
  latest.current = value;

  const uploadOne = async (file: File) => {
    const key = `${file.name}-${file.size}-${Math.random()}`;
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    const fail = (error: string) =>
      setPending((p) => [...p.filter((x) => x.key !== key), { key, fileName: file.name, error }]);

    if (!ALLOWED.has(ext)) return fail(t("newProject.materialsErrType"));
    if (file.size > MAX_MB * 1024 * 1024)
      return fail(t("newProject.materialsErrSize", { mb: MAX_MB }));

    setPending((p) => [...p, { key, fileName: file.name }]);
    try {
      const form = new FormData();
      form.append("file", file);
      const { data } = await apiClient.post("/materials", form);
      setPending((p) => p.filter((x) => x.key !== key));
      onChange([...latest.current, data.data]);
    } catch (err: any) {
      const code = err.response?.data?.code;
      fail(
        code === "empty"
          ? t("newProject.materialsErrEmpty")
          : code === "unsupported"
            ? t("newProject.materialsErrType")
            : code === "too_large"
              ? t("newProject.materialsErrSize", { mb: MAX_MB })
              : err.response?.data?.error || t("newProject.materialsErrGeneric"),
      );
    }
  };

  const addFiles = (list: FileList | null) => {
    if (!list || list.length === 0) return;
    const room = MAX_FILES - value.length - pending.filter((p) => !p.error).length;
    const files = Array.from(list);
    files.slice(0, Math.max(0, room)).forEach(uploadOne);
    if (files.length > room) {
      setPending((p) => [
        ...p,
        { key: `limit-${Date.now()}`, fileName: "", error: t("newProject.materialsErrCount", { n: MAX_FILES }) },
      ]);
    }
  };

  const remove = (m: UploadedMaterial) => {
    onChange(value.filter((x) => x.id !== m.id));
    apiClient.delete(`/materials/${m.id}`).catch(() => {});
  };

  const busy = pending.some((p) => !p.error);
  useEffect(() => {
    onBusyChange?.(busy);
  }, [busy, onBusyChange]);

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        addFiles(e.dataTransfer.files);
      }}
      className={`mt-2 rounded-lg border-2 border-dashed px-4 py-3 transition-colors ${
        dragOver
          ? "border-primary-500 bg-primary-50 dark:bg-primary-950"
          : "border-gray-200 dark:border-gray-700"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 dark:text-primary-400 hover:underline"
        >
          <Paperclip className="w-4 h-4" />
          {t("newProject.materialsButton")}
        </button>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {t("newProject.materialsHint")}
        </span>
      </div>
      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
        {t("newProject.materialsFormats", { mb: MAX_MB, n: MAX_FILES })}
      </p>

      {(value.length > 0 || pending.length > 0) && (
        <ul className="mt-3 space-y-1.5">
          {value.map((m) => (
            <li
              key={m.id}
              className="flex items-center gap-2 text-sm bg-gray-50 dark:bg-gray-800 rounded-md px-2.5 py-1.5"
            >
              <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <span className="truncate text-gray-800 dark:text-gray-200">{m.fileName}</span>
              <span className="ml-auto flex-shrink-0 text-xs text-gray-500 dark:text-gray-400">
                {t("newProject.materialsChars", { n: formatChars(m.charCount) })}
                {m.truncated && ` · ${t("newProject.materialsTruncated")}`}
              </span>
              <button
                type="button"
                onClick={() => remove(m)}
                className="p-0.5 text-gray-400 hover:text-red-500"
                aria-label={t("newProject.materialsRemove")}
              >
                <X className="w-4 h-4" />
              </button>
            </li>
          ))}
          {pending.map((p) => (
            <li
              key={p.key}
              className={`flex items-center gap-2 text-sm rounded-md px-2.5 py-1.5 ${
                p.error
                  ? "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400"
                  : "bg-gray-50 dark:bg-gray-800 text-gray-500"
              }`}
            >
              {p.error ? (
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
              ) : (
                <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
              )}
              <span className="truncate">
                {p.fileName && `${p.fileName}${p.error ? " — " : ""}`}
                {p.error || t("newProject.materialsReading")}
              </span>
              {p.error && (
                <button
                  type="button"
                  onClick={() => setPending((x) => x.filter((y) => y.key !== p.key))}
                  className="ml-auto p-0.5 hover:text-red-900"
                  aria-label={t("newProject.materialsRemove")}
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
