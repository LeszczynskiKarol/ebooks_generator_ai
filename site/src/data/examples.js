/**
 * Sample books shown on /examples (EN) and /pl/przyklady (PL).
 *
 * ── HOW TO ADD A BOOK ──────────────────────────────────────────────────────
 *   1. Put the finished PDF in   site/public/samples/<slug>.pdf
 *   2. Add an entry to the array below (use the book's REAL title from its cover).
 *   3. Run:   node scripts/build-examples.mjs
 *      → renders the cover thumbnail  public/samples/covers/<slug>.webp
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

/** @typedef {{ slug:string, title:string, lang:"pl"|"en", category:"cooking"|"marketing"|"tech"|"academic", style:string, pages:number, desc:{pl:string,en:string}, featured?:boolean }} ExampleBook */

/** @type {ExampleBook[]} */
export const examples = [
  {
    slug: "inkmagnet-sample-book-pl",
    title: "Kuchnia śródziemnomorska w polskim wydaniu",
    lang: "pl",
    category: "cooking",
    style: "Creative",
    pages: 40,
    featured: true,
    desc: {
      pl: "Poradnik kulinarny z fotografiami AI dopasowanymi do konkretnych przepisów, autorską okładką i pełnym składem typograficznym.",
      en: "A cookery guide with AI photographs matched to specific recipes, a bespoke cover and full typesetting.",
    },
  },
  {
    slug: "latex-bez-tajemnic",
    title: "Profesjonalny skład tekstu bez tajemnic",
    lang: "pl",
    category: "tech",
    style: "Modern",
    pages: 60,
    desc: {
      pl: "Techniczny podręcznik o profesjonalnym składzie tekstu (LaTeX) — listingi kodu, tabele i klikalny spis treści.",
      en: "A technical handbook on professional text typesetting (LaTeX) — code listings, tables and a clickable contents.",
    },
  },
  {
    slug: "ankieta-licencjat",
    title: "Ankieta w pracy licencjackiej: kompendium praktyczne od pytania do wykresu",
    lang: "pl",
    category: "academic",
    style: "Academic",
    pages: 36,
    desc: {
      pl: "Akademickie kompendium metodologiczne — pełny aparat przypisów, tabele i wykresy.",
      en: "An academic methodology compendium — full footnote apparatus, tables and charts.",
    },
  },
  {
    slug: "wywiad-magisterka",
    title: "Wywiad w pracy magisterskiej: kompleksowy poradnik",
    lang: "pl",
    category: "academic",
    style: "Academic",
    pages: 35,
    desc: {
      pl: "Przewodnik metodologiczny po wywiadzie badawczym — od projektu aż po obronę.",
      en: "A methodology guide to research interviews — from study design to the defence.",
    },
  },
  {
    slug: "licencjat-pielegniarstwo",
    title: "Licencjat z pielęgniarstwa: kompendium wiedzy i praktyki",
    lang: "pl",
    category: "academic",
    style: "Academic",
    pages: 34,
    desc: {
      pl: "Kompendium do pracy licencjackiej z pielęgniarstwa — od wyboru tematu do obrony.",
      en: "A nursing-thesis compendium — from picking a topic to the defence.",
    },
  },
  {
    slug: "licencjat-pedagogika-kompendium",
    title: "Licencjat z pedagogiki: kompendium wiedzy i praktyki",
    lang: "pl",
    category: "academic",
    style: "Academic",
    pages: 31,
    desc: {
      pl: "Kompendium do pracy licencjackiej z pedagogiki — teoria, metodologia i praktyka.",
      en: "A pedagogy-thesis compendium — theory, methodology and practice.",
    },
  },
  {
    slug: "licencjat-administracja",
    title: "Licencjat z administracji: kompendium wiedzy i praktyki",
    lang: "pl",
    category: "academic",
    style: "Academic",
    pages: 33,
    desc: {
      pl: "Kompendium do pracy licencjackiej z administracji — od wyboru tematu po obronę.",
      en: "A public-administration thesis compendium — from topic to defence.",
    },
  },
  {
    slug: "licencjat-psychologia",
    title: "Licencjat z psychologii: kompendium wiedzy i praktyki",
    lang: "pl",
    category: "academic",
    style: "Academic",
    pages: 37,
    desc: {
      pl: "Kompendium do pracy licencjackiej z psychologii — metodologia i aparat źródłowy.",
      en: "A psychology-thesis compendium — methodology and source apparatus.",
    },
  },
  {
    slug: "ebook-lead-magnet",
    title: "Ebook as a Lead Magnet: when and how to use one",
    lang: "en",
    category: "marketing",
    style: "Modern",
    pages: 33,
    desc: {
      pl: "Anglojęzyczny ebook marketingowy o lead magnetach — statystyki, ramki i konkretne wnioski.",
      en: "A marketing ebook on lead magnets — stats, callout boxes and concrete takeaways.",
    },
  },
];

/** Books shown on a given page: PL shows all, EN shows only English books. */
export function booksFor(pageLang) {
  return pageLang === "pl" ? examples : examples.filter((b) => b.lang === "en");
}

/** schema.org ItemList of the example books (each a Book linking to its PDF),
 *  so search engines index the downloads with the right titles. */
export function exampleBooksJsonLd(pageLang, siteUrl) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: pageLang === "pl" ? "Przykładowe ebooki InkMagnet" : "InkMagnet example ebooks",
    itemListElement: booksFor(pageLang).map((b, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": "Book",
        name: b.title,
        inLanguage: b.lang,
        numberOfPages: b.pages,
        bookFormat: "https://schema.org/EBook",
        author: { "@type": "Organization", name: "InkMagnet" },
        publisher: { "@type": "Organization", name: "InkMagnet" },
        url: `${siteUrl}/samples/${b.slug}.pdf`,
        image: `${siteUrl}/samples/covers/${b.slug}.webp`,
        encoding: {
          "@type": "MediaObject",
          contentUrl: `${siteUrl}/samples/${b.slug}.pdf`,
          encodingFormat: "application/pdf",
        },
      },
    })),
  };
}
