// Standalone cover smoke-test (no DB, no S3).
// Usage:  npx tsx scripts/cover-test.ts <bookKey>[:frameId] ...
//   bookKey: minimalizm | ziola | finanse
//   frameId (optional): editorial-top | center-stage | bottom-panel | top-band-block
//                       (omit → the model picks the frame itself)
// Outputs: backend/tmp/cover-test/cover-<bookKey>.png (+ tmp/covers/test-<bookKey>/)
import "dotenv/config";
import * as path from "path";
import * as fs from "fs";
import { exec } from "child_process";
import { promisify } from "util";
import { designCoverForBook } from "../src/services/coverDesigner";

const execAsync = promisify(exec);
const log = {
  step: (m: string) => console.log(m),
  ok: (m: string) => console.log(m),
  warn: (m: string) => console.log("WARN " + m),
  err: (m: string) => console.log("ERR " + m),
  timer: () => () => "",
};

// NB: titles in correct Polish SENTENCE CASE (only the first word capitalised).
const BOOKS: Record<string, any> = {
  minimalizm: {
    title: "Atlas cyfrowego minimalizmu",
    subtitle: "Jak odzyskać uwagę w świecie nieustannych powiadomień",
    topic: "cyfrowy minimalizm, higiena uwagi, produktywność",
    language: "pl",
    stylePreset: "modern",
    customColors: [],
    format: "a5",
    targetPages: 180,
    chapterTitles: ["Ekonomia uwagi", "Architektura rozproszenia", "Głęboka praca"],
    authorName: "dr Anna Wiśniewska",
  },
  ziola: {
    title: "Zioła w polskim ogrodzie",
    subtitle: "Uprawa, zbiór i zastosowanie czterdziestu roślin",
    topic: "zioła, ogrodnictwo, uprawa roślin leczniczych, fitoterapia",
    language: "pl",
    stylePreset: "creative",
    customColors: [],
    format: "b5",
    targetPages: 220,
    chapterTitles: ["Ogród zielny od podstaw", "Zbiór i suszenie", "Apteczka z ogrodu"],
    authorName: "Maria Zielińska",
  },
  wystapienia: {
    title: "Sztuka wystąpień publicznych",
    subtitle: "Jak mówić, żeby ludzie naprawdę słuchali",
    topic: "wystąpienia publiczne, retoryka, komunikacja, prezentacje",
    language: "pl",
    stylePreset: "modern",
    customColors: [],
    format: "a5",
    targetPages: 190,
    chapterTitles: ["Trema pod kontrolą", "Struktura przekonującej mowy", "Głos i pauza"],
    authorName: "Piotr Adamski",
  },
  kuchnia: {
    title: "Kuchnia śródziemnomorska",
    subtitle: "Sezonowe przepisy z oliwą, ziołami i słońcem",
    topic: "kuchnia śródziemnomorska, gotowanie, przepisy, dieta",
    language: "pl",
    stylePreset: "creative",
    customColors: [],
    format: "b5",
    targetPages: 240,
    chapterTitles: ["Spiżarnia podstaw", "Warzywa i strączki", "Ryby i owoce morza"],
    authorName: "Laura Bianchi",
  },
  finanse: {
    title: "Finanse osobiste bez stresu",
    subtitle: "Budżet, oszczędzanie i inwestowanie dla początkujących",
    topic: "finanse osobiste, budżet domowy, oszczędzanie, inwestowanie",
    language: "pl",
    stylePreset: "business",
    customColors: [],
    format: "a5",
    targetPages: 200,
    chapterTitles: ["Twój budżet w jednym arkuszu", "Poduszka bezpieczeństwa", "Pierwsze inwestycje"],
    authorName: "Tomasz Kowalczyk",
  },
};

async function main() {
  const args = process.argv.slice(2);
  const useBg = args.includes("--bg");
  const specs = args.filter((a) => a !== "--bg");
  if (!specs.length) {
    console.log("usage: cover-test.ts <bookKey>[:frameId] ...");
    process.exit(1);
  }
  const outDir = path.join(process.cwd(), "tmp", "cover-test");
  fs.mkdirSync(outDir, { recursive: true });

  for (const spec of specs) {
    const [bookKey, frameId] = spec.split(":");
    const book = BOOKS[bookKey];
    if (!book) {
      console.log(`unknown book "${bookKey}" — known: ${Object.keys(BOOKS).join(", ")}`);
      continue;
    }
    console.log(`\n========== BOOK: ${bookKey}${frameId ? ` (frame=${frameId})` : " (model picks frame)"} ==========`);
    const coverDir = path.join(process.cwd(), "tmp", "covers", `test-${bookKey}`);
    const res = await designCoverForBook(book, coverDir, {
      log,
      forceFrameId: frameId || undefined,
      disableBackground: !useBg,
    });
    if (!res) {
      console.log(`>>> ${bookKey}: FAILED (returned null)`);
      continue;
    }
    const out = path.join(outDir, `cover-${bookKey}.png`);
    await execAsync(
      `pdftoppm -png -singlefile -r 300 -aa yes -aaVector yes "cover-designed.pdf" "${out.replace(/\.png$/, "")}"`,
      { cwd: coverDir, timeout: 60000 },
    );
    console.log(`>>> ${bookKey}: OK  score=${res.score}  frame=${res.frameId}  png=${out}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
