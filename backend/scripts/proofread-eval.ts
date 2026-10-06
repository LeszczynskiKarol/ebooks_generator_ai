/**
 * Eval of the editorial proofread (Phase 4.6) on a book's ORIGINAL chapters:
 * runs proofreadConsistency + proofreadLanguage and reports which known
 * errors were fixed. PAID (Sonnet 5 with thinking, ~$1.1 per 55-page book).
 *
 *   npx tsx scripts/proofread-eval.ts <chapters.json>
 *
 * chapters.json: [{chapterNumber, latexContent}] (dump from prod Chapter rows).
 */
import "dotenv/config";
import fs from "fs";
import { proofreadConsistency, proofreadLanguage } from "../src/services/contentGenerator";
import { llmCostUsd } from "../src/lib/costTracker";

// Errors found by hand in the 2026-10-06 example book (cmuwrniff0001jw5odmeggjo0).
const KNOWN = [
  "dla every pań",
  "Checklist:",
  "[Podpis imienne]",
  "Dzień 16 -- 17",
  "Jesteśmy czynne",
  "ten drugi przypadek: profil istniał",
  "osiemnaście nowych opinii zamiast ośmiu",
  "Fryzjerka Ela",
  "sezonowy, problem klienta)",
  "Jak pokazywaliśmy w~rozdziale 1, Google liczy",
];

let usage = { in: 0, out: 0 };
const log = {
  step: (m: string) => console.log(m),
  warn: (m: string) => console.warn(m),
  api: (_m: string, i: number, o: number) => {
    usage.in += i;
    usage.out += o;
  },
};

async function main() {
  const raw = JSON.parse(fs.readFileSync(process.argv[2], "utf-8")) as Array<{
    chapterNumber: number;
    latexContent: string;
  }>;
  const chapters = raw.map((c) => ({ number: c.chapterNumber, latex: c.latexContent }));
  const before = chapters.map((c) => c.latex).join("\n");

  const consistent = await proofreadConsistency(chapters, "pl", log);
  const final = await Promise.all(
    chapters.map((c) => proofreadLanguage(consistent.get(c.number) ?? c.latex, "pl", log)),
  );
  const after = final.join("\n");

  console.log("\n── Known errors ──");
  let fixed = 0;
  for (const k of KNOWN) {
    const was = before.includes(k);
    const still = after.includes(k);
    if (was && !still) fixed++;
    console.log(`${was ? (still ? "✗ MISSED" : "✓ fixed ") : "  (absent)"}  ${k}`);
  }
  const cost = llmCostUsd("claude-sonnet-5", { input_tokens: usage.in, output_tokens: usage.out });
  console.log(`\n${fixed}/${KNOWN.length} known errors fixed; tokens in ${usage.in}, out ${usage.out}; ≈ $${cost.toFixed(3)}`);
  fs.writeFileSync(process.argv[2].replace(/\.json$/, ".proofed.json"), JSON.stringify(final), "utf-8");
}

main();
