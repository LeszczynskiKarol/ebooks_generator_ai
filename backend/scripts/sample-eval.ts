// Quality check of the free style sample on real orders × presets × formats
// (PAID: preview + brief + sample text ≈ $0.09 per case). Writes, per case,
// tmp/sample-eval/<name>/{sample.tex,meta.json}; typeset them with TeX Live
// (locally or on the server) and inspect the page images.
// Usage: NODE_ENV=production npx tsx scripts/sample-eval.ts <orders.json> <cases.json>
//   cases.json: [{ "name", "order": <index>, "stylePreset", "bookFormat" }]
// NODE_ENV=production bypasses the dev model override (.dev-llm.json).
import "dotenv/config";
import fs from "fs";
import path from "path";
import { generatePreview, previewCostUsd } from "../src/services/previewGenerator";
import { generateAuthorBrief } from "../src/services/briefGenerator";
import { writeSampleOpening } from "../src/services/contentGenerator";
import { buildSampleTex } from "../src/services/sampleGenerator";
import { resolveNumbering } from "../src/lib/numbering";
import { getWordsPerPage, footnotesEnabled } from "../src/lib/types";
import { createPipelineLogger } from "../src/lib/logger";

async function main() {
  const orders = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
  const cases = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
  let total = 0;
  for (const c of cases) {
    const o = orders[c.order];
    const project = {
      topic: o.topic,
      title: o.title,
      guidelines: o.guidelines,
      language: o.language,
      targetPages: o.targetPages,
      stylePreset: c.stylePreset,
      bookFormat: c.bookFormat,
      footnoteMode: "auto",
    };
    const log = createPipelineLogger("SAMPLE-EVAL", c.name);
    const usage: Array<[string, number, number]> = [];
    const origApi = log.api.bind(log);
    (log as any).api = (m: string, i: number, o2: number) => {
      usage.push([m, i, o2]);
      origApi(m, i, o2);
    };
    const t0 = Date.now();
    try {
      const pv = await generatePreview(project);
      usage.push([pv.model, pv.inputTokens, pv.outputTokens]);
      if (pv.preview.rejected) throw new Error(`preview rejected: ${pv.preview.reason}`);
      const brief = await generateAuthorBrief({ ...project, sourcesDigest: "", log });
      const numbering = resolveNumbering({
        language: project.language,
        authorBrief: JSON.stringify(brief),
      });
      const wpp = getWordsPerPage(project.bookFormat);
      const latex = await writeSampleOpening({
        bookTitle: pv.preview.suggestedTitle,
        topic: project.topic,
        language: project.language,
        stylePreset: project.stylePreset,
        guidelines: project.guidelines || "",
        brief,
        bookFormat: project.bookFormat,
        chapters: pv.preview.chapters,
        allowFootnotes: footnotesEnabled(project),
        numbering,
        words: Math.round(wpp * 4.7),
        log,
      });
      const dir = path.join(process.cwd(), "tmp", "sample-eval", c.name);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(
        path.join(dir, "sample.tex"),
        buildSampleTex({
          title: pv.preview.suggestedTitle,
          chapterTitle: pv.preview.chapters[0].title,
          latex,
          language: project.language,
          format: project.bookFormat,
          stylePreset: project.stylePreset,
          stripFootnotes: !footnotesEnabled(project),
          numbering,
        }),
        "utf8",
      );
      const cost = usage.reduce((a, [m, i, o2]) => a + previewCostUsd(m, i, o2), 0);
      total += cost;
      fs.writeFileSync(
        path.join(dir, "meta.json"),
        JSON.stringify({ case: c, title: pv.preview.suggestedTitle, genre: brief.genre, cost, secs: (Date.now() - t0) / 1000, latex }, null, 2),
      );
      console.log(`${c.name}: OK $${cost.toFixed(4)} ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    } catch (e: any) {
      console.log(`${c.name}: FAILED ${e?.message}`);
    }
  }
  console.log(`TOTAL $${total.toFixed(4)}`);
}
main();
