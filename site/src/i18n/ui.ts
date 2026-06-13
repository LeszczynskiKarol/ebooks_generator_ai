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
      bullets: ["Print-quality PDF + EPUB", "Web research with cited sources", "One fixed price per book"],
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
    gallery: {
      title: "What your finished pages look like",
      sub: "Clickable contents, drop-cap chapter openings, styled tables and matched illustrations — the typesetting every InkMagnet book ships with.",
      items: [
        { caption: "Clickable table of contents", alt: "Table of contents page layout" },
        { caption: "Chapter openings with drop caps", alt: "Chapter opening page layout with drop cap" },
        { caption: "Styled tables and insight boxes", alt: "Book page layout with a data table and a definition box" },
        { caption: "AI illustrations with captions", alt: "Book page layout with an illustration and figure caption" },
      ],
      note: "Every book is typeset to this standard and exported to PDF and EPUB.",
    },
    appShowcase: {
      title: "One panel for every book you make",
      sub: "Covers, generation progress and downloads — your whole library in one place.",
      alt: "The InkMagnet dashboard",
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
      ],
    },
    pricing: {
      title: "One price per book. Nothing recurring.",
      sub: "Pay only when you create a book. Research, writing, illustrations, cover, PDF and EPUB — everything is included.",
      perBook: "per book",
      pages: "pages",
      tiers: [
        { label: "Compact", pages: "30–45", price: "$9.99" },
        { label: "Standard", pages: "46–75", price: "$12.99" },
        { label: "Extended", pages: "76–115", price: "$14.99" },
        { label: "Comprehensive", pages: "116–160", price: "$17.99" },
        { label: "Complete", pages: "161–200", price: "$19.99" },
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
      ],
    },
    finalCta: {
      title: "Your book is one form away",
      sub: "Describe the topic today, download the finished ebook within the hour.",
      cta: "Start writing — from $9.99",
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
      badge: "Generator ebooków AI",
      title1: "Generator ebooków AI, który zamienia temat w",
      titleAccent: "profesjonalną książkę",
      title2: "w około godzinę",
      sub: "InkMagnet to generator ebooków AI: opisz temat, a on zbada go w internecie, napisze każdy rozdział z weryfikowalnymi źródłami, zaprojektuje okładkę i odda PDF w jakości drukarskiej oraz EPUB. To nie wypełniacz szablonu ani eksport z worda — prawdziwa, złożona książka.",
      ctaPrimary: "Zacznij swoją książkę",
      ctaSecondary: "Zobacz, jak to działa",
      bullets: ["PDF + EPUB w jakości wydawniczej", "Research w sieci z cytowanymi źródłami", "Jedna stała cena za książkę"],
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
    gallery: {
      title: "Tak wyglądają Twoje gotowe strony",
      sub: "Klikalny spis treści, otwarcia rozdziałów z inicjałem, tabele i dopasowane ilustracje — skład, z którym wychodzi każda książka z InkMagnet.",
      items: [
        { caption: "Klikalny spis treści", alt: "Układ strony spisu treści" },
        { caption: "Otwarcia rozdziałów z inicjałami", alt: "Układ strony otwarcia rozdziału z inicjałem" },
        { caption: "Tabele i ramki z definicjami", alt: "Układ strony z tabelą danych i ramką definicji" },
        { caption: "Ilustracje AI z podpisami", alt: "Układ strony z ilustracją i podpisem rysunku" },
      ],
      note: "Każda książka jest składana w tym standardzie i eksportowana do PDF i EPUB.",
    },
    appShowcase: {
      title: "Jeden panel na wszystkie Twoje książki",
      sub: "Okładki, postęp generowania i pobrania — cała biblioteka w jednym miejscu.",
      alt: "Panel InkMagnet",
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
      ],
    },
    pricing: {
      title: "Jedna cena za książkę. Żadnych abonamentów.",
      sub: "Płacisz tylko wtedy, gdy tworzysz książkę. Research, pisanie, ilustracje, okładka, PDF i EPUB — wszystko w cenie.",
      perBook: "za książkę",
      pages: "stron",
      tiers: [
        { label: "Compact", pages: "30–45", price: "$9.99" },
        { label: "Standard", pages: "46–75", price: "$12.99" },
        { label: "Extended", pages: "76–115", price: "$14.99" },
        { label: "Comprehensive", pages: "116–160", price: "$17.99" },
        { label: "Complete", pages: "161–200", price: "$19.99" },
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
      ],
    },
    finalCta: {
      title: "Od Twojej książki dzieli Cię jeden formularz",
      sub: "Opisz temat dzisiaj, a gotowego ebooka pobierzesz w ciągu godziny.",
      cta: "Zacznij pisać — od $9.99",
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
