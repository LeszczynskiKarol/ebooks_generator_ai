/**
 * Sample books shown on /pl/przyklady (and a future EN /examples).
 *
 * ── HOW TO ADD A BOOK ──────────────────────────────────────────────────────
 *   1. Put the finished PDF in   site/public/samples/<slug>.pdf
 *      (PDFs are gitignored — after building, upload them to S3:
 *       aws s3 cp site/public/samples/<slug>.pdf s3://inkmagnet-site-prod/samples/
 *         --content-type application/pdf --cache-control "public,max-age=86400"
 *       CI's `s3 sync --delete` excludes samples/*.pdf so they survive deploys.)
 *   2. Add an entry to the array below (use the book's REAL title from its cover).
 *   3. Run:   node scripts/build-examples.mjs
 *      → renders the cover thumbnail  public/samples/covers/<slug>.webp  (committed)
 *        and writes the PDF's /Title metadata, so Google indexes the file with a
 *        good title instead of the first heading on page 1 (e.g. "KUCHNIA").
 *
 * Fields:
 *   slug     file name in public/samples (and the cover .webp name)
 *   title    the book's REAL title (read it off the cover) — also written into
 *            the PDF /Title for SEO
 *   lang     language the BOOK is written in. The EN /examples page shows only
 *            lang:"en"; the PL /pl/przyklady page shows every book.
 *   category "cooking" | "marketing" | "tech" | "academic" (label translated in
 *            ExampleBooks.astro)
 *   style    visual style preset used (shown as a small tag)
 *   pages    page count
 *   desc     { pl, en } short description, rendered in the page's language
 *   featured optional — pulled to the front of the grid
 */

/** @typedef {{ slug:string, title:string, lang:"pl"|"en", category:"cooking"|"marketing"|"tech"|"academic"|"fitness", style:string, pages:number, desc:{pl:string,en:string}, featured?:boolean }} ExampleBook */

/** @type {ExampleBook[]} */
export const examples = [
  {
    slug: "trening-silowy-w-domu-30-cwiczen",
    title: "Trening siłowy w domu — 30 ćwiczeń bez sprzętu i z hantlami",
    lang: "pl",
    category: "fitness",
    style: "Modern",
    pages: 54,
    desc: {
      pl: "30 ćwiczeń z ciągłą numeracją pogrupowanych w partie mięśniowe, fotografie AI, plany treningowe i zasady progresji.",
      en: "30 continuously numbered exercises grouped by muscle part, AI photographs, training plans and progression rules.",
    },
  },
  {
    slug: "air-fryer-60-prostych-przepisow",
    title: "Air fryer — 60 prostych przepisów na każdy dzień",
    lang: "pl",
    category: "cooking",
    style: "Modern",
    pages: 56,
    featured: true,
    desc: {
      pl: "60 przepisów z ciągłą numeracją, fotografie AI dopasowane do konkretnych potraw, ściągawki czasów i temperatur.",
      en: "60 continuously numbered recipes, AI photographs matched to specific dishes, time and temperature cheat-sheets.",
    },
  },
  {
    slug: "thermomix-proste-obiady-dla-zabieganych",
    title: "Thermomix — proste obiady dla zabieganych",
    lang: "pl",
    category: "cooking",
    style: "Modern",
    pages: 55,
    featured: true,
    desc: {
      pl: "Poradnik z przepisami bazowymi, tabelami porównawczymi i planem tygodnia — część podręcznikowa przeplata się z numerowanymi przepisami.",
      en: "A guide with base recipes, comparison tables and a weekly plan — handbook chapters interleaved with numbered recipes.",
    },
  },
];
