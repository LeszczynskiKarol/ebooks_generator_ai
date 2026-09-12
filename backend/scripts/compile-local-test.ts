// Compile a set of chapter .tex files through the REAL assembleLatexDocument
// (sanitizer + preamble) locally, without DB/S3. Reports LaTeX errors and
// overfull boxes. Usage:
//   npx tsx scripts/compile-local-test.ts <dir with chN.tex> <outDir> [preset] [format] [lang]
import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import { assembleLatexDocument } from "../src/services/bookCompiler";

const [dir, outDir, preset = "modern", format = "a5", lang = "en"] =
  process.argv.slice(2);
if (!dir || !outDir) {
  console.error("usage: <dir> <outDir> [preset] [format] [lang]");
  process.exit(1);
}
fs.mkdirSync(outDir, { recursive: true });
const files = fs
  .readdirSync(dir)
  .filter((f) => /^ch\d+\.tex$/.test(f))
  .sort((a, b) => parseInt(a.slice(2)) - parseInt(b.slice(2)));
const chapters = files.map((f) => {
  const latexContent = fs.readFileSync(path.join(dir, f), "utf-8");
  const m = latexContent.match(/\\chapter\{([^}]*)\}/);
  return {
    chapterNumber: parseInt(f.slice(2)),
    title: m ? m[1] : f,
    latexContent,
  };
});
const tex = assembleLatexDocument({
  title: "Melbourne Student Starter: 2026–2027 Edition",
  language: lang,
  format,
  stylePreset: preset,
  authorName: "Test",
  coverType: "NONE",
  stripFootnotes: false,
  chapters,
});
const texPath = path.join(outDir, "book.tex");
fs.writeFileSync(texPath, tex, "utf-8");
console.log(`book.tex: ${tex.length} chars, ${chapters.length} chapters`);
for (let pass = 1; pass <= 3; pass++) {
  try {
    execSync(
      `lualatex -interaction=nonstopmode -halt-on-error -output-directory="${outDir}" "${texPath}"`,
      { cwd: outDir, stdio: "pipe", timeout: 300000, maxBuffer: 50 * 1024 * 1024 },
    );
    console.log(`pass ${pass} ok`);
  } catch (e: any) {
    console.log(`pass ${pass} FAILED`);
    const log = fs.readFileSync(path.join(outDir, "book.log"), "utf-8");
    const i = log.indexOf("\n!");
    console.log(log.slice(i, i + 1500));
    process.exit(2);
  }
}
const log = fs.readFileSync(path.join(outDir, "book.log"), "utf-8");
const over = [...log.matchAll(/Overfull \\hbox \(([\d.]+)pt too wide\)[^\n]*\n([^\n]*)/g)];
console.log(`Overfull hboxes: ${over.length}`);
for (const o of over) console.log(`  ${o[1]}pt  ${o[2].slice(0, 100)}`);
console.log(`Errors: ${(log.match(/^! /gm) || []).length}`);
const pages = execSync(`pdfinfo "${path.join(outDir, "book.pdf")}"`).toString().match(/Pages:\s+(\d+)/);
console.log(`Pages: ${pages ? pages[1] : "?"}`);
