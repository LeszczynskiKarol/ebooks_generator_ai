// backend/src/lib/llm.ts
// ─────────────────────────────────────────────────────────────────────────────
// Jeden punkt wyboru modelu LLM dla całego backendu + przełącznik DEV.
//
//   Produkcja: zawsze Claude, model taki jaki podaje serwis (override IGNOROWANY).
//   Dev:       admin może w locie wybrać model (auto / sonnet / haiku / ollama)
//              przez /api/admin/llm-model — bez restartu.
//
// Start domyślny w dev bierze z env LLM_PROVIDER (ollama → "ollama", inaczej "auto").
// Wybór jest zapisywany do `backend/.dev-llm.json`, więc przeżywa restart tsx watch.
//
// Env (tryb ollama): OLLAMA_BASE_URL (def http://localhost:11434),
//   OLLAMA_MODEL (def gemma4:latest), OLLAMA_NUM_CTX (def 8192).
// ─────────────────────────────────────────────────────────────────────────────
import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";

const IS_PROD = process.env.NODE_ENV === "production";

const LLM_PROVIDER = (process.env.LLM_PROVIDER || "anthropic").toLowerCase();
const OLLAMA_BASE_URL = (
  process.env.OLLAMA_BASE_URL || "http://localhost:11434"
).replace(/\/$/, "");
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "gemma4:latest";
const OLLAMA_NUM_CTX = parseInt(process.env.OLLAMA_NUM_CTX || "8192", 10);

// ── Lista wybieralnych modeli (dev) ──
export type ProviderKind = "auto" | "anthropic" | "ollama";
export interface ModelOption {
  key: string;
  label: string;
  provider: ProviderKind;
  model?: string; // wymuszany model (anthropic)
}

export const MODEL_OPTIONS: ModelOption[] = [
  { key: "auto", label: "Auto (domyślne per-serwis)", provider: "auto" },
  {
    key: "sonnet",
    label: "Claude Sonnet 4.6",
    provider: "anthropic",
    model: "claude-sonnet-4-6",
  },
  {
    key: "haiku",
    label: "Claude Haiku 4.5",
    provider: "anthropic",
    model: "claude-haiku-4-5-20251001",
  },
  { key: "ollama", label: `Ollama — ${OLLAMA_MODEL}`, provider: "ollama" },
];

// ── Bieżący wybór (dev) z persystencją do pliku ──
const STATE_FILE = path.resolve(process.cwd(), ".dev-llm.json");

function defaultKey(): string {
  return LLM_PROVIDER === "ollama" ? "ollama" : "auto";
}

function loadKey(): string {
  try {
    const k = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"))?.key;
    if (MODEL_OPTIONS.some((o) => o.key === k)) return k;
  } catch {
    /* brak pliku — użyj domyślnego */
  }
  return defaultKey();
}

let selectedKey = loadKey();

function persistKey() {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify({ key: selectedKey }));
  } catch (e: any) {
    console.warn("⚠️  Nie udało się zapisać .dev-llm.json:", e?.message);
  }
}

export function getSelection() {
  return {
    key: IS_PROD ? "auto" : selectedKey,
    options: MODEL_OPTIONS,
    locked: IS_PROD, // w produkcji przełącznik nieaktywny
    ollamaModel: OLLAMA_MODEL,
  };
}

export function setSelection(key: string) {
  if (IS_PROD) return { ok: false as const, key: "auto" };
  if (!MODEL_OPTIONS.some((o) => o.key === key)) {
    throw new Error(`Nieznany klucz modelu: ${key}`);
  }
  selectedKey = key;
  persistKey();
  console.log(`🎛️  LLM dev model → ${key}`);
  return { ok: true as const, key };
}

// ── Klient Anthropic (lazy) ──
let _anthropic: Anthropic | null = null;
function anthropic(): Anthropic {
  if (!_anthropic)
    _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _anthropic;
}

// ── Ollama: tłumaczenie parametrów Anthropic → /api/chat ──
function toOllamaMessages(params: Anthropic.MessageCreateParamsNonStreaming) {
  const out: Array<{ role: string; content: string }> = [];
  if (typeof params.system === "string" && params.system.length) {
    out.push({ role: "system", content: params.system });
  } else if (Array.isArray(params.system)) {
    const sys = params.system
      .map((b: any) => (b?.type === "text" ? b.text : ""))
      .join("");
    if (sys) out.push({ role: "system", content: sys });
  }
  for (const m of params.messages) {
    const content =
      typeof m.content === "string"
        ? m.content
        : Array.isArray(m.content)
          ? m.content
              .map((b: any) => (b?.type === "text" ? b.text : ""))
              .join("")
          : String(m.content ?? "");
    out.push({ role: m.role, content });
  }
  return out;
}

