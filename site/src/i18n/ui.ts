export const languages = { en: "English", pl: "Polski" } as const;
export type Lang = keyof typeof languages;
export const defaultLang: Lang = "en";

export function getLangFromUrl(url: URL): Lang {
  const [, first] = url.pathname.split("/");
  if (first === "pl") return "pl";
  return defaultLang;
}

/** Path prefix for a language ("" for en, "/pl" for pl). */
export function langPrefix(lang: Lang): string {
  return lang === defaultLang ? "" : `/${lang}`;
}

export const ui = {
  en: {
    nav: {
      tagline: "Ebook AI generator",
      how: "How it works",
      features: "Features",
      pricing: "Pricing",
      faq: "FAQ",
      examples: "Examples",
      blog: "Blog",
      signIn: "Sign in",
      cta: "Create your ebook",
    },
    hero: {
      badge: "AI ebook generator",
      title1: "The AI ebook generator that turns your topic into a",
      titleAccent: "professional book",
      title2: "in about an hour",
      sub: "InkMagnet is an AI ebook generator: describe a topic and it researches it on the web, writes every chapter with verifiable sources, designs the cover and delivers a print-quality PDF and EPUB. Not a template filler or a docx export — a real, typeset book.",
      ctaPrimary: "Start your book",
      ctaSecondary: "See how it works",
      bullets: [
        "Print-quality PDF + EPUB",
        "Web research with cited sources",
        "One fixed price per book",
      ],
    },
    how: {
      title: "From topic to finished book in four steps",
      sub: "You make the decisions. The pipeline does the work.",
      steps: [
        {
          title: "Describe your book",
          desc: "Topic, audience, language, target length, visual style. A title is optional — InkMagnet can propose one.",
        },
        {
          title: "Approve the structure",
          desc: "The engine researches your topic on the live web, then drafts a chapter-by-chapter outline. You edit or approve it.",
        },
        {
          title: "AI writes and designs",
          desc: "Every chapter is written, reviewed and typeset with professional book software. Optional AI illustrations are matched to your content.",
        },
        {
          title: "Download and publish",
          desc: "You get a press-ready PDF and a store-ready EPUB, with a designed cover. Edit any chapter in the built-in editor and recompile anytime.",
        },
      ],
    },
    features: {
      title: "What makes the books worth reading",
      sub: "Most AI book tools produce a long blog post in a PDF wrapper. InkMagnet builds actual books.",
      items: [
        {
          title: "Real web research",
          desc: "Before a single chapter is written, the engine researches your topic online and grounds the content in current, verifiable sources.",
        },
        {
          title: "Professional typesetting",
          desc: "Books are compiled with LaTeX — the system behind academic publishing. Proper margins, running heads, hyphenation, a clickable table of contents.",
        },
        {
          title: "AI illustrations that fit",
          desc: "Optional photographic or illustrated artwork generated per chapter, matched to your topic, language and region — included in the price.",
        },
        {
          title: "Designed covers",
          desc: "A cover is generated with your title, palette and layout of choice. Adjust it in the cover editor whenever you like.",
        },
        {
          title: "Your edits are sacred",
          desc: "Rewrite any chapter in the WYSIWYG editor. Regenerations never overwrite what you changed by hand.",
        },
        {
          title: "PDF + EPUB, ready to sell",
          desc: "A print-quality PDF and a valid EPUB for Kindle, Apple Books or your store. No watermarks, full commercial rights.",
        },
      ],
    },
    deepDive: {
      title: "More than a chatbot in a wrapper",
      sub: "A frontier model can write paragraphs. Turning those paragraphs into a book people actually finish takes a pipeline. Here is what runs behind every project.",
      items: [
        {
          title: "It researches before it writes a word",
          desc: "Most AI text is written from memory, which is exactly why it invents statistics and citations that fall apart on a fact-check. InkMagnet first searches the live web for your topic, reads real sources, and grounds every chapter in them — so the numbers, names and references point to things that actually exist.",
        },
        {
          title: "It writes the whole book, not one long answer",
          desc: "A 120-page book does not fit in a single chat answer — ask a chatbot and it truncates, repeats itself and forgets chapter 2 by chapter 9. InkMagnet plans a structure first, then writes and reviews each chapter against the others, keeping terminology, arguments and tone consistent from cover to conclusion.",
        },
        {
          title: "It typesets, illustrates and packages it",
          desc: "Real books are not markdown. Every project is compiled with LaTeX — the system behind academic publishing — with a clickable table of contents, proper hyphenation, drop caps, styled tables and AI illustrations placed per chapter. You get a press-ready PDF and a store-ready EPUB with a designed cover, not a wall of text to format yourself.",
        },
      ],
    },
    compare: {
      title: "“Can’t I just use ChatGPT or Claude?”",
      sub: "You can write text in a chat window. But a chat window does not hand you a finished, sellable book — you do. Same class of models; completely different output.",
      colA: "Raw ChatGPT / Claude",
      colB: "InkMagnet",
      rows: [
        {
          label: "What you actually get",
          a: "Chat messages you copy-paste and assemble yourself",
          b: "A finished PDF + EPUB with a designed cover",
        },
        {
          label: "Facts & sources",
          a: "Written from memory — citations are frequently invented",
          b: "Live web research, grounded in verifiable, cited sources",
        },
        {
          label: "Full-length books",
          a: "Context limits truncate, repeat and drift across chapters",
          b: "Whole book, chapter-by-chapter, kept consistent throughout",
        },
        {
          label: "Typesetting",
          a: "Plain text or markdown — formatting is on you",
          b: "Professional LaTeX: contents, margins, hyphenation, drop caps",
        },
        {
          label: "Cover & images",
          a: "None — at best a description to recreate elsewhere",
          b: "Designed cover + AI illustrations placed per chapter",
        },
        {
          label: "Assembly time",
          a: "Hours of copy-paste, formatting and exporting",
          b: "Automatic — finished book in about an hour",
        },
        {
          label: "Editing later",
          a: "Re-prompt and re-paste, losing your manual changes",
          b: "Built-in editor; your edits are kept, recompile anytime",
        },
        {
          label: "Cost",
          a: "Monthly subscription + your time",
          b: "One fixed price per book, full commercial rights",
        },
      ],
      note: "InkMagnet runs on the same class of frontier models you already trust — it just wraps them in the entire publishing pipeline, so you walk away with a book instead of a transcript.",
    },
    gallery: {
      title: "What your finished pages look like",
      sub: "A clickable contents, clean chapter openings, styled callout boxes and highlighted stats — the book design every InkMagnet title ships with.",
      items: [
        {
          caption: "Clickable table of contents",
          alt: "Table of contents page from a generated book",
        },
        {
          caption: "Chapter openings with pull-stats",
          alt: "Chapter opening page with a large highlighted statistic",
        },
        {
          caption: "Insight and fact callout boxes",
          alt: "Book page with styled callout and insight boxes",
        },
        {
          caption: "Highlighted stats and key figures",
          alt: "Section opening page with a large highlighted figure",
        },
      ],
      note: "Real pages from a book generated with InkMagnet — exported to PDF and EPUB.",
    },
    realApp: {
      title: "This is what working in InkMagnet looks like",
      sub: "Real screens from a finished book — no mock-ups.",
      note: "Screens from the Polish edition of the app. The interface is fully available in English.",
      items: [
        {
          title: "Every book has its own page",
          text: "Cover, page count, language, style and a six-step progress bar: payment, structure, review, writing, typesetting, done. You always know what stage your book is at.",
          alt: "InkMagnet book page with cover and progress bar",
        },
        {
          title: "Chapters you can open one by one",
          text: "The finished book is a list of chapters with word counts. Open any of them, read, fix a sentence, add a paragraph.",
          alt: "List of chapters in the InkMagnet editor",
        },
        {
          title: "A visual editor, like a word processor",
          text: "Headings, bold, lists, callout boxes, tables and images — you edit the text as in Word and the book is re-typeset for you. A raw LaTeX mode is one click away for the curious.",
          alt: "InkMagnet visual chapter editor",
        },
      ],
    },
    appShowcase: {
      title: "One panel for every book you make",
      sub: "Covers, generation progress and downloads — your whole library in one place.",
      alt: "The InkMagnet dashboard",
    },
    mock: {
      urlDashboard: "app.inkmagnet.com/dashboard",
      urlNew: "app.inkmagnet.com/projects/new",
      urlProject: "app.inkmagnet.com/projects/8f2a",
      dashTitle: "My Books",
      newBook: "New Book",
      newBookShort: "New",
      statusDone: "Completed",
      statusWriting: "Writing…",
      pagesWord: "pages",
      chaptersWord: "chapters",
      books: [
        {
          title: "The Lean SaaS Launch Playbook",
          author: "Jordan Rivera",
          pages: 60,
          fmt: "A5",
          status: "done",
          pct: 0,
        },
        {
          title: "Atomic Habits for Founders",
          author: "Mara Lindqvist",
          pages: 84,
          fmt: "B5",
          status: "writing",
          pct: 62,
        },
        {
          title: "The Remote Team Handbook",
          author: "Daniel Okoro",
          pages: 72,
          fmt: "A5",
          status: "done",
          pct: 0,
        },
        {
          title: "Design Systems, End to End",
          author: "Sofia Marchetti",
          pages: 96,
          fmt: "A4",
          status: "done",
          pct: 0,
        },
        {
          title: "The Mediterranean Kitchen",
          author: "Elena Costa",
          pages: 120,
          fmt: "B5",
          status: "done",
          pct: 0,
        },
        {
          title: "Mindful Productivity",
          author: "Tom Becker",
          pages: 56,
          fmt: "A5",
          status: "done",
          pct: 0,
        },
        {
          title: "The Freelancer's Field Guide",
          author: "Priya Nair",
          pages: 68,
          fmt: "A5",
          status: "done",
          pct: 0,
        },
        {
          title: "Personal Finance, Demystified",
          author: "Chris Hale",
          pages: 90,
          fmt: "B5",
          status: "done",
          pct: 0,
        },
      ],
      book: {
        title: "The Lean SaaS Launch Playbook",
        author: "Jordan Rivera",
        topic:
          "A practical guide to launching a profitable SaaS in 2025 — for non-technical founders.",
        chapters: [
          {
            n: 1,
            title: "Validating the idea",
            pages: 8,
            sections: [
              "Finding a painful problem",
              "Pricing & willingness to pay",
            ],
          },
          { n: 2, title: "Building the MVP", pages: 9, sections: [] },
          {
            n: 3,
            title: "Finding your first customers",
            pages: 11,
            sections: [],
          },
          { n: 4, title: "Pricing & packaging", pages: 8, sections: [] },
        ],
        tocTitle: "Contents",
        toc: [
          { label: "Introduction", page: 1 },
          { label: "1  Validating the idea", page: 7 },
          { label: "2  Building the MVP", page: 21 },
          { label: "3  Finding your first customers", page: 38 },
          { label: "4  Pricing & packaging", page: 55 },
          { label: "5  Scaling what works", page: 72 },
          { label: "Conclusion", page: 88 },
        ],
        chapterLabel: "Chapter 3",
        chapterTitle: "Finding Your First Customers",
        dropcap: "M",
        body: "ost founders obsess over the product and forget the harder problem: getting someone — anyone — to pay for it. The first ten customers rarely arrive through ads or growth hacks. They come from conversations you have one at a time, in the places your future users already gather.",
        body2:
          "Start where the pain is loudest. Map the three communities where your buyers already complain about the problem you solve, then show up as a participant — not an advertiser.",
        tableTitle: "Table 3.1 — Acquisition channels by cost and speed",
        tableCols: ["Channel", "Cost", "First lead"],
        tableRows: [
          ["Cold outreach", "$", "1–3 days"],
          ["Communities", "Free", "~1 week"],
          ["Content / SEO", "$$", "2–3 months"],
          ["Paid ads", "$$$", "Same day"],
        ],
        insightLabel: "Key insight",
        insightText:
          "For your first ten customers, direct outreach beats every paid channel — it costs nothing but time and teaches you the exact words your buyers use.",
        figCaption:
          "Figure 4.2 — A simple pricing ladder: a free trial, a core plan and a premium tier for teams.",
      },
      ui: {
        createNewBook: "Create New Book",
        topicLabel: "Topic / Subject",
        bookSize: "Book Size",
        popular: "Popular",
        tierStandard: "Standard · 60 pages",
        tierComprehensive: "Comprehensive · 120 pages",
        colorScheme: "Color Scheme",
        selected: "3/3 selected",
        continuePayment: "Continue to Payment — {price}",
        bookStructure: "Book Structure",
        bookTitleLabel: "Book Title",
        addChapter: "Add Chapter",
        saveChanges: "Save Changes",
        approveContinue: "Approve & Continue",
        generatingBook: "Generating Your Book",
        remaining: "~6m remaining",
        phaseResearch: "Research & Source Analysis",
        phaseWriting: "Content Generation",
        phaseReview: "Review & Revision",
        phasePdf: "PDF Compilation",
        phaseEpub: "EPUB Generation",
        inProgress: "In Progress",
        doneBadge: "Done",
        written: "2/8 written",
        pagesTarget: "60 pages target",
        chaptersStat: "8 chapters",
        downloadBook: "Download Your Book",
        versions: "Versions",
        downloadPdf: "Download PDF",
        pdfDesc: "Print-ready, styled layout",
        downloadEpub: "Download EPUB",
        epubDesc: "Kindle, Apple Books, Kobo",
        latest: "v3 (latest)",
        versionMeta: "Jun 15, 14:08 · 4.2 MB · 60 pages",
      },
      editor: {
        heading: "Edit Book Content",
        visual: "Visual",
        code: "LaTeX",
        save: "Save",
        unsaved: "2 unsaved",
        editing: "Editing chapter",
      },
    },
    sourcing: {
      title: "Where the depth comes from",
      sub: "Most AI writing is a confident guess from training data. InkMagnet builds every book on real sources it reads at generation time — and on a structure planned before a single sentence is written.",
      items: [
        {
          title: "Full sources, not snippets",
          desc: "For each book the engine searches the live web and scrapes dozens of complete pages and scientific documents end to end — not the two-line previews a search box returns. The numbers, names and citations come from what the sources actually say.",
        },
        {
          title: "A structure before a sentence",
          desc: "It plans the whole book first — chapters, sections and a research brief for each — then writes against that plan, so every chapter knows what the others cover. No rambling, no repetition, no dropped threads.",
        },
        {
          title: "Reviewed, then revised",
          desc: "After the first draft an AI editor checks coverage, trims redundant passages and fills the gaps — the editing pass a book gets before it ships, not a one-shot dump.",
        },
        {
          title: "Grounded and original",
          desc: "Because it writes from sources it has just read — not from memory — the prose is current, specific and yours: written for your exact topic, audience and angle.",
        },
      ],
    },
    universality: {
      title: "If it can be researched, it can be a book",
      sub: "InkMagnet isn't tied to one niche. The same pipeline researches and writes a cookbook, a thesis companion, a SaaS playbook or a course handbook — in your language, on practically any subject.",
      topics: [
        "Business & startups",
        "Marketing & sales",
        "Personal finance",
        "Health & nutrition",
        "Cooking & recipes",
        "Academic & theses",
        "Psychology & self-help",
        "Technology & coding",
        "Education & courses",
        "Travel & lifestyle",
        "Law & compliance",
        "Parenting",
        "Fitness & sport",
        "Hobbies & crafts",
        "Career & productivity",
        "Science explained",
      ],
      note: "Pick a topic — InkMagnet does the reading.",
    },
    editorSection: {
      title: "Don't like a paragraph? Rewrite it.",
      sub: "Every finished book opens in a full editor. Rewrite any chapter, drop in tables, callout boxes or images, then regenerate a fresh PDF — your hand-edits are never overwritten.",
      points: [
        "Visual or LaTeX — edit however you like",
        "Headings, bold, lists, quotes, callout boxes, tables and images",
        "Version history — every regenerate is saved",
        "Your edits are sacred — regenerations never clobber them",
      ],
    },
    interiorReader: {
      title: "Real books, not a wall of text",
      sub: "Open an InkMagnet ebook and you get genuine book design — a clickable contents, drop-cap chapter openings, styled tables, insight boxes and matched illustrations, typeset with the system behind academic publishing. Reads great on any device.",
      note: "Real interior pages from a book generated with InkMagnet.",
      device: "Kindle · tablets · phones · print",
    },
    useCases: {
      title: "Built for people who need books that work",
      items: [
        {
          title: "Lead magnets",
          desc: "A substantial, branded ebook converts better than a two-page checklist. Ship one per campaign.",
        },
        {
          title: "Course creators",
          desc: "Package your curriculum as a companion book your students can keep.",
        },
        {
          title: "Coaches & consultants",
          desc: "A book with your name on the cover is still the strongest credibility asset there is.",
        },
        {
          title: "Agencies",
          desc: "Deliver client ebooks in days instead of weeks, at a fraction of a ghostwriter's fee.",
        },
        {
          title: "Authors & subject experts",
          desc: "Turn the knowledge in your head into a credible book with your name on the cover — without spending six months ghostwriting it yourself.",
        },
        {
          title: "Marketing & content teams",
          desc: "Spin up gated ebooks, whitepapers and resource guides on demand — each grounded in real research and on-brand from cover to last page.",
        },
      ],
    },
    valueAnchor: {
      title: "What a book like this costs everywhere else",
      sub: "InkMagnet bundles the research, writing, review, typesetting, cover and files into one payment. Buy those pieces separately and the math gets ugly fast.",
      items: [
        {
          label: "AI “book” generators",
          cost: "$30–90 / month",
          note: "A subscription — and they hand you a raw draft you still have to format yourself.",
        },
        {
          label: "Typesetting tools (Atticus, Vellum)",
          cost: "$147–250 once",
          note: "Only format a finished manuscript — you still have to write the whole book.",
        },
        {
          label: "Freelance formatting",
          cost: "$200–1,000 / book",
          note: "Per book, every time. A designed cover is extra on top.",
        },
        {
          label: "A ghostwriter + a cover designer",
          cost: "$1,000s",
          note: "Weeks of back-and-forth for a single finished book.",
        },
      ],
      usLabel: "InkMagnet",
      usPre: "from",
      usNote:
        "Research, writing, review, typesetting, cover, PDF + EPUB — one payment, full commercial rights, no subscription.",
      foot: "Comparison figures are typical 2025 market rates and vary by provider.",
    },
    pricing: {
      title: "One price per book. Nothing recurring.",
      sub: "Pay only when you create a book. Research, writing, illustrations, cover, PDF and EPUB — everything is included.",
      perBook: "per book",
      pages: "pages",
      tiers: [
        { label: "Compact", pages: "30–45", price: "$14.99", usd: 14.99 },
        { label: "Standard", pages: "46–75", price: "$24.99", usd: 24.99 },
        { label: "Extended", pages: "76–115", price: "$29.99", usd: 29.99 },
        {
          label: "Comprehensive",
          pages: "116–160",
          price: "$44.99",
          usd: 44.99,
        },
        { label: "Complete", pages: "161–200", price: "$59.99", usd: 59.99 },
      ],
      note: "Full commercial rights. Unlimited edits and recompiles of every book you've bought.",
      cta: "Create your first book",
    },
    faq: {
      title: "Frequently asked questions",
      items: [
        {
          q: "Who owns the books I create?",
          a: "You do. Every book comes with full commercial rights — sell it, give it away as a lead magnet, publish it under your name.",
        },
        {
          q: "How long does it take?",
          a: "Structure is ready for your review within minutes. A complete book — written, illustrated, typeset and compiled — typically takes under an hour.",
        },
        {
          q: "Which languages are supported?",
          a: "You pick the book's language when you create the project. English and Polish are fully supported today, including language-aware typography and hyphenation.",
        },
        {
          q: "Can I edit the content?",
          a: "Yes. Every chapter is editable in a built-in WYSIWYG editor, and your manual edits are never overwritten by later regenerations. Recompile the PDF and EPUB as often as you like.",
        },
        {
          q: "Is the content original?",
          a: "Each book is written from scratch for your specific topic, audience and instructions, grounded in live web research with cited sources. No two books are alike.",
        },
        {
          q: "What exactly do I download?",
          a: "A print-quality PDF (with a designed cover, clickable table of contents and professional typesetting) plus an EPUB that works on Kindle, Apple Books, Kobo and in ebook stores.",
        },
        {
          q: "Why not just use ChatGPT or Claude?",
          a: "Those tools write text in a chat window — you still research, fact-check, structure, format, design a cover and export everything yourself. InkMagnet runs the same class of models but adds live web research, full-book consistency, professional typesetting, a designed cover and PDF/EPUB export. You get a finished book instead of a transcript to assemble.",
        },
        {
          q: "How is this different from other AI book tools?",
          a: "Most 'AI book' tools wrap a chatbot and hand you a long blog post inside a PDF. InkMagnet researches your topic on the live web, compiles real book typesetting with LaTeX, generates a designed cover and matched illustrations, and preserves your manual edits across recompiles.",
        },
        {
          q: "Do I need writing, design or formatting skills?",
          a: "No. You describe the book in a short form and the pipeline handles research, writing, layout, cover and export. If you want to change anything, the built-in editor is plain WYSIWYG — no LaTeX, no design software.",
        },
      ],
    },
    finalCta: {
      title: "Your book is one form away",
      sub: "Describe the topic today, download the finished ebook within the hour.",
      cta: "Start writing — from $14.99",
    },
    footer: {
      tagline: "Professional AI-written ebooks with real typesetting.",
      product: "Product",
      legal: "Legal",
      privacy: "Privacy policy",
      terms: "Terms of service",
      contact: "Contact",
      rights: "All rights reserved.",
    },
  },
  pl: {
    nav: {
      tagline: "Generator ebooków AI",
      how: "Jak to działa",
      features: "Możliwości",
      pricing: "Cennik",
      faq: "FAQ",
      examples: "Przykłady",
      blog: "Blog",
      signIn: "Zaloguj się",
      cta: "Stwórz ebooka",
    },
    hero: {
      badge: "Ebook AI Creator",
      title1: "Generator ebooków AI, który zamienia temat w",
      titleAccent: "profesjonalną książkę",
      title2: "w około godzinę",
      sub: "InkMagnet to generator ebooków AI: opisz temat, a on zbada go w internecie, napisze każdy rozdział z weryfikowalnymi źródłami, zaprojektuje okładkę i odda PDF w jakości drukarskiej oraz EPUB. To nie wypełniacz szablonu ani eksport z worda — prawdziwa, złożona książka.",
      ctaPrimary: "Zacznij swoją książkę",
      ctaSecondary: "Zobacz, jak to działa",
      bullets: [
        "PDF + EPUB w jakości wydawniczej",
        "Research w sieci z cytowanymi źródłami",
        "Jedna stała cena za książkę",
      ],
    },
    how: {
      title: "Od tematu do gotowej książki w czterech krokach",
      sub: "Ty podejmujesz decyzje, resztę wykonuje silnik.",
      steps: [
        {
          title: "Opisz swoją książkę",
          desc: "Temat, odbiorcy, język, docelowa objętość i styl graficzny. Tytuł możesz podać albo zostawić do zaproponowania.",
        },
        {
          title: "Zatwierdź strukturę",
          desc: "Silnik bada temat w aktualnych źródłach internetowych i przygotowuje plan rozdział po rozdziale. Edytujesz go albo zatwierdzasz jednym kliknięciem.",
        },
        {
          title: "AI pisze i projektuje",
          desc: "Każdy rozdział zostaje napisany, zrecenzowany i złożony oprogramowaniem do profesjonalnego składu. Opcjonalne ilustracje AI powstają pod treść konkretnych rozdziałów.",
        },
        {
          title: "Pobierz i publikuj",
          desc: "Dostajesz PDF gotowy do druku i EPUB gotowy do sklepów, z zaprojektowaną okładką. Każdy rozdział możesz poprawić we wbudowanym edytorze i przekompilować książkę w dowolnym momencie.",
        },
      ],
    },
    features: {
      title: "Co sprawia, że te książki da się czytać",
      sub: "Większość narzędzi AI produkuje długi wpis blogowy zapakowany w PDF. InkMagnet buduje prawdziwe książki.",
      items: [
        {
          title: "Prawdziwy research w sieci",
          desc: "Zanim powstanie pierwszy rozdział, silnik bada temat w internecie i opiera treść na aktualnych, weryfikowalnych źródłach.",
        },
        {
          title: "Profesjonalny skład",
          desc: "Książki są kompilowane LaTeX-em, czyli systemem znanym z wydawnictw akademickich. Poprawne marginesy, żywa pagina, dzielenie wyrazów i klikalny spis treści.",
        },
        {
          title: "Ilustracje AI dopasowane do treści",
          desc: "Opcjonalne zdjęcia lub grafiki generowane do konkretnych rozdziałów, z uwzględnieniem tematu, języka i realiów regionu. W cenie książki.",
        },
        {
          title: "Zaprojektowane okładki",
          desc: "Okładka powstaje z Twoim tytułem, w wybranej palecie i układzie. W edytorze okładek poprawisz ją, kiedy zechcesz.",
        },
        {
          title: "Twoje poprawki są nietykalne",
          desc: "Przepisz dowolny rozdział w edytorze WYSIWYG. Kolejne generacje nigdy nie nadpiszą tego, co zmieniono ręcznie.",
        },
        {
          title: "PDF + EPUB gotowe do sprzedaży",
          desc: "PDF w jakości drukarskiej i poprawny EPUB na Kindle, Apple Books czy do Twojego sklepu. Bez znaków wodnych, z pełnymi prawami komercyjnymi.",
        },
      ],
    },
    deepDive: {
      title: "Więcej niż chatbot w opakowaniu",
      sub: "Model potrafi napisać akapity. Zamienienie ich w książkę, którą ludzie doczytają do końca, wymaga całego procesu. Oto, co dzieje się pod maską każdego projektu.",
      items: [
        {
          title: "Najpierw bada temat, dopiero potem pisze",
          desc: "Większość tekstów AI powstaje z pamięci modelu — i właśnie dlatego pojawiają się statystyki i cytowania, które rozpadają się przy weryfikacji. InkMagnet najpierw przeszukuje aktualny internet, czyta realne źródła i osadza w nich każdy rozdział, więc liczby, nazwiska i odwołania wskazują na rzeczy, które faktycznie istnieją.",
        },
        {
          title: "Pisze całą książkę, nie jedną długą odpowiedź",
          desc: "Stustronicowa książka nie zmieści się w jednej odpowiedzi czatu — zapytaj chatbota, a urwie wątek, zacznie się powtarzać i zapomni rozdział 2 przy rozdziale 9. InkMagnet najpierw planuje strukturę, a potem pisze i recenzuje każdy rozdział względem pozostałych, trzymając spójną terminologię, argumentację i ton od okładki po zakończenie.",
        },
        {
          title: "Składa, ilustruje i pakuje",
          desc: "Prawdziwe książki to nie markdown. Każdy projekt jest kompilowany LaTeX-em — systemem znanym z wydawnictw akademickich — z klikalnym spisem treści, poprawnym dzieleniem wyrazów, inicjałami, tabelami i ilustracjami AI wstawianymi pod konkretne rozdziały. Dostajesz PDF gotowy do druku i EPUB gotowy do sklepu z zaprojektowaną okładką, a nie ścianę tekstu do formatowania.",
        },
      ],
    },
    compare: {
      title: "„Przecież mogę użyć ChatGPT albo Claude'a”",
      sub: "Tekst napiszesz w oknie czatu. Ale okno czatu nie odda Ci gotowej, sprzedawalnej książki — robisz to sam. Ta sama klasa modeli, zupełnie inny efekt.",
      colA: "Goły ChatGPT / Claude",
      colB: "InkMagnet",
      rows: [
        {
          label: "Co realnie dostajesz",
          a: "Wiadomości z czatu, które sam kopiujesz i składasz",
          b: "Gotowy PDF + EPUB z zaprojektowaną okładką",
        },
        {
          label: "Fakty i źródła",
          a: "Pisane z pamięci — cytowania często zmyślone",
          b: "Research w sieci, oparty na weryfikowalnych, cytowanych źródłach",
        },
        {
          label: "Pełne książki",
          a: "Limity kontekstu urywają, powtarzają i gubią wątek",
          b: "Cała książka, rozdział po rozdziale, spójna do końca",
        },
        {
          label: "Skład",
          a: "Czysty tekst lub markdown — formatujesz sam",
          b: "Profesjonalny LaTeX: spis treści, marginesy, dzielenie, inicjały",
        },
        {
          label: "Okładka i grafiki",
          a: "Brak — najwyżej opis do odtworzenia gdzie indziej",
          b: "Zaprojektowana okładka + ilustracje AI pod rozdziały",
        },
        {
          label: "Czas składania",
          a: "Godziny kopiowania, formatowania i eksportu",
          b: "Automatycznie — gotowa książka w około godzinę",
        },
        {
          label: "Późniejsze edycje",
          a: "Ponowne prompty i wklejanie, tracisz swoje zmiany",
          b: "Wbudowany edytor; Twoje poprawki zostają, kompilujesz na nowo",
        },
        {
          label: "Koszt",
          a: "Miesięczny abonament + Twój czas",
          b: "Jedna stała cena za książkę, pełne prawa komercyjne",
        },
      ],
      note: "InkMagnet działa na tej samej klasie czołowych modeli, którym już ufasz — tyle że opakowuje je w cały proces wydawniczy, więc wychodzisz z książką, a nie z transkryptem.",
    },
    gallery: {
      title: "Tak wyglądają Twoje gotowe strony",
      sub: "Klikalny spis treści, otwarcia rozdziałów z inicjałem, tabele i dopasowane ilustracje — skład, z którym wychodzi każda książka z InkMagnet.",
      items: [
        { caption: "Klikalny spis treści", alt: "Układ strony spisu treści" },
        {
          caption: "Otwarcia rozdziałów z inicjałami",
          alt: "Układ strony otwarcia rozdziału z inicjałem",
        },
        {
          caption: "Tabele i ramki z definicjami",
          alt: "Układ strony z tabelą danych i ramką definicji",
        },
        {
          caption: "Ilustracje AI z podpisami",
          alt: "Układ strony z ilustracją i podpisem rysunku",
        },
      ],
      note: "Każda książka jest składana w tym standardzie i eksportowana do PDF i EPUB.",
    },
    realApp: {
      title: "Tak wygląda praca z InkMagnet",
      sub: "Prawdziwe ekrany z gotowej książki — bez makiet.",
      note: "Ekrany z książki „Thermomix — proste obiady dla zabieganych”, wygenerowanej w InkMagnet.",
      items: [
        {
          title: "Każda książka ma własną stronę",
          text: "Okładka, liczba stron, język, styl i pasek postępu w sześciu krokach: płatność, struktura, przegląd, pisanie, składanie, gotowe. Zawsze wiesz, na jakim etapie jest Twoja książka.",
          alt: "Strona książki w InkMagnet z okładką i paskiem postępu",
        },
        {
          title: "Rozdziały otwierasz jeden po drugim",
          text: "Gotowa książka to lista rozdziałów z liczbą słów. Otwierasz dowolny, czytasz, poprawiasz zdanie, dopisujesz akapit.",
          alt: "Lista rozdziałów w edytorze InkMagnet",
        },
        {
          title: "Edytor wizualny — jak w Wordzie",
          text: "Nagłówki, pogrubienia, listy, ramki, tabele i obrazy — edytujesz tekst jak w edytorze tekstu, a książka składa się na nowo sama. Dla ciekawych jest też tryb surowego LaTeX-a, jedno kliknięcie dalej.",
          alt: "Wizualny edytor rozdziału w InkMagnet",
        },
      ],
    },
    appShowcase: {
      title: "Jeden panel na wszystkie Twoje książki",
      sub: "Okładki, postęp generowania i pobrania — cała biblioteka w jednym miejscu.",
      alt: "Panel InkMagnet",
    },
    mock: {
      urlDashboard: "app.inkmagnet.com/dashboard",
      urlNew: "app.inkmagnet.com/projects/new",
      urlProject: "app.inkmagnet.com/projects/8f2a",
      dashTitle: "Moje książki",
      newBook: "Nowa książka",
      newBookShort: "Nowa",
      statusDone: "Gotowe",
      statusWriting: "Pisanie…",
      pagesWord: "stron",
      chaptersWord: "rozdz.",
      books: [
        {
          title: "Rentowny SaaS od zera",
          author: "Jan Kowalski",
          pages: 60,
          fmt: "A5",
          status: "done",
          pct: 0,
        },
        {
          title: "Atomowe nawyki założyciela",
          author: "Maria Lewandowska",
          pages: 84,
          fmt: "B5",
          status: "writing",
          pct: 62,
        },
        {
          title: "Podręcznik pracy zdalnej",
          author: "Piotr Zając",
          pages: 72,
          fmt: "A5",
          status: "done",
          pct: 0,
        },
        {
          title: "Systemy projektowe od A do Z",
          author: "Zofia Marczak",
          pages: 96,
          fmt: "A4",
          status: "done",
          pct: 0,
        },
        {
          title: "Kuchnia śródziemnomorska",
          author: "Elena Costa",
          pages: 120,
          fmt: "B5",
          status: "done",
          pct: 0,
        },
        {
          title: "Uważna produktywność",
          author: "Tomasz Bąk",
          pages: 56,
          fmt: "A5",
          status: "done",
          pct: 0,
        },
        {
          title: "Przewodnik freelancera",
          author: "Anna Nowak",
          pages: 68,
          fmt: "A5",
          status: "done",
          pct: 0,
        },
        {
          title: "Finanse osobiste bez tajemnic",
          author: "Krzysztof Mazur",
          pages: 90,
          fmt: "B5",
          status: "done",
          pct: 0,
        },
      ],
      book: {
        title: "Rentowny SaaS od zera",
        author: "Jan Kowalski",
        topic:
          "Praktyczny przewodnik, jak wystartować z rentownym SaaS-em w 2025 roku — dla nietechnicznych założycieli.",
        chapters: [
          {
            n: 1,
            title: "Walidacja pomysłu",
            pages: 8,
            sections: [
              "Znalezienie palącego problemu",
              "Cena a gotowość do zapłaty",
            ],
          },
          { n: 2, title: "Budowa MVP", pages: 9, sections: [] },
          { n: 3, title: "Pierwsi klienci", pages: 11, sections: [] },
          { n: 4, title: "Cennik i pakiety", pages: 8, sections: [] },
        ],
        tocTitle: "Spis treści",
        toc: [
          { label: "Wprowadzenie", page: 1 },
          { label: "1  Walidacja pomysłu", page: 7 },
          { label: "2  Budowa MVP", page: 21 },
          { label: "3  Pierwsi klienci", page: 38 },
          { label: "4  Cennik i pakiety", page: 55 },
          { label: "5  Skalowanie tego, co działa", page: 72 },
          { label: "Zakończenie", page: 88 },
        ],
        chapterLabel: "Rozdział 3",
        chapterTitle: "Pierwsi klienci",
        dropcap: "W",
        body: "iększość założycieli skupia się na produkcie i pomija trudniejszy problem: nakłonienie kogokolwiek, by w ogóle zapłacił. Pierwszych dziesięciu klientów rzadko przyciągają reklamy. Pojawiają się dzięki rozmowom prowadzonym pojedynczo — tam, gdzie Twoi przyszli użytkownicy już bywają.",
        body2:
          "Zacznij tam, gdzie ból jest największy. Wypisz trzy społeczności, w których Twoi kupujący już narzekają na problem, który rozwiązujesz, i pojaw się tam jako uczestnik — nie reklamodawca.",
        tableTitle: "Tabela 3.1 — Kanały pozyskania wg kosztu i tempa",
        tableCols: ["Kanał", "Koszt", "Pierwszy lead"],
        tableRows: [
          ["Bezpośredni kontakt", "0 zł", "1–3 dni"],
          ["Społeczności", "0 zł", "~1 tydzień"],
          ["Treści / SEO", "$$", "2–3 mies."],
          ["Reklamy płatne", "$$$", "Tego dnia"],
        ],
        insightLabel: "Kluczowa myśl",
        insightText:
          "Do pierwszych dziesięciu klientów bezpośredni kontakt bije każdy płatny kanał — kosztuje tylko czas i uczy Cię, jakimi słowami mówią Twoi kupujący.",
        figCaption:
          "Rysunek 4.2 — Prosta drabina cenowa: darmowy okres próbny, plan podstawowy i wariant premium dla zespołów.",
      },
      ui: {
        createNewBook: "Nowa książka",
        topicLabel: "Temat / Zagadnienie",
        bookSize: "Rozmiar książki",
        popular: "Popularne",
        tierStandard: "Standard · 60 stron",
        tierComprehensive: "Kompleksowa · 120 stron",
        colorScheme: "Kolorystyka",
        selected: "wybrano 3/3",
        continuePayment: "Przejdź do płatności — {price}",
        bookStructure: "Struktura książki",
        bookTitleLabel: "Tytuł książki",
        addChapter: "Dodaj rozdział",
        saveChanges: "Zapisz zmiany",
        approveContinue: "Zatwierdź i kontynuuj",
        generatingBook: "Generujemy Twoją książkę",
        remaining: "~6 min do końca",
        phaseResearch: "Badania i analiza źródeł",
        phaseWriting: "Generowanie treści",
        phaseReview: "Recenzja i poprawki",
        phasePdf: "Składanie PDF",
        phaseEpub: "Generowanie EPUB",
        inProgress: "W toku",
        doneBadge: "Gotowe",
        written: "2/8 napisane",
        pagesTarget: "cel: 60 stron",
        chaptersStat: "8 rozdziałów",
        downloadBook: "Pobierz swoją książkę",
        versions: "Wersje",
        downloadPdf: "Pobierz PDF",
        pdfDesc: "Gotowy do druku, złożony skład",
        downloadEpub: "Pobierz EPUB",
        epubDesc: "Kindle, Apple Books, Kobo",
        latest: "v3 (najnowsza)",
        versionMeta: "15 cze, 14:08 · 4,2 MB · 60 stron",
      },
      editor: {
        heading: "Edytuj treść książki",
        visual: "Wizualnie",
        code: "LaTeX",
        save: "Zapisz",
        unsaved: "2 niezapisane",
        editing: "Edycja rozdziału",
      },
    },
    sourcing: {
      title: "Skąd bierze się ta głębia",
      sub: "Większość treści AI to pewny siebie strzał z danych treningowych. InkMagnet buduje każdą książkę na realnych źródłach czytanych w trakcie generowania — i na strukturze zaplanowanej, zanim padnie pierwsze zdanie.",
      items: [
        {
          title: "Pełne źródła, nie zajawki",
          desc: "Do każdej książki silnik przeszukuje aktualny internet i scrapuje dziesiątki kompletnych stron oraz dokumentów naukowych w całości — nie dwuwierszowe zapowiedzi z wyszukiwarki. Liczby, nazwiska i cytowania pochodzą z tego, co źródła naprawdę mówią.",
        },
        {
          title: "Najpierw struktura, potem zdanie",
          desc: "Najpierw planuje całą książkę — rozdziały, podrozdziały i brief źródłowy do każdego — a potem pisze zgodnie z tym planem, więc każdy rozdział wie, co zawierają pozostałe. Bez lania wody, powtórzeń i porzuconych wątków.",
        },
        {
          title: "Recenzja, potem poprawki",
          desc: "Po pierwszej wersji redaktor AI sprawdza kompletność, przycina powtórzenia i uzupełnia luki — to redakcja, którą książka dostaje przed wydaniem, a nie jednorazowy zrzut tekstu.",
        },
        {
          title: "Osadzone i oryginalne",
          desc: "Ponieważ pisze z przed chwilą przeczytanych źródeł — nie z pamięci — tekst jest aktualny, konkretny i Twój: napisany pod Twój dokładny temat, odbiorcę i ujęcie.",
        },
      ],
    },
    universality: {
      title: "Jeśli da się to zbadać, może być książką",
      sub: "InkMagnet nie jest przypisany do jednej niszy. Ten sam silnik bada i pisze książkę kucharską, kompendium do pracy dyplomowej, podręcznik SaaS czy materiał do kursu — w Twoim języku, na praktycznie dowolny temat.",
      topics: [
        "Biznes i startupy",
        "Marketing i sprzedaż",
        "Finanse osobiste",
        "Zdrowie i dieta",
        "Gotowanie i przepisy",
        "Prace dyplomowe",
        "Psychologia i rozwój",
        "Technologia i kod",
        "Edukacja i kursy",
        "Podróże i lifestyle",
        "Prawo i compliance",
        "Rodzicielstwo",
        "Fitness i sport",
        "Hobby i rękodzieło",
        "Kariera i produktywność",
        "Nauka w pigułce",
      ],
      note: "Wybierz temat — czytanie bierze na siebie InkMagnet.",
    },
    editorSection: {
      title: "Nie podoba Ci się akapit? Przepisz go.",
      sub: "Każda gotowa książka otwiera się w pełnym edytorze. Przepisz dowolny rozdział, wstaw tabele, ramki albo obrazy, a potem wygeneruj świeży PDF — Twoje ręczne zmiany nigdy nie zostają nadpisane.",
      points: [
        "Wizualnie albo w LaTeX-u — jak wolisz",
        "Nagłówki, pogrubienia, listy, cytaty, ramki, tabele i obrazy",
        "Historia wersji — każda regeneracja jest zapisana",
        "Twoje zmiany są święte — regeneracje ich nie kasują",
      ],
    },
    interiorReader: {
      title: "Prawdziwe książki, nie ściana tekstu",
      sub: "Otwórz ebooka z InkMagnet i dostajesz prawdziwy skład książki — klikalny spis treści, otwarcia rozdziałów z inicjałem, tabele, ramki i dopasowane ilustracje, złożone systemem stojącym za publikacjami naukowymi. Świetnie czyta się na każdym urządzeniu.",
      note: "Prawdziwe strony z książki wygenerowanej w InkMagnet.",
      device: "Kindle · tablety · telefony · druk",
    },
    useCases: {
      title: "Dla ludzi, którym książka ma na siebie zarobić",
      items: [
        {
          title: "Lead magnety",
          desc: "Konkretny, markowy ebook konwertuje lepiej niż dwustronicowa checklista. Możesz wypuszczać jeden na kampanię.",
        },
        {
          title: "Twórcy kursów",
          desc: "Zamknij program kursu w książce, która zostaje z kursantami na zawsze.",
        },
        {
          title: "Coachowie i konsultanci",
          desc: "Książka z Twoim nazwiskiem na okładce wciąż buduje wiarygodność jak nic innego.",
        },
        {
          title: "Agencje",
          desc: "Oddawaj klientom ebooki w dni zamiast tygodni, za ułamek stawki ghostwritera.",
        },
        {
          title: "Autorzy i eksperci",
          desc: "Zamień wiedzę z głowy w wiarygodną książkę z Twoim nazwiskiem na okładce — bez sześciu miesięcy pisania jej samemu.",
        },
        {
          title: "Zespoły marketingu i treści",
          desc: "Twórz na żądanie ebooki za zapis, whitepapery i poradniki — każdy oparty na realnym researchu i spójny z marką od okładki po ostatnią stronę.",
        },
      ],
    },
    valueAnchor: {
      title: "Ile taka książka kosztuje gdziekolwiek indziej",
      sub: "InkMagnet pakuje research, pisanie, recenzję, skład, okładkę i pliki w jedną opłatę. Kup te elementy osobno, a rachunek szybko robi się bolesny.",
      items: [
        {
          label: "Generatory „książek” AI",
          cost: "120–360 zł / mies.",
          note: "Abonament — i oddają surowy draft, który i tak sam musisz złożyć.",
        },
        {
          label: "Narzędzia do składu (Atticus, Vellum)",
          cost: "550–950 zł jednorazowo",
          note: "Tylko składają gotowy manuskrypt — całą książkę i tak piszesz sam.",
        },
        {
          label: "Skład u freelancera",
          cost: "750–3700 zł / książkę",
          note: "Za każdą książkę osobno. Projekt okładki to dodatkowy koszt.",
        },
        {
          label: "Ghostwriter + grafik od okładek",
          cost: "tysiące zł",
          note: "Tygodnie ustaleń dla jednej gotowej książki.",
        },
      ],
      usLabel: "InkMagnet",
      usPre: "od",
      usNote:
        "Research, pisanie, recenzja, skład, okładka, PDF + EPUB — jedna opłata, pełne prawa komercyjne, bez abonamentu.",
      foot: "Ceny porównawcze to typowe stawki rynkowe (2025) i różnią się między dostawcami.",
    },
    pricing: {
      title: "Jedna cena za książkę. Żadnych abonamentów.",
      sub: "Płacisz tylko wtedy, gdy tworzysz książkę. Research, pisanie, ilustracje, okładka, PDF i EPUB — wszystko w cenie.",
      perBook: "za książkę",
      pages: "stron",
      tiers: [
        { label: "Compact", pages: "30–45", price: "$14.99", usd: 14.99 },
        { label: "Standard", pages: "46–75", price: "$24.99", usd: 24.99 },
        { label: "Extended", pages: "76–115", price: "$29.99", usd: 29.99 },
        {
          label: "Comprehensive",
          pages: "116–160",
          price: "$44.99",
          usd: 44.99,
        },
        { label: "Complete", pages: "161–200", price: "$59.99", usd: 59.99 },
      ],
      note: "Pełne prawa komercyjne. Edycje i ponowne kompilacje kupionych książek bez limitu.",
      cta: "Stwórz pierwszą książkę",
    },
    faq: {
      title: "Częste pytania",
      items: [
        {
          q: "Do kogo należą stworzone książki?",
          a: "Do Ciebie. Każda książka ma pełne prawa komercyjne: możesz ją sprzedawać, rozdawać jako lead magnet i publikować pod własnym nazwiskiem.",
        },
        {
          q: "Ile to trwa?",
          a: "Struktura do zatwierdzenia pojawia się po kilku minutach. Cała książka (napisana, zilustrowana, złożona i skompilowana) powstaje zwykle w mniej niż godzinę.",
        },
        {
          q: "Jakie języki są obsługiwane?",
          a: "Język książki wybierasz przy tworzeniu projektu. Polski i angielski działają w pełni, łącznie z typografią i dzieleniem wyrazów właściwym dla języka.",
        },
        {
          q: "Czy mogę edytować treść?",
          a: "Tak. Każdy rozdział otworzysz we wbudowanym edytorze WYSIWYG, a ręczne poprawki nigdy nie zostaną nadpisane przez późniejsze generacje. PDF i EPUB przekompilujesz dowolną liczbę razy.",
        },
        {
          q: "Czy treść jest oryginalna?",
          a: "Każda książka powstaje od zera dla Twojego tematu, odbiorców i wytycznych, na bazie researchu w aktualnych źródłach z cytowaniami. Dwie identyczne książki nie istnieją.",
        },
        {
          q: "Co dokładnie pobieram?",
          a: "PDF w jakości drukarskiej (z okładką, klikalnym spisem treści i profesjonalnym składem) i EPUB działający na Kindle, w Apple Books, Kobo i w sklepach z ebookami.",
        },
        {
          q: "Po co mi to, skoro jest ChatGPT albo Claude?",
          a: "Te narzędzia piszą tekst w oknie czatu — research, weryfikację faktów, strukturę, formatowanie, okładkę i eksport robisz sam. InkMagnet działa na tej samej klasie modeli, ale dokłada research w sieci, spójność całej książki, profesjonalny skład, zaprojektowaną okładkę i eksport PDF/EPUB. Dostajesz gotową książkę, nie transkrypt do poskładania.",
        },
        {
          q: "Czym to się różni od innych generatorów książek AI?",
          a: "Większość narzędzi „AI book” opakowuje chatbota i oddaje długi wpis blogowy w PDF. InkMagnet bada temat w aktualnej sieci, składa prawdziwą typografię książkową w LaTeX-u, generuje zaprojektowaną okładkę i dopasowane ilustracje oraz zachowuje Twoje ręczne poprawki przy kolejnych kompilacjach.",
        },
        {
          q: "Czy muszę umieć pisać, projektować albo składać?",
          a: "Nie. Opisujesz książkę w krótkim formularzu, a proces ogarnia research, pisanie, układ, okładkę i eksport. Jeśli chcesz coś zmienić, wbudowany edytor jest zwykłym WYSIWYG — bez LaTeX-a i programów graficznych.",
        },
      ],
    },
    finalCta: {
      title: "Od Twojej książki dzieli Cię jeden formularz",
      sub: "Opisz temat dzisiaj, a gotowego ebooka pobierzesz w ciągu godziny.",
      cta: "Zacznij pisać — od $14.99",
    },
    footer: {
      tagline: "Profesjonalne ebooki pisane przez AI, z prawdziwym składem.",
      product: "Produkt",
      legal: "Informacje prawne",
      privacy: "Polityka prywatności",
      terms: "Regulamin",
      contact: "Kontakt",
      rights: "Wszelkie prawa zastrzeżone.",
    },
  },
} as const;

export function useTranslations(lang: Lang) {
  return ui[lang];
}
