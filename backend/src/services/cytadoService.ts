// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Cytado — realne źródła AKADEMICKIE dla researchu książki.
// Wzorowane 1:1 na smart-copy.ai (cytadoService), z JEDNĄ istotną różnicą:
// inkmagnet MA aparat przypisów (footnoteMode + citationGuards parsujące
// markery "=== STRONA N ==="), więc markery stron ZOSTAJĄ w tekście źródła —
// dzięki temu rozdziały mogą cytować z prawdziwymi numerami stron, a
// citationGuards ma je czym zweryfikować. (smart-copy jest citation-free
// i markery wycina.)
//
// Decyzję "czy temat potrzebuje źródeł naukowych" podejmuje LLM
// (classifySourceMode) — academic | web | hybrid. Fail-open: każdy błąd
// cytado degraduje do zwykłego researchu webowego.
//
// Env: CYTADO_BASE_URL, CYTADO_SERVICE_TOKEN, CYTADO_SOURCE_MODE ("off"
// wyłącza), CYTADO_CLASSIFIER_MODEL (opcjonalny, default Haiku).
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import axios from "axios";
import { createLLMClient } from "../lib/llm";

const anthropic = createLLMClient();

const BASE = process.env.CYTADO_BASE_URL || "";
const TOKEN = process.env.CYTADO_SERVICE_TOKEN || "";
const CLASSIFIER_MODEL =
  process.env.CYTADO_CLASSIFIER_MODEL || "claude-haiku-4-5-20251001";

export type SourceMode = "academic" | "web" | "hybrid";

export interface AcademicSource {
  url: string;
  text: string; // z markerami "=== STRONA N ===" — NIE wycinać
  length: number;
  lang: string;
  academic: true;
}

export function cytadoEnabled(): boolean {
  return !!BASE && !!TOKEN && process.env.CYTADO_SOURCE_MODE !== "off";
}

/** en → ["en"]; inne → [lang, "en"] (jak w smart-copy). */
export function cytadoLangs(language: string): string[] {
  const l2 = (language || "en").slice(0, 2).toLowerCase();
  return l2 === "en" ? ["en"] : [l2, "en"];
}

/**
 * LLM decyduje, jakie źródła pasują do tematu książki.
 * Każdy błąd → "web" (fail-open, research idzie po staremu).
 */
export async function classifySourceMode(
  topic: string,
  guidelines?: string | null,
): Promise<SourceMode> {
  try {
    const message = await anthropic.messages.create({
      model: CLASSIFIER_MODEL,
      max_tokens: 16,
      temperature: 0,
      messages: [
        {
          role: "user",
          content: `Oceń, jakie ŹRÓDŁA najlepiej pasują do tej książki (e-book):
TEMAT: ${topic}
WYTYCZNE: ${guidelines || "brak"}

- "academic": treść ekspercka/faktograficzna, gdzie wiarygodność ma znaczenie — YMYL (zdrowie, medycyna, finanse, prawo), edukacja, psychologia, pedagogika, analizy, badania, tematy naukowe.
- "web": treść praktyczna/hobbystyczna/lifestyle — poradnik hobbystyczny, kulinaria, podróże, rozwój osobisty bez aparatu naukowego.
- "hybrid": treść faktograficzna, która potrzebuje TAKŻE aktualnego kontekstu z internetu (przepisy prawne, egzaminy, ceny, narzędzia).

Odpowiedz JEDNYM słowem: academic, web albo hybrid.`,
        },
      ],
    });
    const raw =
      message.content[0]?.type === "text"
        ? message.content[0].text.toLowerCase()
        : "";
    if (raw.includes("academic")) return "academic";
    if (raw.includes("hybrid")) return "hybrid";
    return "web";
  } catch {
    return "web";
  }
}

/**
 * POST {CYTADO_BASE_URL}/api/ext/chapter-sources — fragmenty realnych źródeł
 * naukowych z printed page numbers. axios (nie fetch) — undici ubija długie
 * provisioning/harvest przez headersTimeout. Każdy błąd → [] (fail-open).
 */
export async function fetchAcademicSources(
  topic: string,
  langs: string[],
  limit = 6,
  timeoutMs = 8 * 60 * 1000,
): Promise<AcademicSource[]> {
  if (!cytadoEnabled()) return [];
  try {
    const res = await axios.post(
      `${BASE}/api/ext/chapter-sources`,
      {
        topic,
        langs,
        limit,
        minCoverage: 4,
        maxWaitMs: Math.max(30_000, timeoutMs - 30_000),
      },
      {
        headers: { authorization: `Bearer ${TOKEN}` },
        timeout: timeoutMs,
      },
    );
    const sources: any[] = Array.isArray(res.data?.sources)
      ? res.data.sources
      : [];
    return sources
      .filter((s) => s?.url && s?.text)
      .map((s) => ({
        url: String(s.url),
        text: String(s.text), // markery === STRONA N === zostają dla przypisów
        length: String(s.text).length,
        lang: String(s.language || langs[0] || "en"),
        academic: true as const,
      }));
  } catch {
    return [];
  }
}
