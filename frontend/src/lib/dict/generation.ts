// i18n strings for: generation  (keys prefixed "generation.")
export const en: Record<string, string> = {
  // Header
  "generation.title": "Generating Your Book",
  "generation.remaining": "~{n}m remaining",
  "generation.badge.done": "Done",
  "generation.badge.inProgress": "In Progress",

  // Footer stats
  "generation.footer.pagesTarget": "{n} pages target",
  "generation.footer.chapters": "{n} chapters",
  "generation.footer.written": "{done}/{total} written",

  // Writing detail
  "generation.writing.initializing": "Initializing chapter records...",
  "generation.writing.chapterDetail":
    "Writing with research sources • LaTeX formatting • Tables & insight boxes",
  "generation.writing.statsChapters": "{done}/{total} chapters",

  // Research detail footer line
  "generation.research.searchingLine":
    "Searching in {lang} + English supplement • {n} targeted queries planned",
  "generation.lang.polish": "Polish",
  "generation.lang.english": "English",

  // Research steps
  "generation.research.0.label": "Searching web sources for the book topic",
  "generation.research.0.detail": "Google Custom Search API",
  "generation.research.1.label": "Scraping and extracting content from sources",
  "generation.research.1.detail": "Analyzing page content",
  "generation.research.2.label": "AI selecting highest-quality sources",
  "generation.research.2.detail": "Claude evaluates relevance & data density",
  "generation.research.3.label": "Per-chapter targeted research queries",
  "generation.research.3.detail": "2 specialized queries per chapter",
  "generation.research.4.label": "Building chapter research briefs",
  "generation.research.4.detail": "Merging global + chapter-specific sources",

  // Review steps
  "generation.review.0.label": "Reviewing book completeness & quality",
  "generation.review.0.detail": "AI editor evaluating coverage, redundancy, depth",
  "generation.review.1.label": "Removing redundant content",
  "generation.review.1.detail": "Trimming repeated sections across chapters",
  "generation.review.2.label": "Adding missing topics",
  "generation.review.2.detail": "Writing new subsections for uncovered areas",
  "generation.review.3.label": "Post-revision quality check",
  "generation.review.3.detail": "Verifying improvement score",

  // Compile PDF steps
  "generation.compilePdf.0.label": "Assembling LaTeX document",
  "generation.compilePdf.0.detail": "Merging chapter content + preamble",
  "generation.compilePdf.1.label": "Running pdflatex (pass 1/2)",
  "generation.compilePdf.1.detail": "Building cross-references",
  "generation.compilePdf.2.label": "Running pdflatex (pass 2/2)",
  "generation.compilePdf.2.detail": "Resolving references",
  "generation.compilePdf.3.label": "Uploading PDF to cloud",
  "generation.compilePdf.3.detail": "S3 versioned storage",

  // Compile EPUB steps
  "generation.compileEpub.0.label": "Converting chapters to XHTML",
  "generation.compileEpub.0.detail": "Semantic HTML structure",
  "generation.compileEpub.1.label": "Packaging EPUB container",
  "generation.compileEpub.1.detail": "OPF + NCX + mimetype",
  "generation.compileEpub.2.label": "Uploading EPUB",
  "generation.compileEpub.2.detail": "S3 cloud storage",

  // Phase meta
  "generation.phase.research.label": "Research & Source Analysis",
  "generation.phase.research.description":
    "Web search, source scraping, AI-powered source selection — building the knowledge base for your book",
  "generation.phase.writing.label": "Content Generation",
  "generation.phase.writing.description":
    "AI writing each chapter with expert voice, rich LaTeX formatting, tables, and colored insight boxes",
  "generation.phase.reviewing.label": "Review & Revision",
  "generation.phase.reviewing.description":
    "AI editor reviewing completeness, removing redundancy, and adding missing topics to improve quality",
  "generation.phase.compiling_pdf.label": "PDF Compilation",
  "generation.phase.compiling_pdf.description":
    "Assembling LaTeX, running pdflatex with auto-fix, generating print-ready PDF",
  "generation.phase.compiling_epub.label": "EPUB Generation",
  "generation.phase.compiling_epub.description":
    "Converting to XHTML, packaging for Kindle/Apple Books/Kobo",
  "generation.phase.finalizing.label": "Publishing",
  "generation.phase.finalizing.description":
    "Uploading files and finalizing version",
  "generation.phase.done.label": "Complete",
  "generation.phase.done.description": "Your book is ready!",

  // StructureProgress
  "generation.structure.title": "Payment confirmed — building your book plan",
  "generation.structure.subtitle":
    "This usually takes 1–2 minutes. You can safely leave this page — we'll keep working.",
  "generation.structure.0.label": "Researching the web",
  "generation.structure.0.desc":
    "Searching and reading the best sources on your topic",
  "generation.structure.1.label": "Designing chapter structure",
  "generation.structure.1.desc":
    "AI drafts chapters and sections grounded in the research",
  "generation.structure.2.label": "Ready for your review",
  "generation.structure.2.desc":
    "You'll approve or tweak the structure before writing starts",
};

