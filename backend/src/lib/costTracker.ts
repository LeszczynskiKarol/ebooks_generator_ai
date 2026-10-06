import { AsyncLocalStorage } from "node:async_hooks";
import { prisma } from "./prisma";

// One ledger for every paid call made for a project (Claude, FLUX, Serper).
// Callers don't pass projectId around: a job/route runs its work inside
// withCost(projectId, stage, fn) and the LLM client, FLUX and Serper helpers
// record into whatever context is active. Each record adds a CostEntry row
// and increments Project.totalCostUsd / totalTokensUsed — never overwrites.
//
// Before 2026-10-06 the book cost was `allTokens × $3/M` written over the
// project's total: output tokens priced as input, and preview, sample,
// structure, cover, research and illustrations missing.

interface CostCtx {
  projectId: string;
  stage: string;
}

const als = new AsyncLocalStorage<CostCtx>();

export function withCost<T>(projectId: string, stage: string, fn: () => Promise<T>): Promise<T> {
  return als.run({ projectId, stage }, fn);
}

/** $/1M tokens [input, output]. Cache reads bill at 0.1× input, writes 1.25×. */
const LLM_PRICES: Array<[RegExp, number, number]> = [
  [/haiku-4-5/, 1, 5],
  [/sonnet-5/, 2, 10],
  [/sonnet-4/, 3, 15],
];
const FALLBACK_PRICE: [number, number] = [3, 15];

export const UNIT_PRICES = {
  "flux-1.1-pro-ultra": 0.06, // Replicate, per image
  serper: 0.001, // per search (credit packs ≈ $1 / 1000)
} as const;

export function llmCostUsd(
  model: string,
  u: { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number | null; cache_creation_input_tokens?: number | null },
): number {
  const p = LLM_PRICES.find(([re]) => re.test(model));
  const [inP, outP] = p ? [p[1], p[2]] : FALLBACK_PRICE;
  return (
    ((u.input_tokens || 0) * inP +
      (u.cache_read_input_tokens || 0) * inP * 0.1 +
      (u.cache_creation_input_tokens || 0) * inP * 1.25 +
      (u.output_tokens || 0) * outP) /
    1_000_000
  );
}

async function record(e: {
  provider: string;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  units?: number;
  costUsd: number;
}) {
  const ctx = als.getStore();
  if (!ctx || !(e.costUsd > 0)) return;
  const tokens = (e.inputTokens || 0) + (e.outputTokens || 0);
  try {
    await prisma.$transaction([
      prisma.costEntry.create({
        data: {
          projectId: ctx.projectId,
          stage: ctx.stage,
          provider: e.provider,
          model: e.model,
          inputTokens: e.inputTokens || 0,
          outputTokens: e.outputTokens || 0,
          units: e.units || 0,
          costUsd: e.costUsd,
        },
      }),
      prisma.project.update({
        where: { id: ctx.projectId },
        data: {
          totalCostUsd: { increment: e.costUsd },
          ...(tokens ? { totalTokensUsed: { increment: tokens } } : {}),
        },
      }),
    ]);
  } catch (err: any) {
    // Accounting must never break generation.
    console.warn(`[COST] record failed: ${err.message}`);
  }
}

export function recordLLM(model: string, usage: any) {
  if (!usage) return;
  void record({
    provider: "anthropic",
    model,
    inputTokens:
      (usage.input_tokens || 0) +
      (usage.cache_read_input_tokens || 0) +
      (usage.cache_creation_input_tokens || 0),
    outputTokens: usage.output_tokens || 0,
    costUsd: llmCostUsd(model, usage),
  });
}

export function recordUnits(provider: keyof typeof UNIT_PRICES, units = 1) {
  void record({ provider, model: provider, units, costUsd: UNIT_PRICES[provider] * units });
}

/** Run a callback-style continuation (a Fastify hook's done()) inside a
 *  cost context — the pattern @fastify/request-context uses. */
export function runInCost(projectId: string, stage: string, next: () => void) {
  als.run({ projectId, stage }, next);
}

/** Re-label the active context (sequential pipeline phases). */
export function setCostStage(stage: string) {
  const ctx = als.getStore();
  if (ctx) ctx.stage = stage;
}
