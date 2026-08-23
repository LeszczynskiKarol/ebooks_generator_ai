// ─────────────────────────────────────────────────────────────────────────────
// Wspólny silnik FOTOGRAFICZNYCH teł okładek (blog hero + okładki książek).
// Parametry, sufiksy i kryteria recenzji: backend/shared/cover-style.json —
// ten sam plik czyta CI bloga (site/scripts/gen-missing-covers.mjs), więc
// wszystkie flow generują identycznie i nie mogą się rozjechać.
// Pipeline: (scena) → FLUX ultra raw → downscale → recenzja Sonneta (wizja)
// → akceptacja albo kolejna próba (max_attempts) → Buffer jpg.
// ─────────────────────────────────────────────────────────────────────────────
import fs from "fs";
import path from "path";
import { generateFluxImage } from "./illustrationService";

export interface CoverStyleConfig {
  model: string;
  raw: boolean;
  aspect_ratio: string;
  style_tail: string;
  book: {
    aspect_ratio: string;
    style_tail: string;
    scene_builder: { model: string; instruction: string };
  };
  review: { model: string; max_attempts: number; criteria: string };
}

export function loadCoverStyle(): CoverStyleConfig {
  const p = path.join(__dirname, "../../shared/cover-style.json");
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

/** Recenzja zdjęcia przez Sonneta (wizja). Zwraca {accept, reason}.
 *  Brak ANTHROPIC_API_KEY ⇒ accept (środowisko dev z Ollamą). */
export async function reviewCoverPhoto(
  buffer: Buffer,
  scene: string,
  cfg: CoverStyleConfig,
): Promise<{ accept: boolean; reason: string }> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { accept: true, reason: "brak ANTHROPIC_API_KEY — recenzja pominięta" };
  // Downscale — pełny jpg z ultra umie przekroczyć limit obrazu API
  // (odpowiedź wraca wtedy z pustym content).
  const sharp = (await import("sharp")).default;
  const small = await sharp(buffer).resize(1024).jpeg({ quality: 80 }).toBuffer();
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: cfg.review.model,
      max_tokens: 500,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: "image/jpeg", data: small.toString("base64") } },
            { type: "text", text: `${cfg.review.criteria}\n\nZadany prompt sceny: "${scene}"\n\nOdpowiedz WYŁĄCZNIE JSON-em: {"accept": true|false, "reason": "maksymalnie 10 słów"}` },
          ],
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`anthropic HTTP ${res.status}`);
  const data: any = await res.json();
  const txt = (data.content || []).map((c: any) => c.text || "").join(" ").trim();
  // Werdykt regexem — ucięty JSON akceptacji nie może liczyć się jako odrzut.
  const acc = txt.match(/"accept"\s*:\s*(true|false)/);
  if (!acc) return { accept: false, reason: `brak werdyktu (stop=${data.stop_reason})` };
  const reason = (txt.match(/"reason"\s*:\s*"([^"]*)/) || [])[1] || "";
  return { accept: acc[1] === "true", reason };
}

/** Generuj + recenzuj w pętli. null gdy wszystkie próby odrzucone/nieudane. */
export async function generateReviewedPhoto(
  scene: string,
  opts: { aspectRatio: string; styleTail: string },
  log?: (m: string) => void,
): Promise<{ buffer: Buffer; attempts: number; review: string } | null> {
  const cfg = loadCoverStyle();
  let lastReason = "";
  for (let attempt = 1; attempt <= cfg.review.max_attempts; attempt++) {
    if (attempt > 1) log?.(`  ponawiam tło (próba ${attempt}/${cfg.review.max_attempts}) — ${lastReason}`);
    const image = await generateFluxImage(scene + opts.styleTail, cfg.raw, undefined, {
      aspectRatio: opts.aspectRatio,
    });
    if (!image) {
      lastReason = "FLUX nie zwrócił obrazu";
      continue;
    }
    const verdict = await reviewCoverPhoto(image.buffer, scene, cfg);
    if (verdict.accept) return { buffer: image.buffer, attempts: attempt, review: verdict.reason };
    lastReason = verdict.reason;
  }
  log?.(`  tło odrzucone ${cfg.review.max_attempts}× — ${lastReason}`);
  return null;
}

/** Scena tła okładki KSIĄŻKI: Haiku z tematu/tytułu; fallback szablonowy. */
export async function buildBookCoverScene(
  topic: string,
  title?: string | null,
): Promise<string> {
  const cfg = loadCoverStyle();
  const fallback = `A moody atmospheric scene evoking the topic on a wooden desk: relevant physical objects arranged simply, one deep indigo element`;
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return fallback;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: cfg.book.scene_builder.model,
        max_tokens: 150,
        messages: [
          {
            role: "user",
            content: `${cfg.book.scene_builder.instruction}\n\nTemat książki: ${topic}${title ? `\nTytuł: ${title}` : ""}`,
          },
        ],
      }),
    });
    if (!res.ok) return fallback;
    const data: any = await res.json();
    const txt = (data.content?.[0]?.text || "").trim().replace(/^["']|["']$/g, "");
    return txt.length > 20 ? txt : fallback;
  } catch {
    return fallback;
  }
}