async function ollamaCreate(
  params: Anthropic.MessageCreateParamsNonStreaming,
): Promise<Anthropic.Message> {
  const options: Record<string, number> = { num_ctx: OLLAMA_NUM_CTX };
  if (typeof params.max_tokens === "number")
    options.num_predict = params.max_tokens;
  if (typeof params.temperature === "number")
    options.temperature = params.temperature;

  const resp = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      messages: toOllamaMessages(params),
      stream: false,
      options,
    }),
  });
  if (!resp.ok) {
    const detail = await resp.text().catch(() => "");
    throw new Error(`Ollama /api/chat ${resp.status}: ${detail.slice(0, 300)}`);
  }
  const data: any = await resp.json();
  const text: string = data?.message?.content ?? "";
  const stop_reason = data?.done_reason === "length" ? "max_tokens" : "end_turn";
  return {
    id: "ollama-" + (data?.created_at ?? ""),
    type: "message",
    role: "assistant",
    model: data?.model || OLLAMA_MODEL,
    content: [{ type: "text", text, citations: null }],
    stop_reason,
    stop_sequence: null,
    usage: {
      input_tokens: data?.prompt_eval_count ?? 0,
      output_tokens: data?.eval_count ?? 0,
    },
  } as unknown as Anthropic.Message;
}

// ── Retry z backoffem ──
// SDK Anthropic sam retry'uje pojedyncze żądania (429/5xx, krótkie odstępy);
// ta warstwa łapie dłuższe niedyspozycje (overloaded, sieć, timeout, Ollama),
// żeby jeden czknięty request nie ubijał całego rozdziału/pipeline'u.
const LLM_RETRY_ATTEMPTS = Math.max(
  1,
  parseInt(process.env.LLM_RETRY_ATTEMPTS || "3", 10),
);

function isRetryableLLMError(err: any): boolean {
  if (err instanceof Anthropic.APIConnectionError) return true;
  const status = err?.status ?? err?.statusCode;
  if (status === 408 || status === 429) return true;
  if (typeof status === "number" && status >= 500) return true;
  // Ollama / fetch: błędy sieciowe bez statusu HTTP
  const msg = String(err?.message || "");
  if (
    /fetch failed|ECONNREFUSED|ECONNRESET|ETIMEDOUT|EAI_AGAIN|socket hang up|network|overloaded/i.test(
      msg,
    )
  ) {
    return true;
  }
  return false;
}

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= LLM_RETRY_ATTEMPTS; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastErr = err;
      if (attempt === LLM_RETRY_ATTEMPTS || !isRetryableLLMError(err)) {
        throw err;
      }
      // 2s, 8s, 32s... + jitter ±25%, cap 60s
      const base = Math.min(60_000, 2_000 * 4 ** (attempt - 1));
      const delay = Math.round(base * (0.75 + Math.random() * 0.5));
      console.warn(
        `⚠️  LLM call failed (attempt ${attempt}/${LLM_RETRY_ATTEMPTS}: ` +
          `${err?.status || err?.message || err}) — retry in ${delay}ms`,
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

// ── Routing per-wywołanie wg bieżącego wyboru ──
async function unifiedCreate(
  params: Anthropic.MessageCreateParamsNonStreaming,
): Promise<Anthropic.Message> {
  const opt = IS_PROD
    ? undefined
    : MODEL_OPTIONS.find((o) => o.key === selectedKey);

  if (opt?.provider === "ollama") return withRetry(() => ollamaCreate(params));
  if (opt?.provider === "anthropic" && opt.model) {
    const forcedModel = opt.model;
    return withRetry(
      async () =>
        (await anthropic().messages.create({
          ...params,
          model: forcedModel,
        })) as Anthropic.Message,
    );
  }
  // auto / produkcja → model taki, jaki podał serwis
  return withRetry(
    async () =>
      (await anthropic().messages.create(params)) as Anthropic.Message,
  );
}

let _client: Anthropic | null = null;

/**
 * Zwraca klienta LLM gadającego interfejsem `anthropic.messages.create`.
 * Routing (Claude vs Ollama, wymuszony model) rozstrzygany jest per-wywołanie
 * wg bieżącego wyboru — zmiana przez setSelection() działa bez restartu.
 */
export function createLLMClient(): Anthropic {
  if (_client) return _client;
  const shim = { messages: { create: unifiedCreate } };
  _client = shim as unknown as Anthropic;

  const sel = getSelection();
  console.log(
    `🤖 LLM klient gotowy — start: "${sel.key}"${
      sel.locked ? " (PROD: przełącznik zablokowany)" : ""
    }`,
  );
  return _client;
}
