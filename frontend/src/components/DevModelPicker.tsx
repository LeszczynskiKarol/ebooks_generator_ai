// frontend/src/components/DevModelPicker.tsx
// Przyklejony panel (DEV-only, admin-only) do szybkiego wyboru modelu LLM.
// Renderuje się tylko w `vite dev` i tylko gdy GET /api/admin/llm-model zwróci 200
// (czyli zalogowany jest admin). W buildzie produkcyjnym znika całkowicie.
import { useEffect, useState } from "react";
import { Cpu, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import apiClient from "@/lib/api";

interface ModelOption {
  key: string;
  label: string;
  provider: "auto" | "anthropic" | "ollama";
}
interface Selection {
  key: string;
  options: ModelOption[];
  locked: boolean;
  ollamaModel: string;
}

export default function DevModelPicker() {
  const [sel, setSel] = useState<Selection | null>(null);
  const [open, setOpen] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    apiClient
      .get("/admin/llm-model")
      .then((r) => setSel(r.data))
      .catch(() => setSel(null)); // nie-admin / błąd → ukryj
  }, []);

  // Twardy bezpiecznik: nigdy w produkcyjnym buildzie.
  if (!import.meta.env.DEV || !sel) return null;

  const pick = async (key: string) => {
    if (key === sel.key || busy) return;
    setBusy(key);
    try {
      const r = await apiClient.post("/admin/llm-model", { key });
      setSel(r.data);
    } catch {
      /* zignoruj */
    } finally {
      setBusy(null);
    }
  };

  const dot = (p: ModelOption["provider"]) =>
    p === "ollama"
      ? "bg-amber-400"
      : p === "anthropic"
        ? "bg-violet-400"
        : "bg-gray-400";

  return (
    <div className="fixed bottom-4 right-4 z-[9999] w-60 rounded-xl border border-gray-700 bg-gray-900/95 text-gray-100 shadow-2xl backdrop-blur">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 rounded-t-xl px-3 py-2 text-left"
      >
        <Cpu className="h-4 w-4 text-emerald-400" />
        <span className="text-xs font-semibold tracking-wide">
          DEV · Model LLM
        </span>
        <span className="ml-auto text-[10px] text-gray-400">
          {sel.locked ? "PROD-lock" : sel.key}
        </span>
        {open ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronUp className="h-4 w-4" />
        )}
      </button>

      {open && (
        <div className="space-y-1 px-2 pb-2">
          {sel.options.map((o) => {
            const active = o.key === sel.key;
            return (
              <button
                key={o.key}
                type="button"
                disabled={sel.locked || !!busy}
                onClick={() => pick(o.key)}
                className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs transition-colors ${
                  active
                    ? "bg-emerald-500/20 ring-1 ring-emerald-400/50"
                    : "hover:bg-white/5"
                } disabled:opacity-50`}
              >
                <span className={`h-2 w-2 rounded-full ${dot(o.provider)}`} />
                <span className="truncate text-left">{o.label}</span>
                {busy === o.key ? (
                  <Loader2 className="ml-auto h-3 w-3 animate-spin" />
                ) : active ? (
                  <span className="ml-auto text-emerald-400">●</span>
                ) : null}
              </button>
            );
          })}
          <p className="px-1 pt-1 text-[10px] leading-tight text-gray-500">
            Dotyczy całego pipeline generowania. Tylko dev.
          </p>
        </div>
      )}
    </div>
  );
}