export const pl: Record<string, string> = {
  // Header
  "generation.title": "Tworzymy Twoją książkę",
  "generation.remaining": "~{n} min pozostało",
  "generation.badge.done": "Gotowe",
  "generation.badge.inProgress": "W toku",

  // Footer stats
  "generation.footer.pagesTarget": "docelowo stron: {n}",
  "generation.footer.chapters": "rozdziałów: {n}",
  "generation.footer.written": "napisano {done}/{total}",

  // Writing detail
  "generation.writing.initializing": "Inicjowanie rekordów rozdziałów...",
  "generation.writing.chapterDetail":
    "Pisanie w oparciu o źródła • formatowanie LaTeX • tabele i ramki z wnioskami",
  "generation.writing.statsChapters": "{done}/{total} rozdziałów",

  // Research detail footer line
  "generation.research.searchingLine":
    "Szukamy w języku: {lang} + uzupełnienie po angielsku • zaplanowanych zapytań: {n}",
  "generation.lang.polish": "polskim",
  "generation.lang.english": "angielskim",

  // Research steps
  "generation.research.0.label": "Wyszukiwanie źródeł internetowych na temat książki",
  "generation.research.0.detail": "Google Custom Search API",
  "generation.research.1.label": "Pobieranie i wyodrębnianie treści ze źródeł",
  "generation.research.1.detail": "Analiza zawartości stron",
  "generation.research.2.label": "AI wybiera źródła najwyższej jakości",
  "generation.research.2.detail":
    "Claude ocenia trafność i gęstość danych",
  "generation.research.3.label": "Ukierunkowane zapytania badawcze dla każdego rozdziału",
  "generation.research.3.detail": "2 wyspecjalizowane zapytania na rozdział",
  "generation.research.4.label": "Tworzenie briefów badawczych rozdziałów",
  "generation.research.4.detail":
    "Łączenie źródeł globalnych i właściwych dla rozdziału",

  // Review steps
  "generation.review.0.label": "Przegląd kompletności i jakości książki",
  "generation.review.0.detail":
    "Redaktor AI ocenia pokrycie tematu, powtórzenia i głębię",
  "generation.review.1.label": "Usuwanie zbędnych treści",
  "generation.review.1.detail": "Przycinanie powtórzeń między rozdziałami",
  "generation.review.2.label": "Dodawanie brakujących zagadnień",
  "generation.review.2.detail":
    "Pisanie nowych podrozdziałów dla nieuwzględnionych obszarów",
  "generation.review.3.label": "Kontrola jakości po korekcie",
  "generation.review.3.detail": "Weryfikacja oceny poprawy",

  // Compile PDF steps
  "generation.compilePdf.0.label": "Składanie dokumentu LaTeX",
  "generation.compilePdf.0.detail": "Łączenie treści rozdziałów z preambułą",
  "generation.compilePdf.1.label": "Uruchamianie pdflatex (przebieg 1/2)",
  "generation.compilePdf.1.detail": "Budowanie odsyłaczy",
  "generation.compilePdf.2.label": "Uruchamianie pdflatex (przebieg 2/2)",
  "generation.compilePdf.2.detail": "Rozwiązywanie odsyłaczy",
  "generation.compilePdf.3.label": "Wysyłanie PDF do chmury",
  "generation.compilePdf.3.detail": "Wersjonowany magazyn S3",

  // Compile EPUB steps
  "generation.compileEpub.0.label": "Konwersja rozdziałów do XHTML",
  "generation.compileEpub.0.detail": "Semantyczna struktura HTML",
  "generation.compileEpub.1.label": "Pakowanie kontenera EPUB",
  "generation.compileEpub.1.detail": "OPF + NCX + mimetype",
  "generation.compileEpub.2.label": "Wysyłanie EPUB",
  "generation.compileEpub.2.detail": "Magazyn w chmurze S3",

  // Phase meta
  "generation.phase.research.label": "Badania i analiza źródeł",
  "generation.phase.research.description":
    "Wyszukiwanie w sieci, pobieranie źródeł, dobór źródeł przez AI — budujemy bazę wiedzy dla Twojej książki",
  "generation.phase.writing.label": "Generowanie treści",
  "generation.phase.writing.description":
    "AI pisze każdy rozdział eksperckim głosem, z bogatym formatowaniem LaTeX, tabelami i kolorowymi ramkami z wnioskami",
  "generation.phase.reviewing.label": "Przegląd i korekta",
  "generation.phase.reviewing.description":
    "Redaktor AI sprawdza kompletność, usuwa powtórzenia i dodaje brakujące zagadnienia, by podnieść jakość",
  "generation.phase.compiling_pdf.label": "Składanie PDF",
  "generation.phase.compiling_pdf.description":
    "Składanie LaTeX, uruchamianie pdflatex z automatyczną korektą, generowanie PDF gotowego do druku",
  "generation.phase.compiling_epub.label": "Generowanie EPUB",
  "generation.phase.compiling_epub.description":
    "Konwersja do XHTML, pakowanie dla Kindle/Apple Books/Kobo",
  "generation.phase.finalizing.label": "Publikowanie",
  "generation.phase.finalizing.description":
    "Wysyłanie plików i finalizowanie wersji",
  "generation.phase.done.label": "Gotowe",
  "generation.phase.done.description": "Twoja książka jest gotowa!",

  // StructureProgress
  "generation.structure.title": "Płatność potwierdzona — tworzymy plan Twojej książki",
  "generation.structure.subtitle":
    "Zwykle trwa to 1–2 minuty. Możesz spokojnie opuścić tę stronę — pracujemy dalej.",
  "generation.structure.0.label": "Przeszukiwanie sieci",
  "generation.structure.0.desc":
    "Wyszukiwanie i czytanie najlepszych źródeł na Twój temat",
  "generation.structure.1.label": "Projektowanie struktury rozdziałów",
  "generation.structure.1.desc":
    "AI szkicuje rozdziały i sekcje w oparciu o badania",
  "generation.structure.2.label": "Gotowe do Twojego przeglądu",
  "generation.structure.2.desc":
    "Zatwierdzisz lub zmienisz strukturę, zanim rozpocznie się pisanie",
};
