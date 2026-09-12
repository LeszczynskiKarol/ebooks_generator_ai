// Sanity check of repairEditorArtifacts against real damaged chapters.
// Usage: npx tsx scripts/test-editor-repair.ts <dir-with-ch1..4.tex>
import * as fs from "fs";
import * as path from "path";
import { repairEditorArtifacts, urlifyTexttt } from "../src/lib/latexFixes";

const dir = process.argv[2];
if (!dir) {
  console.error("dir required");
  process.exit(1);
}
let bad = 0;
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".tex"))) {
  const src = fs.readFileSync(path.join(dir, f), "utf-8");
  const out = urlifyTexttt(repairEditorArtifacts(src));
  const fn = (s: string) => (s.match(/\\footnote\{/g) || []).length;
  const leaks = (s: string) =>
    (s.match(/class="footnote"|\[\*\]|\\textbackslash\{\} |<sup|<\/a>/g) || [])
      .length;
  console.log(
    `${f}: footnotes ${fn(src)} → ${fn(out)}, artifacts ${leaks(src)} → ${leaks(out)}, texttt ${(src.match(/\\texttt\{/g) || []).length} → ${(out.match(/\\texttt\{/g) || []).length}`,
  );
  if (leaks(out) > 0) bad++;
  // print every recovered footnote for eyeballing
  for (const m of out.matchAll(/\\footnote\{\\url\{[^}]*\}[^\n]{0,120}/g)) {
    console.log("   ", m[0].slice(0, 160));
  }
  // idempotency
  if (repairEditorArtifacts(out) !== out) {
    console.log("   ❌ NOT idempotent");
    bad++;
  }
}
// unit cases
const cases: [string, string][] = [
  [
    'Melbourne has 259,000 international students.www.studymelbourne.vic.gov.au" class="footnote">[*] Most of them',
    "Melbourne has 259,000 international students.\\footnote{\\url{www.studymelbourne.vic.gov.au}} Most of them",
  ],
  [
    'per day.transport.vic.gov.au/news-and-resources/news/public-transport-now-half-price-for-everyone." class="footnote">[*] A single',
    "per day.\\footnote{\\url{transport.vic.gov.au/news-and-resources/news/public-transport-now-half-price-for-everyone}} A single",
  ],
  ["\\bignumber{$5.70}{cap}", "\\bignumber{\\$5.70}{cap}"],
  ["\\bignumber{\\$5.70}{cap}", "\\bignumber{\\$5.70}{cap}"],
  ["approx.\\textbackslash{} AUD 15", "approx.\\ AUD 15"],
  ["20--40\\textbackslash{},GB", "20--40\\,GB"],
  ["cloud storage.[*]\n", "cloud storage.\n"],
  ["clean \\footnote{Author: \\url{https://x.y/z}} text", "clean \\footnote{Author: \\url{https://x.y/z}} text"],
];
for (const [inp, exp] of cases) {
  const got = repairEditorArtifacts(inp);
  const ok = got === exp;
  if (!ok) bad++;
  console.log(ok ? "✅" : "❌", JSON.stringify(inp.slice(0, 70)), ok ? "" : "\n   got: " + JSON.stringify(got));
}
console.log(bad ? `FAILED (${bad})` : "ALL OK");
process.exit(bad ? 1 : 0);
