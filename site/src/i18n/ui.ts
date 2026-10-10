import { de } from "./de";

export const languages = { en: "English", pl: "Polski", de: "Deutsch" } as const;
export type Lang = keyof typeof languages;
export const defaultLang: Lang = "en";

export function getLangFromUrl(url: URL): Lang {
  const [, first] = url.pathname.split("/");
  if (first === "pl") return "pl";
  if (first === "de") return "de";
  return defaultLang;
}

/** Path prefix for a language ("" for en, "/pl" for pl, "/de" for de). */
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
      app: "Android app",
    },
    hero: {
      badge: "AI ebook generator",
      title1: "Your ebook, no writing needed.",
      titleAccent: "Ready to publish in an hour.",
      title2: "",
      sub: "Describe your topic and InkMagnet researches it in current sources, writes every chapter, runs a language edit and typesets everything into PDF and EPUB, with a cover, a table of contents and citations. No subscription: you pay for one book, and only after you have seen its plan.",
      ctaPrimary: "Plan my book for free",
      ctaSecondary: "See how it works",
      bullets: [
        "Free table of contents and a 2-page sample",
        "Citations to real sources",
        "Language editing on every book",
        "PDF + EPUB, full commercial rights",
      ],
    },
    how: {
      title: "From a description to a finished book in four steps",
      sub: "You see the plan before you pay. The pipeline does the rest.",
      steps: [
        {
          title: "Describe your book",
          desc: "One field, up to 15,000 characters: the topic, who it is for and what must be inside. Attach notes or files if you have them, then pick a length. Style, format, colours, cover and illustrations are optional. Leave them on automatic and the AI picks a style and palette that suit your topic.",
        },
        {
          title: "See your table of contents for free",
          desc: "Before you pay, you get a title and the full contents: chapters and sections, each with a short description. Edit anything, add or remove chapters, or ask the AI for one new version with your notes and keep whichever you prefer. Curious how it reads? A free two-page sample of chapter 1, typeset exactly like the final book, is ready in about a minute.",
        },
        {
          title: "Pay, then the AI researches and writes",
          desc: "You pay only once you like the plan. The engine researches your topic on the live web and expands your plan into a detailed outline, which you can edit (or have redone once) before any chapter is written. Then every chapter is written and reviewed, and the whole book gets a language edit and a consistency check before typesetting.",
        },
        {
          title: "Download and publish",
          desc: "You get a press-ready PDF and a store-ready EPUB, with a designed cover. Edit any chapter in the built-in editor, add your own photos and recompile anytime.",
        },
      ],
    },
    features: {
      title: "What makes these books a pleasure to read",
      sub: "Most AI book tools produce a long blog post in a PDF wrapper. InkMagnet builds actual books.",
      items: [
        {
          title: "Real web research",
          desc: "Before a single chapter is written, the engine researches your topic online and grounds the content in current, verifiable sources.",
        },
        {
          title: "Professional typesetting",
          desc: "Books are compiled with LaTeX, the system behind academic publishing. Proper margins, running heads, hyphenation, a clickable table of contents.",
        },
        {
          title: "AI illustrations that fit",
          desc: "Optional photographic or illustrated artwork generated per chapter, matched to your topic, language and region, and included in the price.",
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
          desc: "Most AI text is written from memory, which is exactly why it invents statistics and citations that fall apart on a fact-check. InkMagnet first searches the live web for your topic, reads real sources, and grounds every chapter in them, so the numbers, names and references point to things that actually exist.",
        },
        {
          title: "It writes the whole book, not one long answer",
          desc: "A 120-page book does not fit in a single chat answer. Ask a chatbot and it truncates, repeats itself and forgets chapter 2 by chapter 9. InkMagnet plans a structure first, then writes and reviews each chapter against the others, keeping terminology, arguments and tone consistent from cover to conclusion.",
        },
        {
          title: "It typesets, illustrates and packages it",
          desc: "Real books are not markdown. Every project is compiled with LaTeX (the system behind academic publishing), with a clickable table of contents, proper hyphenation, drop caps, styled tables and AI illustrations placed per chapter. You get a press-ready PDF and a store-ready EPUB with a designed cover, not a wall of text to format yourself.",
        },
      ],
    },
    compare: {
      title: "“Can’t I just use ChatGPT or Claude?”",
      sub: "You can write text in a chat window. But a chat window does not hand you a finished, sellable book. You have to do that yourself. Same class of models; completely different output.",
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
          a: "Written from memory, so citations are frequently invented",
          b: "Live web research, grounded in verifiable, cited sources",
        },
        {
          label: "Full-length books",
          a: "Context limits truncate, repeat and drift across chapters",
          b: "Whole book, chapter-by-chapter, kept consistent throughout",
        },
        {
          label: "Typesetting",
          a: "Plain text or markdown; formatting is on you",
          b: "Professional LaTeX: contents, margins, hyphenation, drop caps",
        },
        {
          label: "Cover & images",
          a: "None, at best a description to recreate elsewhere",
          b: "Designed cover + AI illustrations placed per chapter",
        },
        {
          label: "Assembly time",
          a: "Hours of copy-paste, formatting and exporting",
          b: "Automatic: a finished book in about an hour",
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
      note: "InkMagnet runs on the same class of frontier models you already trust. It just wraps them in the entire publishing pipeline, so you walk away with a book instead of a transcript.",
    },
    gallery: {
      title: "What your finished pages look like",
      sub: "A clickable contents, clean chapter openings, styled callout boxes and highlighted stats: the book design every InkMagnet title ships with.",
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
      note: "Real pages from a book generated with InkMagnet, exported to PDF and EPUB.",
    },
    realApp: {
      title: "This is what working in InkMagnet looks like",
      sub: "Real screens from a finished book. No mock-ups.",
      note: "Screens from the Polish edition of the app. The interface is fully available in English.",
      items: [
        {
          title: "Your private book dashboard",
          text: "Visible only to you: cover, page count, language, style and a progress bar. Before you pay, this dashboard holds your free table of contents and two-page sample; after payment you follow research, writing and typesetting until the book is done.",
          alt: "InkMagnet book dashboard with cover and progress bar",
        },
        {
          title: "Chapters you can open one by one",
          text: "The finished book is a list of chapters with word counts. Open any of them, read, fix a sentence, add a paragraph.",
          alt: "List of chapters in the InkMagnet editor",
        },
        {
          title: "A visual editor, like a word processor",
          text: "Headings, bold, lists, callout boxes, tables and images: you edit the text as in Word and the book is re-typeset for you. A raw LaTeX mode is one click away for the curious.",
          alt: "InkMagnet visual chapter editor",
        },
      ],
    },
    appShowcase: {
      title: "One panel for every book you make",
      sub: "Covers, generation progress and downloads: your whole library in one place.",
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
          "A practical guide to launching a profitable SaaS in 2025, written for non-technical founders. Validating the idea, a lean MVP, the first ten customers and pricing. Plain language, real examples, a checklist after every chapter.",
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
        body: "ost founders obsess over the product and forget the harder problem: getting someone, anyone, to pay for it. The first ten customers rarely arrive through ads or growth hacks. They come from conversations you have one at a time, in the places your future users already gather.",
        body2:
          "Start where the pain is loudest. Map the three communities where your buyers already complain about the problem you solve, then show up as a participant, not an advertiser.",
        tableTitle: "Table 3.1: Acquisition channels by cost and speed",
        tableCols: ["Channel", "Cost", "First lead"],
        tableRows: [
          ["Cold outreach", "$", "1–3 days"],
          ["Communities", "Free", "~1 week"],
          ["Content / SEO", "$$", "2–3 months"],
          ["Paid ads", "$$$", "Same day"],
        ],
        insightLabel: "Key insight",
        insightText:
          "For your first ten customers, direct outreach beats every paid channel. It costs nothing but time and teaches you the exact words your buyers use.",
        figCaption:
          "Figure 4.2. A simple pricing ladder: a free trial, a core plan and a premium tier for teams.",
      },
      ui: {
        createNewBook: "Create New Book",
        topicLabel: "Describe your book",
        topicCounter: "412 / 15000",
        bookSize: "Book Size",
        popular: "Popular",
        tierStandard: "Standard · 60 pages",
        tierComprehensive: "Comprehensive · 120 pages",
        colorScheme: "Colours",
        optional: "optional",
        colorAuto: "Automatic (matched to your topic)",
        seeContents: "See my book's table of contents for free",
        bookStructure: "Table of contents",
        freePreview: "Free preview",
        bookTitleLabel: "Book Title",
        addChapter: "Add Chapter",
        redoOnce: "New version (1×)",
        payAndWrite: "I like it, pay {price} and write",
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
      sub: "Most AI writing is a confident guess from training data. InkMagnet builds every book on real sources it reads at generation time, and on a structure planned before a single sentence is written.",
      items: [
        {
          title: "Full sources, not snippets",
          desc: "For each book the engine searches the live web and scrapes dozens of complete pages and scientific documents end to end, not the two-line previews a search box returns. The numbers, names and citations come from what the sources actually say.",
        },
        {
          title: "A structure before a sentence",
          desc: "It plans the whole book first (chapters, sections and a research brief for each), then writes against that plan, so every chapter knows what the others cover. No rambling, no repetition, no dropped threads.",
        },
        {
          title: "Reviewed, then revised",
          desc: "After the first draft an AI editor checks coverage, trims redundant passages and fills the gaps. It is the editing pass a book gets before it ships, not a one-shot dump.",
        },
        {
          title: "Grounded and original",
          desc: "Because it writes from sources it has just read, not from memory, the prose is current, specific and yours: written for your exact topic, audience and angle.",
        },
      ],
    },
    universality: {
      title: "If it can be researched, it can be a book",
      sub: "InkMagnet isn't tied to one niche. The same pipeline researches and writes a cookbook, a thesis companion, a SaaS playbook or a course handbook, in your language, on practically any subject.",
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
      note: "You pick the topic. InkMagnet does the reading.",
    },
    editorSection: {
      title: "Don't like a paragraph? Three ways to fix it.",
      sub: "Every finished book opens in a full editor. Rewrite it yourself, tell the AI what to change in a chapter or section and accept the result only if you like it, or send the passage to our human editor. Then regenerate a fresh PDF. Your hand-edits are never overwritten.",
      points: [
        "Improve with AI: say what to change, see the change first, keep it or discard it (3 per book)",
        "Check by a human: describe what is wrong and an editor corrects it by hand, free of charge (up to 3 requests per book)",
        "Visual or LaTeX: edit however you like",
        "Headings, bold, lists, quotes, callout boxes, tables and images",
        "Version history: every regenerate is saved",
        "Your edits are sacred: regenerations never clobber them",
      ],
    },
    interiorReader: {
      title: "Real books, not a wall of text",
      sub: "Open an InkMagnet ebook and you get genuine book design: a clickable contents, drop-cap chapter openings, styled tables, insight boxes and matched illustrations, typeset with the system behind academic publishing. Reads great on any device.",
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
          desc: "Turn the knowledge in your head into a credible book with your name on the cover, without spending six months ghostwriting it yourself.",
        },
        {
          title: "Marketing & content teams",
          desc: "Spin up gated ebooks, whitepapers and resource guides on demand, each grounded in real research and on-brand from cover to last page.",
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
          note: "A subscription, and they hand you a raw draft you still have to format yourself.",
        },
        {
          label: "Typesetting tools (Atticus, Vellum)",
          cost: "$147–250 once",
          note: "Only format a finished manuscript. You still have to write the whole book.",
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
        "Research, writing, review, typesetting, cover, PDF + EPUB. One payment, full commercial rights, no subscription.",
      foot: "Comparison figures are typical 2025 market rates and vary by provider.",
    },
    pricing: {
      title: "One price per book. Nothing recurring.",
      sub: "You pay only once you like the plan. The title, full table of contents and a two-page style sample are free. Research, writing, illustrations, cover, PDF and EPUB: everything is included.",
      perBook: "per book",
      pages: "pages",
      tiers: [
        { label: "Compact", pages: "30–45", price: "$9.99", usd: 9.99 },
        { label: "Standard", pages: "46–75", price: "$14.99", usd: 14.99 },
        { label: "Extended", pages: "76–115", price: "$19.99", usd: 19.99 },
        {
          label: "Comprehensive",
          pages: "116–160",
          price: "$27.99",
          usd: 27.99,
        },
        { label: "Complete", pages: "161–200", price: "$34.99", usd: 34.99 },
      ],
      note: "Full commercial rights. Unlimited edits and recompiles of every book you've bought.",
      cta: "Plan your first book for free",
    },
    faq: {
      title: "Frequently asked questions",
      items: [
        {
          q: "Who owns the books I create?",
          a: "You do. Every book comes with full commercial rights: sell it, give it away as a lead magnet, publish it under your name.",
        },
        {
          q: "How long does it take?",
          a: "The title and table of contents are ready in under a minute, before you pay, and the optional two-page sample takes about a minute more. After payment, a complete book (researched, written, illustrated, typeset and compiled) typically takes under an hour.",
        },
        {
          q: "Can I see my book before I pay?",
          a: "Yes. For free, you get the title and the full table of contents: chapters and sections, each with a short description. Edit it like any document: rename, rewrite descriptions, add or remove chapters and sections. If you want a different take, the AI makes one new version based on your notes and you choose version 1 or version 2. You can also order a free two-page sample: the opening of chapter 1, written and typeset exactly like the final book. If you leave style and colours on automatic, the AI picks ones that suit your topic. You pay only when you are happy with the plan.",
        },
        {
          q: "Which languages are supported?",
          a: "You pick the book's language when you create the project. English, Polish, German, Spanish (Spain or Latin America) and Portuguese (Portugal or Brazil) are fully supported, including language-aware typography and hyphenation. The regional variants differ in vocabulary and wording, not just in spelling.",
        },
        {
          q: "Can I edit the content?",
          a: "Yes, in three ways. Every chapter is editable in a built-in WYSIWYG editor, and your manual edits are never overwritten by later regenerations. You can also tell the AI what to change in a chapter or section (shorten, simplify, add an example): you see the change before it is applied and can undo it, three times per book. And if something is simply wrong, use “Check by a human”: describe it and our editor corrects the book by hand, free of charge, up to three requests per book. Recompile the PDF and EPUB as often as you like.",
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
          a: "Those tools write text in a chat window. You still research, fact-check, structure, format, design a cover and export everything yourself. InkMagnet runs the same class of models but adds live web research, full-book consistency, professional typesetting, a designed cover and PDF/EPUB export. You get a finished book instead of a transcript to assemble.",
        },
        {
          q: "How is this different from other AI book tools?",
          a: "Most 'AI book' tools wrap a chatbot and hand you a long blog post inside a PDF. InkMagnet researches your topic on the live web, compiles real book typesetting with LaTeX, generates a designed cover and matched illustrations, and preserves your manual edits across recompiles.",
        },
        {
          q: "Do I need writing, design or formatting skills?",
          a: "No. You describe the book in a single field (a sentence is enough, a detailed brief is better), and everything else, from style to colours, can stay on automatic. The pipeline handles research, writing, layout, cover and export. If you want to change anything, the built-in editor is plain WYSIWYG, with no LaTeX and no design software.",
        },
      ],
    },
    finalCta: {
      title: "Your book is one form away",
      sub: "Describe your book today, see its table of contents for free, and download the finished ebook within an hour of paying.",
      cta: "See your plan free. Books from $9.99",
    },
    phone: {
      // The Android screens, recreated in HTML so both languages stay in sync
      // with the real UI — the Play screenshots only exist in Polish.
      time: "9:41",
      books: {
        title: "My Books",
        items: [
          { title: "The Lean SaaS Launch Playbook", meta: "60 pages · EN · premium", status: "Completed", state: "done" },
          { title: "Atomic Habits for Founders", meta: "84 pages · EN · modern", status: "Writing…", state: "writing" },
          { title: "The Remote Team Handbook", meta: "72 pages · EN · modern", status: "Completed", state: "done" },
        ],
      },
      create: {
        title: "New book",
        topicLabel: "Describe your book",
        topicPlaceholder: "e.g. Air fryer: 60 simple everyday recipes for busy families, with shopping lists",
        styleLabel: "Style and colours",
        styleValue: "Automatic",
        langLabel: "Book language",
        langs: ["English", "Polski"],
        sizeLabel: "Length",
        sizes: [
          { name: "Compact", pages: "30–40 pages" },
          { name: "Standard", pages: "50–70 pages" },
          { name: "Extended", pages: "80–100 pages" },
        ],
      },
      detail: {
        title: "Strength Training at Home",
        status: "Completed",
        progressLabel: "Progress",
        steps: ["Plan", "Sample", "Payment", "Writing", "Typeset", "Ready"],
        downloadLabel: "Download",
        pdf: "Open PDF",
        epub: "Open EPUB",
        webLink: "Edit chapters in the web app",
      },
    },
    appPromo: {
      badge: "New: Android app",
      title: "Now you can start a book from your phone",
      sub: "InkMagnet has an Android app. Describe a book on the bus, check its free table of contents over coffee, open the finished PDF on the train home. Same account, same books, same engine as the web app.",
      points: [
        "See the free plan and a two-page sample before you buy, then follow every stage live: research, writing, typesetting.",
        "Open the finished PDF and EPUB straight on your phone.",
        "Pay once per book through Google Play. No subscription.",
        "Chapters you edited on the web stay exactly as you left them.",
      ],
      cta: "Get it on Google Play",
      more: "More about the app",
      note: "Requires Android 7.0 or newer. The full chapter editor stays in the web app.",
    },
    appPage: {
      badge: "Android app",
      title1: "The AI ebook generator,",
      titleAccent: "in your pocket",
      sub: "InkMagnet for Android turns a topic into a finished book: researched on the live web, written chapter by chapter, illustrated, typeset and delivered as a print-quality PDF and EPUB. Order it from your phone, watch it being built, read it the moment it lands.",
      bullets: ["Free to install", "One payment per book", "PDF + EPUB on your phone"],
      ctaSecondary: "See sample pages",
      screens: {
        title: "Three screens, the whole workflow",
        sub: "Nothing is hidden behind a desktop-only wall: ordering, tracking and downloading all happen on the phone.",
        items: [
          {
            title: "Your library",
            text: "Every book you have ordered, with its live status: waiting for payment, planning, writing, typesetting, ready. Books you started in the browser appear here too, because it is one account rather than two products.",
          },
          {
            title: "Order a new book",
            text: "Describe your book in one field and pick one of five sizes, from 30 to 200 pages. You get a free plan with the full table of contents, one AI redo with your notes and a free two-page sample. Only then do you pay through Google Play, and the pipeline starts within seconds.",
          },
          {
            title: "Track it, then download",
            text: "A six-stage strip shows exactly where your book is: plan, sample, payment, writing, typesetting, ready. When it finishes, the PDF and the EPUB open straight from the app.",
          },
        ],
      },
      why: {
        title: "Why it is worth having on the phone",
        sub: "A book takes about an hour to build. The app is what lets you spend that hour anywhere.",
        items: [
          {
            title: "Order in the two minutes you actually have",
            desc: "A queue, a commute, a waiting room. Describing the book takes a minute, and the engine works while you get on with your day.",
          },
          {
            title: "Check the plan where you are",
            desc: "The table of contents is the one decision that shapes everything else, and you see it free, before paying. Edit it, ask the AI for one new version, look at a two-page sample. None of that should need a laptop.",
          },
          {
            title: "Read it on the device you read on",
            desc: "The finished PDF and EPUB open in the app, so a book generated at nine in the morning can be read on the sofa that evening without moving files between devices.",
          },
          {
            title: "Pay through Google Play",
            desc: "Once you like the plan, payment goes through the Play account you already have, in your local currency, with Google handling the receipt and the refund policy.",
          },
        ],
      },
      split: {
        title: "The app and the web share one account",
        sub: "Two windows onto the same books, and each is better at something.",
        appTitle: "Do it in the app",
        appItems: [
          "Describe a book and see its free plan and two-page sample",
          "Edit the table of contents, or get one new version from AI",
          "Pay through Google Play when you like the plan",
          "Follow the build stage by stage",
          "Open, read and share the finished PDF and EPUB",
        ],
        webTitle: "Do it in the browser",
        webItems: [
          "Edit chapter text in the full editor",
          "Regenerate a single chapter or illustration",
          "Recompile the PDF and EPUB after edits",
          "Manage cover variants and typography",
        ],
        note: "Manual edits made in the browser are never overwritten by anything you do in the app.",
      },
      price: {
        title: "The same price, paid a different way",
        body: "In the app a book is a one-off Google Play in-app purchase, billed in your own currency with local tax included, which is why the figure on the phone is not the plain dollar price shown on this site. Neither version has a subscription, and a book bought in the app is the same book: full commercial rights, no watermark.",
      },
      faq: {
        title: "Questions about the app",
        items: [
          {
            q: "Is the app free?",
            a: "The app is free to install and free to browse. You pay only when you order a specific book, as a one-time in-app purchase through Google Play.",
          },
          {
            q: "Do I need a separate account?",
            a: "No. It is the same InkMagnet account as on the web. Sign in on the phone and your existing books are there; order on the phone and the book shows up in the browser.",
          },
          {
            q: "Can I edit chapters in the app?",
            a: "Not yet. The app takes you from an idea to a finished, downloadable book. Rewriting chapter text happens in the web editor, and the app links straight to it.",
          },
          {
            q: "Is there an iPhone version?",
            a: "Not at the moment. On iOS the web app works in Safari, so you can order, track and download books from there.",
          },
          {
            q: "What Android version do I need?",
            a: "Android 7.0 (Nougat) or newer.",
          },
          {
            q: "What happens if I close the app while a book is being written?",
            a: "Nothing stops. The whole pipeline runs on our servers, so you can close the app, lose signal or restart the phone: the book carries on and is waiting when you come back.",
          },
        ],
      },
      final: {
        title: "Install it and start your first book",
        sub: "Free to install. One payment per book, whenever you decide to make one.",
      },
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
      app: "Aplikacja Android",
    },
    hero: {
      badge: "Polski generator ebooków AI",
      title1: "Twój ebook bez pisania.",
      titleAccent: "Gotowy do wydania w godzinę.",
      title2: "",
      sub: "Opisz temat, a InkMagnet zbada go w aktualnych źródłach, napisze każdy rozdział, przeprowadzi redakcję językową i złoży całość w PDF i EPUB z okładką, spisem treści i przypisami. Bez abonamentu: płacisz za jedną książkę, i to dopiero wtedy, gdy zobaczysz jej plan.",
      ctaPrimary: "Zaplanuj książkę za darmo",
      ctaSecondary: "Zobacz, jak to działa",
      bullets: [
        "Darmowy spis treści i próbka 2 stron",
        "Przypisy do prawdziwych źródeł",
        "Redakcja językowa w każdej książce",
        "PDF + EPUB, pełne prawa komercyjne",
      ],
    },
    how: {
      title: "Od opisu do gotowej książki w czterech krokach",
      sub: "Plan widzisz, zanim zapłacisz. Resztę robi silnik.",
      steps: [
        {
          title: "Opisz swoją książkę",
          desc: "Jedno pole, do 15 000 znaków: temat, dla kogo jest książka i co koniecznie ma się w niej znaleźć. Możesz dołączyć notatki lub pliki, a potem wybierasz objętość. Styl, format, kolory, okładka i ilustracje są opcjonalne. Jeśli zostawisz je na automacie, AI dobierze styl i paletę barw pasujące do tematu.",
        },
        {
          title: "Zobacz spis treści za darmo",
          desc: "Zanim zapłacisz, dostajesz tytuł i pełny spis treści: rozdziały i podrozdziały, każdy z krótkim opisem. Możesz zmienić w nim wszystko, dodać lub usunąć rozdziały albo poprosić AI o jedną nową wersję według Twoich uwag i zostawić tę, która bardziej Ci odpowiada. Chcesz sprawdzić, jak to się czyta? Darmowa, dwustronicowa próbka początku rozdziału 1, złożona dokładnie tak jak gotowa książka, jest gotowa po mniej więcej minucie.",
        },
        {
          title: "Płacisz, a AI bada temat i pisze",
          desc: "Płacisz dopiero wtedy, gdy plan Ci odpowiada. Silnik bada temat w aktualnych źródłach internetowych i rozwija Twój plan w szczegółowy konspekt, który możesz poprawić (albo raz wygenerować od nowa), zanim powstanie jakikolwiek rozdział. Potem każdy rozdział zostaje napisany i zrecenzowany, a całość przechodzi redakcję językową i kontrolę spójności, zanim trafi do składu.",
        },
        {
          title: "Pobierz i publikuj",
          desc: "Dostajesz PDF gotowy do druku i EPUB gotowy do sklepów, z zaprojektowaną okładką. Każdy rozdział możesz poprawić we wbudowanym edytorze, dodać własne zdjęcia i przekompilować książkę w dowolnym momencie.",
        },
      ],
    },
    features: {
      title: "Co sprawia, że te książki czyta się z przyjemnością",
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
          desc: "Większość tekstów AI powstaje z pamięci modelu i właśnie dlatego pojawiają się w nich statystyki i cytowania, które rozpadają się przy weryfikacji. InkMagnet najpierw przeszukuje aktualny internet, czyta realne źródła i osadza w nich każdy rozdział, więc liczby, nazwiska i odwołania wskazują na rzeczy, które faktycznie istnieją.",
        },
        {
          title: "Pisze całą książkę, nie jedną długą odpowiedź",
          desc: "Stustronicowa książka nie zmieści się w jednej odpowiedzi czatu. Zapytaj chatbota, a urwie wątek, zacznie się powtarzać i zapomni rozdział 2 przy rozdziale 9. InkMagnet najpierw planuje strukturę, a potem pisze i recenzuje każdy rozdział względem pozostałych, trzymając spójną terminologię, argumentację i ton od okładki po zakończenie.",
        },
        {
          title: "Składa, ilustruje i pakuje",
          desc: "Prawdziwe książki to nie markdown. Każdy projekt jest kompilowany LaTeX-em (systemem znanym z wydawnictw akademickich), z klikalnym spisem treści, poprawnym dzieleniem wyrazów, inicjałami, tabelami i ilustracjami AI wstawianymi pod konkretne rozdziały. Dostajesz PDF gotowy do druku i EPUB gotowy do sklepu z zaprojektowaną okładką, a nie ścianę tekstu do formatowania.",
        },
      ],
    },
    compare: {
      title: "„Przecież mogę użyć ChatGPT albo Claude'a”",
      sub: "Tekst napiszesz w oknie czatu. Ale okno czatu nie odda Ci gotowej, sprzedawalnej książki. To musisz zrobić sam. Ta sama klasa modeli, zupełnie inny efekt.",
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
          a: "Pisane z pamięci, więc cytowania często są zmyślone",
          b: "Research w sieci, oparty na weryfikowalnych, cytowanych źródłach",
        },
        {
          label: "Pełne książki",
          a: "Limity kontekstu urywają, powtarzają i gubią wątek",
          b: "Cała książka, rozdział po rozdziale, spójna do końca",
        },
        {
          label: "Skład",
          a: "Czysty tekst lub markdown, formatujesz sam",
          b: "Profesjonalny LaTeX: spis treści, marginesy, dzielenie, inicjały",
        },
        {
          label: "Okładka i grafiki",
          a: "Brak, najwyżej opis do odtworzenia gdzie indziej",
          b: "Zaprojektowana okładka + ilustracje AI pod rozdziały",
        },
        {
          label: "Czas składania",
          a: "Godziny kopiowania, formatowania i eksportu",
          b: "Automatycznie: gotowa książka w około godzinę",
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
      note: "InkMagnet działa na tej samej klasie czołowych modeli, którym już ufasz. Tyle że opakowuje je w cały proces wydawniczy, więc wychodzisz z książką, a nie z transkryptem.",
    },
    gallery: {
      title: "Tak wyglądają Twoje gotowe strony",
      sub: "Klikalny spis treści, otwarcia rozdziałów z inicjałem, tabele i dopasowane ilustracje. Taki skład dostaje każda książka z InkMagnet.",
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
      sub: "Prawdziwe ekrany z gotowej książki, bez makiet.",
      note: "Ekrany z książek wygenerowanych w InkMagnet.",
      items: [
        {
          title: "Twój prywatny panel książki",
          text: "Widoczny tylko dla Ciebie: okładka, liczba stron, język, styl i pasek postępu. Przed płatnością w panelu czekają darmowy spis treści i dwustronicowa próbka, a po płatności śledzisz research, pisanie i skład, aż książka będzie gotowa.",
          alt: "Panel książki w InkMagnet z okładką i paskiem postępu",
        },
        {
          title: "Rozdziały otwierasz jeden po drugim",
          text: "Gotowa książka to lista rozdziałów z liczbą słów. Otwierasz dowolny, czytasz, poprawiasz zdanie, dopisujesz akapit.",
          alt: "Lista rozdziałów w edytorze InkMagnet",
        },
        {
          title: "Edytor wizualny jak w Wordzie",
          text: "Nagłówki, pogrubienia, listy, ramki, tabele i obrazy: edytujesz tekst jak w edytorze tekstu, a książka składa się na nowo sama. Dla ciekawych jest też tryb surowego LaTeX-a, jedno kliknięcie dalej.",
          alt: "Wizualny edytor rozdziału w InkMagnet",
        },
      ],
    },
    appShowcase: {
      title: "Jeden panel na wszystkie Twoje książki",
      sub: "Okładki, postęp generowania i pobrania: cała biblioteka w jednym miejscu.",
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
          "Praktyczny przewodnik, jak wystartować z rentownym SaaS-em w 2025 roku, napisany dla nietechnicznych założycieli. Walidacja pomysłu, skromne MVP, pierwszych dziesięciu klientów i cennik. Prosty język, prawdziwe przykłady, lista kontrolna po każdym rozdziale.",
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
        body: "iększość założycieli skupia się na produkcie i pomija trudniejszy problem: nakłonienie kogokolwiek, by w ogóle zapłacił. Pierwszych dziesięciu klientów rzadko przyciągają reklamy. Pojawiają się dzięki rozmowom prowadzonym pojedynczo tam, gdzie Twoi przyszli użytkownicy już bywają.",
        body2:
          "Zacznij tam, gdzie ból jest największy. Wypisz trzy społeczności, w których Twoi kupujący już narzekają na problem, który rozwiązujesz, i pojaw się tam jako uczestnik, a nie reklamodawca.",
        tableTitle: "Tabela 3.1. Kanały pozyskania wg kosztu i tempa",
        tableCols: ["Kanał", "Koszt", "Pierwszy lead"],
        tableRows: [
          ["Bezpośredni kontakt", "0 zł", "1–3 dni"],
          ["Społeczności", "0 zł", "~1 tydzień"],
          ["Treści / SEO", "$$", "2–3 mies."],
          ["Reklamy płatne", "$$$", "Tego dnia"],
        ],
        insightLabel: "Kluczowa myśl",
        insightText:
          "Do pierwszych dziesięciu klientów bezpośredni kontakt bije każdy płatny kanał. Kosztuje tylko czas i uczy Cię, jakimi słowami mówią Twoi kupujący.",
        figCaption:
          "Rysunek 4.2. Prosta drabina cenowa: darmowy okres próbny, plan podstawowy i wariant premium dla zespołów.",
      },
      ui: {
        createNewBook: "Nowa książka",
        topicLabel: "Opisz swoją książkę",
        topicCounter: "412 / 15000",
        bookSize: "Rozmiar książki",
        popular: "Popularne",
        tierStandard: "Standard · 60 stron",
        tierComprehensive: "Kompleksowa · 120 stron",
        colorScheme: "Kolorystyka",
        optional: "opcjonalnie",
        colorAuto: "Automatycznie (dobrana do tematu)",
        seeContents: "Zobacz za darmo spis treści mojej książki",
        bookStructure: "Spis treści",
        freePreview: "Darmowy podgląd",
        bookTitleLabel: "Tytuł książki",
        addChapter: "Dodaj rozdział",
        redoOnce: "Nowa wersja (1×)",
        payAndWrite: "Podoba mi się, płacę {price} i piszemy",
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
      sub: "Większość treści AI to pewny siebie strzał z danych treningowych. InkMagnet buduje każdą książkę na realnych źródłach czytanych w trakcie generowania oraz na strukturze zaplanowanej, zanim padnie pierwsze zdanie.",
      items: [
        {
          title: "Pełne źródła, nie zajawki",
          desc: "Do każdej książki silnik przeszukuje aktualny internet i scrapuje dziesiątki kompletnych stron oraz dokumentów naukowych w całości, a nie dwuwierszowe zapowiedzi z wyszukiwarki. Liczby, nazwiska i cytowania pochodzą z tego, co źródła naprawdę mówią.",
        },
        {
          title: "Najpierw struktura, potem zdanie",
          desc: "Najpierw planuje całą książkę (rozdziały, podrozdziały i brief źródłowy do każdego), a potem pisze zgodnie z tym planem, więc każdy rozdział wie, co zawierają pozostałe. Bez lania wody, powtórzeń i porzuconych wątków.",
        },
        {
          title: "Recenzja, potem poprawki",
          desc: "Po pierwszej wersji redaktor AI sprawdza kompletność, przycina powtórzenia i uzupełnia luki. To redakcja, którą książka dostaje przed wydaniem, a nie jednorazowy zrzut tekstu.",
        },
        {
          title: "Osadzone i oryginalne",
          desc: "Ponieważ pisze z przed chwilą przeczytanych źródeł, a nie z pamięci, tekst jest aktualny, konkretny i Twój: napisany pod Twój dokładny temat, odbiorcę i ujęcie.",
        },
      ],
    },
    universality: {
      title: "Jeśli da się to zbadać, może być książką",
      sub: "InkMagnet nie jest przypisany do jednej niszy. Ten sam silnik bada i pisze książkę kucharską, kompendium do pracy dyplomowej, podręcznik SaaS czy materiał do kursu w Twoim języku, na praktycznie dowolny temat.",
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
      note: "Ty wybierasz temat. Czytanie bierze na siebie InkMagnet.",
    },
    editorSection: {
      title: "Nie podoba Ci się akapit? Masz trzy sposoby.",
      sub: "Każda gotowa książka otwiera się w pełnym edytorze. Przepisz fragment samodzielnie, napisz AI, co zmienić w rozdziale albo sekcji, i zostaw wynik tylko wtedy, gdy Ci odpowiada, albo zleć poprawkę naszemu redaktorowi. Potem wygeneruj świeży PDF. Twoje ręczne zmiany nigdy nie zostają nadpisane.",
      points: [
        "Popraw z AI: piszesz, co zmienić, najpierw widzisz zmianę i decydujesz, czy ją zostawić (3 na książkę)",
        "Sprawdź przez człowieka: opisujesz, co jest nie tak, a redaktor poprawia to ręcznie, bezpłatnie (do 3 zgłoszeń na książkę)",
        "Wizualnie albo w LaTeX-u, jak wolisz",
        "Nagłówki, pogrubienia, listy, cytaty, ramki, tabele i obrazy",
        "Historia wersji: każda regeneracja jest zapisana",
        "Twoje zmiany są święte: regeneracje ich nie kasują",
      ],
    },
    interiorReader: {
      title: "Prawdziwe książki, nie ściana tekstu",
      sub: "Otwórz ebooka z InkMagnet i dostajesz prawdziwy skład książki: klikalny spis treści, otwarcia rozdziałów z inicjałem, tabele, ramki i dopasowane ilustracje, złożone systemem stojącym za publikacjami naukowymi. Świetnie czyta się na każdym urządzeniu.",
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
          title: "Trenerzy i konsultanci",
          desc: "Książka z Twoim nazwiskiem na okładce wciąż buduje wiarygodność jak nic innego.",
        },
        {
          title: "Agencje",
          desc: "Oddawaj klientom ebooki w dni zamiast tygodni, za ułamek stawki ghostwritera.",
        },
        {
          title: "Autorzy i eksperci",
          desc: "Zamień wiedzę z głowy w wiarygodną książkę z Twoim nazwiskiem na okładce, bez sześciu miesięcy pisania jej samemu.",
        },
        {
          title: "Zespoły marketingu i treści",
          desc: "Twórz na żądanie ebooki za zapis, whitepapery i poradniki, każdy oparty na realnym researchu i spójny z marką od okładki po ostatnią stronę.",
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
          note: "Abonament, a do tego oddają surowy draft, który i tak sam musisz złożyć.",
        },
        {
          label: "Narzędzia do składu (Atticus, Vellum)",
          cost: "550–950 zł jednorazowo",
          note: "Tylko składają gotowy manuskrypt. Całą książkę i tak piszesz sam.",
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
        "Research, pisanie, recenzja, skład, okładka, PDF + EPUB. Jedna opłata, pełne prawa komercyjne, bez abonamentu.",
      foot: "Ceny porównawcze to typowe stawki rynkowe (2025) i różnią się między dostawcami.",
    },
    pricing: {
      title: "Jedna cena za książkę. Żadnych abonamentów.",
      sub: "Płacisz dopiero wtedy, gdy plan Ci odpowiada. Tytuł, pełny spis treści i dwustronicowa próbka stylu są za darmo. Research, pisanie, ilustracje, okładka, PDF i EPUB: wszystko w cenie.",
      perBook: "za książkę",
      pages: "stron",
      tiers: [
        { label: "Compact", pages: "30–45", price: "$9.99", usd: 9.99 },
        { label: "Standard", pages: "46–75", price: "$14.99", usd: 14.99 },
        { label: "Extended", pages: "76–115", price: "$19.99", usd: 19.99 },
        {
          label: "Comprehensive",
          pages: "116–160",
          price: "$27.99",
          usd: 27.99,
        },
        { label: "Complete", pages: "161–200", price: "$34.99", usd: 34.99 },
      ],
      note: "Pełne prawa komercyjne. Edycje i ponowne kompilacje kupionych książek bez limitu.",
      cta: "Zaplanuj pierwszą książkę za darmo",
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
          a: "Tytuł i spis treści są gotowe w niecałą minutę, jeszcze przed płatnością, a opcjonalna dwustronicowa próbka zajmuje mniej więcej minutę więcej. Po płatności cała książka (zbadana, napisana, zilustrowana, złożona i skompilowana) powstaje zwykle w mniej niż godzinę.",
        },
        {
          q: "Czy zobaczę książkę, zanim zapłacę?",
          a: "Tak. Za darmo dostajesz tytuł i pełny spis treści: rozdziały i podrozdziały, każdy z krótkim opisem. Poprawiasz go jak zwykły dokument: zmieniasz tytuły i opisy, dodajesz albo usuwasz rozdziały i podrozdziały. Jeśli chcesz innego ujęcia, AI raz przygotuje nową wersję według Twoich uwag, a Ty wybierasz wersję 1 albo 2. Możesz też zamówić darmową, dwustronicową próbkę: początek rozdziału 1 napisany i złożony dokładnie tak jak gotowa książka. Jeśli styl i kolory zostawisz na automacie, AI dobierze je do tematu. Płacisz dopiero wtedy, gdy plan Ci odpowiada.",
        },
        {
          q: "Jakie języki są obsługiwane?",
          a: "Język książki wybierasz przy tworzeniu projektu. Polski, angielski, niemiecki, hiszpański (Hiszpania albo Ameryka Łacińska) i portugalski (Portugalia albo Brazylia) działają w pełni, łącznie z typografią i dzieleniem wyrazów właściwym dla języka. Warianty regionalne różnią się słownictwem i sformułowaniami, a nie tylko pisownią.",
        },
        {
          q: "Czy mogę edytować treść?",
          a: "Tak, na trzy sposoby. Każdy rozdział otworzysz we wbudowanym edytorze WYSIWYG, a ręczne poprawki nigdy nie zostaną nadpisane przez późniejsze generacje. Możesz też napisać AI, co zmienić w rozdziale albo sekcji (skrócić, uprościć, dodać przykład): zmianę widzisz, zanim zostanie wprowadzona, i możesz ją cofnąć, trzy razy na książkę. A jeśli coś jest po prostu źle, użyj opcji „Sprawdź przez człowieka”: opisujesz problem, a nasz redaktor poprawia książkę ręcznie, bezpłatnie, do trzech zgłoszeń na książkę. PDF i EPUB przekompilujesz dowolną liczbę razy.",
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
          a: "Te narzędzia piszą tekst w oknie czatu, a research, weryfikację faktów, strukturę, formatowanie, okładkę i eksport robisz sam. InkMagnet działa na tej samej klasie modeli, ale dokłada research w sieci, spójność całej książki, profesjonalny skład, zaprojektowaną okładkę i eksport PDF/EPUB. Dostajesz gotową książkę, nie transkrypt do poskładania.",
        },
        {
          q: "Czym to się różni od innych generatorów książek AI?",
          a: "Większość narzędzi „AI book” opakowuje chatbota i oddaje długi wpis blogowy w PDF. InkMagnet bada temat w aktualnej sieci, składa prawdziwą typografię książkową w LaTeX-u, generuje zaprojektowaną okładkę i dopasowane ilustracje oraz zachowuje Twoje ręczne poprawki przy kolejnych kompilacjach.",
        },
        {
          q: "Czy muszę umieć pisać, projektować albo składać?",
          a: "Nie. Opisujesz książkę w jednym polu (wystarczy zdanie, choć szczegółowy opis da lepszy efekt), a całą resztę, od stylu po kolory, możesz zostawić na automacie. Research, pisanie, układ, okładkę i eksport bierze na siebie silnik. Jeśli chcesz coś zmienić, wbudowany edytor jest zwykłym WYSIWYG, bez LaTeX-a i programów graficznych.",
        },
      ],
    },
    finalCta: {
      title: "Od Twojej książki dzieli Cię jeden formularz",
      sub: "Opisz książkę dzisiaj, za darmo obejrzyj jej spis treści, a gotowego ebooka pobierzesz w ciągu godziny od płatności.",
      cta: "Zobacz plan za darmo. Książki od $9.99",
    },
    phone: {
      // Ekrany aplikacji odtworzone w HTML, żeby obie wersje językowe
      // nadążały za prawdziwym UI (zrzuty z Play są tylko po polsku).
      time: "9:41",
      books: {
        title: "Moje książki",
        items: [
          { title: "Trening siłowy w domu: 30 ćwiczeń", meta: "35 stron · PL · premium", status: "Gotowa", state: "done" },
          { title: "Thermomix: proste obiady dla zabieganych", meta: "60 stron · PL · modern", status: "Pisanie…", state: "writing" },
          { title: "Air fryer: 60 prostych przepisów", meta: "35 stron · PL · modern", status: "Gotowa", state: "done" },
        ],
      },
      create: {
        title: "Nowa książka",
        topicLabel: "Opisz swoją książkę",
        topicPlaceholder: "np. Air fryer: 60 prostych przepisów na każdy dzień dla zabieganej rodziny, z listami zakupów",
        styleLabel: "Styl i kolory",
        styleValue: "Automatycznie",
        langLabel: "Język książki",
        langs: ["English", "Polski"],
        sizeLabel: "Rozmiar",
        sizes: [
          { name: "Kompaktowa", pages: "30–40 stron" },
          { name: "Standardowa", pages: "50–70 stron" },
          { name: "Rozszerzona", pages: "80–100 stron" },
        ],
      },
      detail: {
        title: "Trening siłowy w domu",
        status: "Gotowa",
        progressLabel: "Postęp",
        steps: ["Plan", "Próbka", "Płatność", "Pisanie", "Składanie", "Gotowe"],
        downloadLabel: "Pobieranie",
        pdf: "Otwórz PDF",
        epub: "Otwórz EPUB",
        webLink: "Edytuj rozdziały w wersji web",
      },
    },
    appPromo: {
      badge: "Nowość: aplikacja na Androida",
      title: "Książkę zamówisz teraz z telefonu",
      sub: "InkMagnet ma aplikację na Androida. Opiszesz książkę w autobusie, przy kawie przejrzysz jej darmowy spis treści, a gotowy PDF otworzysz w drodze do domu. To samo konto, te same książki i ten sam silnik co w wersji web.",
      points: [
        "Przed zakupem widzisz darmowy plan i dwustronicową próbkę, a potem na żywo śledzisz każdy etap: research, pisanie, skład.",
        "Gotowy PDF i EPUB otwierasz bezpośrednio w telefonie.",
        "Płacisz raz za książkę przez Google Play. Bez abonamentu.",
        "Rozdziały poprawione w wersji web zostają dokładnie takie, jak je zostawiłeś.",
      ],
      cta: "Pobierz z Google Play",
      more: "Więcej o aplikacji",
      note: "Wymaga Androida 7.0 lub nowszego. Pełny edytor rozdziałów pozostaje w wersji web.",
    },
    appPage: {
      badge: "Aplikacja na Androida",
      title1: "Generator ebooków AI",
      titleAccent: "w kieszeni",
      sub: "InkMagnet na Androida zamienia temat w gotową książkę: research w żywych źródłach, pisanie rozdział po rozdziale, ilustracje, skład typograficzny, a na końcu PDF w jakości drukarskiej i EPUB. Zamawiasz z telefonu, na żywo patrzysz, jak książka powstaje, i czytasz, gdy tylko będzie gotowa.",
      bullets: ["Instalacja za darmo", "Jedna płatność za książkę", "PDF i EPUB w telefonie"],
      ctaSecondary: "Zobacz przykładowe strony",
      screens: {
        title: "Trzy ekrany, cały proces",
        sub: "Nic nie jest schowane za ścianą „tylko na komputerze”: zamówienie, śledzenie i pobranie dzieją się w telefonie.",
        items: [
          {
            title: "Twoja biblioteka",
            text: "Wszystkie zamówione książki z aktualnym statusem: czeka na płatność, planowanie, pisanie, składanie, gotowa. Książki zaczynane w przeglądarce też tu są, bo to jedno konto, a nie dwa osobne produkty.",
          },
          {
            title: "Zamówienie nowej książki",
            text: "Opisujesz książkę w jednym polu i wybierasz jeden z pięciu rozmiarów, od 30 do 200 stron. Dostajesz darmowy plan z pełnym spisem treści, jedną nową wersję od AI według Twoich uwag i darmową, dwustronicową próbkę. Dopiero wtedy płacisz przez Google Play, a silnik rusza po kilku sekundach.",
          },
          {
            title: "Śledzenie i pobranie",
            text: "Sześcioetapowy pasek pokazuje dokładnie, gdzie jest książka: plan, próbka, płatność, pisanie, składanie, gotowe. Po zakończeniu PDF i EPUB otwierasz wprost z aplikacji.",
          },
        ],
      },
      why: {
        title: "Po co to w telefonie",
        sub: "Książka powstaje mniej więcej w godzinę. Aplikacja sprawia, że tę godzinę możesz spędzić gdziekolwiek.",
        items: [
          {
            title: "Zamówienie w te dwie minuty, które naprawdę masz",
            desc: "Kolejka, dojazd, poczekalnia. Opisanie książki zajmuje minutę, a silnik pracuje, kiedy ty robisz swoje.",
          },
          {
            title: "Plan sprawdzasz tam, gdzie jesteś",
            desc: "Spis treści to jedyna decyzja, od której zależy cała reszta, a widzisz go za darmo, jeszcze przed płatnością. Poprawiasz go, prosisz AI o jedną nową wersję, oglądasz dwustronicową próbkę. Do niczego z tego nie potrzeba laptopa.",
          },
          {
            title: "Czytasz na urządzeniu, na którym czytasz",
            desc: "Gotowy PDF i EPUB otwierają się w aplikacji, więc książkę wygenerowaną rano przeczytasz wieczorem na kanapie, bez przerzucania plików między urządzeniami.",
          },
          {
            title: "Płatność przez Google Play",
            desc: "Gdy plan Ci odpowiada, płacisz kontem Play, które już masz, w złotówkach, a paragon i zasady zwrotów obsługuje Google.",
          },
        ],
      },
      split: {
        title: "Aplikacja i wersja web to jedno konto",
        sub: "Dwa okna na te same książki, a każde jest w czymś lepsze.",
        appTitle: "Zrób w aplikacji",
        appItems: [
          "Opisz książkę i obejrzyj jej darmowy plan oraz dwustronicową próbkę",
          "Popraw spis treści albo poproś AI o jedną nową wersję",
          "Zapłać przez Google Play, gdy plan Ci odpowiada",
          "Śledź powstawanie etap po etapie",
          "Otwórz, przeczytaj i wyślij gotowy PDF oraz EPUB",
        ],
        webTitle: "Zrób w przeglądarce",
        webItems: [
          "Popraw tekst rozdziału w pełnym edytorze",
          "Wygeneruj ponownie pojedynczy rozdział albo ilustrację",
          "Przekompiluj PDF i EPUB po zmianach",
          "Zarządzaj wariantami okładki i typografią",
        ],
        note: "Ręczne poprawki zrobione w przeglądarce nigdy nie zostają nadpisane przez to, co robisz w aplikacji.",
      },
      price: {
        title: "Ta sama cena, inaczej zapłacona",
        body: "W aplikacji książka jest jednorazowym zakupem w Google Play, rozliczanym w złotówkach i z podatkiem w cenie. Dlatego kwota na telefonie nie jest wprost przeliczonym kursem dolarem z tej strony. Żadna z wersji nie ma abonamentu, a książka kupiona w aplikacji jest dokładnie tą samą książką: z pełnymi prawami komercyjnymi i bez znaku wodnego.",
      },
      faq: {
        title: "Pytania o aplikację",
        items: [
          {
            q: "Czy aplikacja jest darmowa?",
            a: "Sama aplikacja jest darmowa, instalacja i przeglądanie nic nie kosztują. Płacisz dopiero, gdy zamawiasz konkretną książkę, jednorazowym zakupem w Google Play.",
          },
          {
            q: "Czy potrzebuję osobnego konta?",
            a: "Nie. To jest to samo konto InkMagnet co w wersji web. Zalogujesz się w telefonie i zobaczysz swoje dotychczasowe książki; zamówisz z telefonu, a książka pojawi się w przeglądarce.",
          },
          {
            q: "Czy mogę edytować rozdziały w aplikacji?",
            a: "Na razie nie. Aplikacja prowadzi od pomysłu do gotowej książki do pobrania. Przepisywanie tekstu rozdziałów odbywa się w edytorze webowym, do którego aplikacja linkuje jednym kliknięciem.",
          },
          {
            q: "Czy jest wersja na iPhone’a?",
            a: "Na razie nie. Na iOS działa wersja przeglądarkowa w Safari, więc zamówisz, prześledzisz i pobierzesz książkę stamtąd.",
          },
          {
            q: "Jakiej wersji Androida potrzebuję?",
            a: "Androida 7.0 (Nougat) albo nowszego.",
          },
          {
            q: "Co się stanie, jeśli zamknę aplikację w trakcie pisania książki?",
            a: "Nic się nie zatrzyma. Cały proces dzieje się na naszych serwerach, więc możesz zamknąć aplikację, stracić zasięg albo zrestartować telefon: książka powstaje dalej i czeka, gdy wrócisz.",
          },
        ],
      },
      final: {
        title: "Zainstaluj i zacznij pierwszą książkę",
        sub: "Instalacja za darmo. Jedna płatność za książkę, wtedy gdy zdecydujesz się ją zrobić.",
      },
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
  de,
} as const;

/**
 * German exists only for a subset of pages (v1: landing + legal pages).
 * Key: English path, value: its German counterpart. `deAlternates` drives the
 * hreflang="de" link and the "DE" switch in the header; `deToEnPaths` tells the
 * "EN" switch on a German page where to go (fallback: the English landing).
 */
export const deAlternates: Record<string, string> = {
  "/": "/de/",
};
export const deToEnPaths: Record<string, string> = {
  "/de/": "/",
  "/de/agb/": "/terms/",
  "/de/datenschutz/": "/privacy/",
};

export function useTranslations(lang: Lang) {
  return ui[lang];
}
