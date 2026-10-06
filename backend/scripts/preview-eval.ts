// Quality/cost check of the free pre-payment preview on real orders.
// Usage: NODE_ENV=production npx tsx scripts/preview-eval.ts <orders.json> <outDir> <idx,idx,...> <model,model>
// NODE_ENV=production bypasses the dev model override (.dev-llm.json).
import "dotenv/config";
import fs from "fs";
import path from "path";
import { generatePreview } from "../src/services/previewGenerator";

async function main() {
  const [ordersPath, outDir, idxArg, modelsArg] = process.argv.slice(2);
  const orders = JSON.parse(fs.readFileSync(ordersPath, "utf8"));
  const idx = idxArg.split(",").map(Number);
  const models = modelsArg.split(",");
  fs.mkdirSync(outDir, { recursive: true });
  let total = 0;
  for (const i of idx) {
    const o = orders[i];
    for (const model of models) {
      const t0 = Date.now();
      try {
        const r = await generatePreview(
          {
            topic: o.topic,
            title: o.title,
            guidelines: o.guidelines,
            language: o.language,
            targetPages: o.targetPages,
            stylePreset: o.stylePreset,
          },
          model,
        );
        total += r.costUsd;
        const secs = ((Date.now() - t0) / 1000).toFixed(1);
        fs.writeFileSync(
          path.join(outDir, `${i}-${model}.json`),
          JSON.stringify({ order: o, ...r, secs }, null, 2),
        );
        console.log(
          `#${i} ${model} ${secs}s in=${r.inputTokens} out=${r.outputTokens} $${r.costUsd.toFixed(4)} chapters=${r.preview.chapters.length} rejected=${!!r.preview.rejected}`,
        );
      } catch (e: any) {
        console.log(`#${i} ${model} FAILED ${e?.message}`);
      }
    }
  }
  console.log(`TOTAL $${total.toFixed(4)}`);
}
main();
