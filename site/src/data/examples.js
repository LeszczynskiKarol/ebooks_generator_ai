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

/** @typedef {{ slug:string, title:string, lang:"pl"|"en", category:"cooking"|"marketing"|"tech"|"academic"|"fitness"|"kariera"|"finanse", style:string, pages:number, desc:{pl:string,en:string}, featured?:boolean }} ExampleBook */

/** @type {ExampleBook[]} */
export const examples = [
  {
    slug: "strength-training-at-home-30-exercises",
    title: "Strength Training at Home — 30 Bodyweight and Dumbbell Exercises",
    lang: "en",
    category: "fitness",
    style: "Premium",
    pages: 52,
    featured: true,
    desc: {
      pl: "Angielskie wydanie „Treningu siłowego w domu” — 30 ćwiczeń z ciągłą numeracją, plany treningowe i zasady progresji.",
      en: "30 continuously numbered exercises grouped by muscle part, AI photographs, training plans and progression rules.",
    },
  },
  {
    slug: "air-fryer-60-simple-recipes",
    title: "Air Fryer — 60 Simple Recipes for Every Day",
    lang: "en",
    category: "cooking",
    style: "Modern",
    pages: 55,
    featured: true,
    desc: {
      pl: "Angielskie wydanie książki o air fryerze — 60 numerowanych przepisów z fotografiami AI i ściągawkami czasów.",
      en: "60 continuously numbered recipes, AI photographs matched to specific dishes, time and temperature cheat-sheets.",
    },
  },
  {
    slug: "thermomix-simple-dinners",
    title: "Thermomix — Simple Dinners for Busy People",
    lang: "en",
    category: "cooking",
    style: "Modern",
    pages: 51,
    desc: {
      pl: "Angielskie wydanie poradnika Thermomix — przepisy bazowe, tabele porównawcze i plan tygodnia.",
      en: "Base recipes, comparison tables and a weekly plan — handbook chapters interleaved with numbered recipes.",
    },
  },
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
    slug: "zmiana-zawodu-po-40-przewodnik-przebranzowienia",
    title: "Zmiana zawodu po 40 — przewodnik przebranżowienia",
    lang: "pl",
    category: "kariera",
    style: "Modern",
    pages: 87,
    featured: true,
    desc: {
      pl: "Uczciwy rachunek kosztów zmiany i pozostania, audyt kompetencji, wybór kierunku na danych rynku pracy, finansowanie (KFS, ulgi ZUS) i plan przejścia bez rzucania etatu z dnia na dzień.",
      en: "Polish-market career change guide: cost accounting, skills audit, retraining funding and a transition plan that doesn't start with quitting.",
    },
  },
  {
    slug: "jak-wyjsc-z-dlugow-plan-krok-po-kroku",
    title: "Jak wyjść z długów — plan krok po kroku",
    lang: "pl",
    category: "finanse",
    style: "Modern",
    pages: 55,
    desc: {
      pl: "Arkusz długów, budżet awaryjny, negocjacje z wierzycielami, komornik i upadłość konsumencka — plan wychodzenia z zadłużenia oparty na polskich realiach i przepisach.",
      en: "Polish personal-debt playbook: debt sheet, crisis budget, creditor negotiations, bailiffs and consumer bankruptcy.",
    },
  },
  {
    slug: "career-change-after-40",
    title: "Career Change After 40",
    lang: "en",
    category: "kariera",
    style: "Business",
    pages: 38,
    desc: {
      pl: "Angielski poradnik przebranżowienia po czterdziestce — audyt kompetencji, przekwalifikowanie bez straty roku, ukryty rynek pracy i finansowa mechanika przejścia, na danych amerykańskiego Bureau of Labor Statistics.",
      en: "Skills audit, reskilling without wasting a year, the hidden job market and the financial mechanics of the move — grounded in U.S. Bureau of Labor Statistics data.",
    },
  },
  {
    slug: "how-to-get-out-of-debt-step-by-step-plan",
    title: "How to Get Out of Debt: A Step-by-Step Plan",
    lang: "en",
    category: "finanse",
    style: "Minimal",
    pages: 43,
    desc: {
      pl: "Angielski poradnik wychodzenia z długów na realiach USA — inwentarz zadłużenia, metody snowball i avalanche, negocjacje z wierzycielami, dane Fed i konkretne kwoty.",
      en: "Debt inventory, snowball vs avalanche, creditor negotiations and rebuilding credit — grounded in Federal Reserve data and real dollar figures.",
    },
  },
  {
    slug: "chatgpt-at-work-practical-office-guide",
    title: "ChatGPT at Work — A Practical Guide for the Office",
    lang: "en",
    category: "tech",
    style: "Modern",
    pages: 49,
    desc: {
      pl: "Angielskie wydanie przewodnika o ChatGPT w biurze — pisanie, arkusze, spotkania, automatyzacje i zasady bezpieczeństwa danych firmowych.",
      en: "Prompting that actually saves time, spreadsheets and data analysis, meeting notes, automations and the rules for company data.",
    },
  },
  {
    slug: "chatgpt-w-pracy-biurowej-praktyczny-przewodnik",
    title: "ChatGPT w pracy biurowej — praktyczny przewodnik",
    lang: "pl",
    category: "tech",
    style: "Modern",
    pages: 53,
    desc: {
      pl: "Prompty, które realnie oszczędzają czas, arkusze i analiza danych, notatki ze spotkań, automatyzacje oraz zasady bezpieczeństwa danych firmowych.",
      en: "Polish edition of the ChatGPT office guide — prompting, spreadsheets, meeting notes, automations and company data safety.",
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
