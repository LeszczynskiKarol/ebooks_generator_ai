// For every book in src/data/examples.js:
//   1. set the PDF /Title + /Author metadata (so Google indexes a good title,
//      not the first heading on page 1),
//   2. render the cover (page 1) to public/samples/covers/<slug>.webp.
// Run from site/:  node scripts/build-examples.mjs
import { examples } from "../src/data/examples.js";
import { execFileSync } from "node:child_process";
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const SAMPLES = "public/samples";
const COVERS = path.join(SAMPLES, "covers");
fs.mkdirSync(COVERS, { recursive: true });

let ok = 0, missing = 0;
for (const b of examples) {
  const pdfPath = path.join(SAMPLES, b.slug + ".pdf");
  if (!fs.existsSync(pdfPath)) {
    console.warn("  ⚠ missing PDF:", pdfPath, "— skipping");
    missing++;
    continue;
  }

  // 1. metadata
  try {
    const doc = await PDFDocument.load(fs.readFileSync(pdfPath), { updateMetadata: false });
    doc.setTitle(b.title);
    doc.setAuthor("InkMagnet");
    doc.setSubject("Sample ebook generated with InkMagnet — inkmagnet.com");
    doc.setKeywords(["InkMagnet", "AI ebook", "sample"]);
    fs.writeFileSync(pdfPath, await doc.save());
  } catch (e) {
    console.warn("  ⚠ metadata failed for", b.slug, "—", e.message);
  }

  // 2. cover (page 1) → webp
  const coverOut = path.join(COVERS, b.slug + ".webp");
  const tmp = path.join(os.tmpdir(), "exc-" + b.slug);
  try {
    execFileSync("pdftoppm", ["-png", "-r", "150", "-f", "1", "-l", "1", pdfPath, tmp], { stdio: "ignore" });
    const png = fs.readdirSync(os.tmpdir()).find((f) => f.startsWith("exc-" + b.slug));
    await sharp(path.join(os.tmpdir(), png)).flatten({ background: "#fff" }).resize({ width: 520 }).webp({ quality: 80 }).toFile(coverOut);
    fs.unlinkSync(path.join(os.tmpdir(), png));
    const kb = (fs.statSync(coverOut).size / 1024).toFixed(0);
    console.log(`  ✓ ${b.slug}  (title set, cover ${kb}KB)`);
    ok++;
  } catch (e) {
    console.warn("  ⚠ cover failed for", b.slug, "—", e.message);
  }
}
console.log(`done: ${ok} ok, ${missing} missing`);
