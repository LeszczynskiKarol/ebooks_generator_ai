// i18n strings for: newProject  (keys prefixed "newProject.")
export const en: Record<string, string> = {
  // Page header
  "newProject.title": "Create New Book",
  "newProject.subtitle": "Tell us about your eBook. Edit everything later.",

  // Section: Book Details
  "newProject.bookDetails": "Book Details",
  "newProject.bookTitleHelp":
    "Leave empty — we'll suggest one based on your topic",
  "newProject.materialsButton": "Attach files",
  "newProject.materialsHint":
    "or drop them here — guidelines, examples, sources, inspirations",
  "newProject.materialsFormats":
    "PDF, Word (DOC/DOCX), OpenDocument (ODT/ODP), RTF, TXT, Markdown, PowerPoint · up to {mb} MB each, max {n} files. The AI reads their text and follows them while writing.",
  "newProject.materialsChars": "{n} chars",
  "newProject.materialsTruncated": "long file — first part used",
  "newProject.materialsReading": "Reading file…",
  "newProject.materialsRemove": "Remove file",
  "newProject.materialsErrType": "unsupported file type",
  "newProject.materialsErrSize": "file larger than {mb} MB",
  "newProject.materialsErrEmpty":
    "no text found (a scanned PDF? paste the key parts into the guidelines instead)",
  "newProject.materialsErrCount": "You can attach up to {n} files",
  "newProject.materialsErrGeneric": "upload failed — try again",

  // Section: Book Size
  "newProject.bookSize": "Book Size",
  "newProject.popular": "Popular",
  "newProject.tierLabel.compact": "Compact",
  "newProject.tierLabel.standard": "Standard",
  "newProject.tierLabel.extended": "Extended",
  "newProject.tierLabel.comprehensive": "Comprehensive",
  "newProject.tierLabel.complete": "Complete",
  "newProject.tierDesc.compact": "30–40 pages",
  "newProject.tierDesc.standard": "50–70 pages",
  "newProject.tierDesc.extended": "80–100 pages",
  "newProject.tierDesc.comprehensive": "130–150 pages",
  "newProject.tierDesc.complete": "170–200 pages",

  // Section: Color Scheme
  "newProject.colorScheme": "Color Scheme",
  "newProject.colorSchemeDesc":
    "Pick 1–3 accent colours for headings, boxes and tables. Leave empty and we\'ll pick colours that suit your topic.",
  "newProject.rolePrimary": "Primary",
  "newProject.roleSecondary": "Secondary",
  "newProject.roleTertiary": "Tertiary",
  "newProject.chooseColors": "Choose colors",
  "newProject.colorsSelected": "{s}/3 selected",
  "newProject.addCustomColor": "Add custom color",
  "newProject.add": "Add",
  "newProject.cancel": "Cancel",
  "newProject.howColorsUsed": "How your colors will be used:",
  "newProject.oneColorNote":
    "With 1 color, complementary shades are generated automatically.",
  "newProject.colorRolePrimary": "Primary — chapter headings, main accents",
  "newProject.colorRoleSecondary": "Secondary — boxes, highlights, tips",
  "newProject.colorRoleTertiary":
    "Tertiary — details, borders, subtle elements",

  // Color names
  "newProject.colorWhite": "White",
  "newProject.colorBlack": "Black",
  "newProject.colorRoyalBlue": "Royal Blue",
  "newProject.colorBlue": "Blue",
  "newProject.colorSkyBlue": "Sky Blue",
  "newProject.colorCyan": "Cyan",
  "newProject.colorViolet": "Violet",
  "newProject.colorPurple": "Purple",
  "newProject.colorLavender": "Lavender",
  "newProject.colorPink": "Pink",
  "newProject.colorEmerald": "Emerald",
  "newProject.colorGreen": "Green",
  "newProject.colorLime": "Lime",
  "newProject.colorTeal": "Teal",
  "newProject.colorRed": "Red",
  "newProject.colorOrange": "Orange",
  "newProject.colorAmber": "Amber",
  "newProject.colorGold": "Gold",
  "newProject.colorSlate": "Slate",
  "newProject.colorGray": "Gray",
  "newProject.colorBrown": "Brown",
  "newProject.colorRose": "Rose",

  // Section: Book Cover
  "newProject.bookCover": "Book Cover",
  "newProject.bookCoverDesc":
    "Choose how to handle your book cover. You can always change this later.",
  "newProject.coverGenerateLabel": "Generate cover",
  "newProject.coverGenerateDesc":
    "AI-designed professional cover based on your book details",
  "newProject.coverUploadLabel": "Upload own cover",
  "newProject.coverUploadDesc": "Provide your own image in {s} format",
  "newProject.coverNoneLabel": "No cover",
  "newProject.coverNoneDesc":
    "Start without a cover — add one later in the editor",
  "newProject.aiIllustrations": "AI illustrations inside the book",
  "newProject.included": "Included",
  "newProject.aiIllustrationsDesc":
    "AI-generated images matched to the content and your visual style. No extra cost. After generation you can also add your own photos anywhere in the book editor.",
  "newProject.howManyIllustrations": "How many illustrations?",
  "newProject.densityStandardLabel": "Standard",
  "newProject.densityStandardDesc": "~1 image per 5 pages",
  "newProject.densityRichLabel": "Rich",
  "newProject.densityRichDesc":
    "~1 image per 3 pages — great for cooking, crafts, travel",
  "newProject.imagePrefsLabel": "Image preferences (optional)",
  "newProject.imagePrefsPlaceholder":
    "e.g., prefer photos of real workplaces, warm tones, no close-up faces...",
  "newProject.imagePrefsHelp":
    "Lightly steer the AI images — mood, color, subjects to prefer or avoid.",

  // Section: Settings
  "newProject.settings": "Settings",
  "newProject.languageLabel": "Book language",
  "newProject.pageFormatLabel": "Page Format",
  "newProject.visualStyleLabel": "Book Style",
  "newProject.visualStyleHelp":
    "Shapes both the design (fonts, colors) and the writing voice — fine-tuned to your topic and guidelines.",
  "newProject.footnotesLabel": "Footnotes & sources",
  "newProject.footnoteAutoLabel": "Auto",
  "newProject.footnoteAutoDesc":
    "Follows the style — Academic gets footnotes, others stay clean",
  "newProject.footnoteAlwaysLabel": "With footnotes",
  "newProject.footnoteAlwaysDesc": "Full source apparatus in every chapter",
  "newProject.footnoteNeverLabel": "No footnotes",
  "newProject.footnoteNeverDesc":
    "Popular style — sources woven into the text",

  // Languages
  "newProject.langEn": "English",
  "newProject.langPl": "Polish",
  "newProject.langDe": "German",
  "newProject.langEs": "Spanish",
  "newProject.langFr": "French",
  "newProject.langIt": "Italian",
  "newProject.langPt": "Portuguese",
  "newProject.langNl": "Dutch",

  // Styles
  "newProject.styleAuto": "Automatic — we pick the style and colours that suit your topic",
  "newProject.styleAutoSummary": "style matched to the topic",
  "newProject.styleModern": "Modern — clean design, direct contemporary writing",
  "newProject.styleAcademic": "Academic — scholarly layout, precise formal prose",
  "newProject.styleMinimal": "Minimal — elegant simplicity, spare calm prose",
  "newProject.styleCreative": "Creative — bold design, narrative storytelling voice",
  "newProject.styleBusiness": "Business — professional look, results-driven writing",

  // Style names (for order summary)
  "newProject.styleNameModern": "Modern",
  "newProject.styleNameAcademic": "Academic",
  "newProject.styleNameMinimal": "Minimal",
  "newProject.styleNameCreative": "Creative",
  "newProject.styleNameBusiness": "Business",

  // Formats
  "newProject.formatA5": "A5 (148×210mm) — Standard",
  "newProject.formatB5": "B5 (176×250mm) — Larger",
  "newProject.formatLetter": "Letter (216×279mm) — US",
  "newProject.formatA4": "A4 (210×297mm) — Full",
  "newProject.formatDescStandard": "Standard",
  "newProject.formatDescLarger": "Larger",
  "newProject.formatDescUs": "US",
  "newProject.formatDescFull": "Full",

  // Order summary
  "newProject.pages": "{s} pages",
  "newProject.styleSuffix": "style",
  "newProject.summaryAiCover": "AI cover",
  "newProject.summaryOwnCover": "Own cover",
  "newProject.summaryNoCover": "No cover",
  "newProject.summaryAiIllustrations": "AI illustrations",

  // Submit
  "newProject.continueToPayment": "Continue to Payment — {s}",
  "newProject.continueToPreview": "See my book's table of contents — free",
  "newProject.previewHint": "Free, no card needed. You pay only if you like the plan.",
  "newProject.descriptionLabel": "Describe your book",
  "newProject.descriptionPlaceholder": "e.g. A practical 30-day program for beginners who sit at a desk all day: short daily exercises for the back, hips and neck, desk ergonomics and micro-breaks. Friendly tone, no jargon, with a tracker at the end.",
  "newProject.descriptionHelp": "What it's about, who it's for and what must be inside — as much or as little as you like. A sentence is enough; a detailed brief is better.",
  "newProject.titleOptionalLabel": "Title (optional)",
  "newProject.lookTitle": "Look & settings",
  "newProject.lookHint": "Style, format, colours, cover, illustrations, footnotes — the defaults are good and you can change them later.",
  "newProject.lookChange": "Change",
  "newProject.previewBadge": "Free preview of your book",
  "newProject.previewPay": "I like it — pay {s} and write my book",
  "newProject.previewAssurance": "Before writing starts you review the full outline and can change it (plus one free re-plan). If generation fails for technical reasons, we refund you.",
  "newProject.previewEdit": "Change the description",
  "newProject.previewEditHint": "This is your book's plan. Click any title or description to change it, add or remove chapters and sections, set pages — or ask the AI for a new version with your notes. After payment we research the topic and expand exactly this plan.",
  "newProject.previewRedo": "New version from AI with your notes (one time)",
  "newProject.previewRejectedTitle": "We couldn't plan a book from this description",
  "newProject.previewLoadingTitle": "Planning your book…",
  "newProject.previewLoadingText": "Title, chapters and what each one covers. Usually 20–40 seconds.",
  "newProject.previewLimit": "You've used today's free previews. You can still order the book — after payment you'll see and edit the full outline before writing starts.",
  "newProject.previewFailed": "The preview didn't load this time. You can try again or order straight away — after payment you'll see and edit the full outline before writing starts.",

  // Toasts
  "newProject.draftRestored": "Draft restored",
  "newProject.pendingOrderTitle": "You have an order waiting for payment",
  "newProject.pendingOrderBody": "“{s}” — your description and settings are saved.",
  "newProject.pendingOrderCta": "Complete order",
  "newProject.maxColors": "Maximum 3 colors",
  "newProject.invalidHex": "Enter a valid hex color (e.g. #FF5500)",
  "newProject.colorAlreadySelected": "Color already selected",
  "newProject.projectCreated": "Project created!",
  "newProject.failed": "Failed",

  // Validation
  "newProject.titleTypoHint": "The topic spells this differently — did you mean:",
  "newProject.errMinChars": "Min 5 chars",
  "newProject.errTitleOrTopic": "Describe the book or give its title",
};

export const pl: Record<string, string> = {
  // Page header
  "newProject.title": "Utwórz nową książkę",
  "newProject.subtitle":
    "Opowiedz nam o swoim ebooku. Wszystko możesz później edytować.",

  // Section: Book Details
  "newProject.bookDetails": "Szczegóły książki",
  "newProject.bookTitleHelp":
    "Zostaw puste — zaproponujemy tytuł na podstawie tematu",
  "newProject.materialsButton": "Dołącz pliki",
  "newProject.materialsHint":
    "lub przeciągnij je tutaj — wskazówki, przykłady, źródła, inspiracje",
  "newProject.materialsFormats":
    "PDF, Word (DOC/DOCX), OpenDocument (ODT/ODP), RTF, TXT, Markdown, PowerPoint · do {mb} MB każdy, maks. {n} plików. AI czyta ich treść i trzyma się jej podczas pisania.",
  "newProject.materialsChars": "{n} znaków",
  "newProject.materialsTruncated": "długi plik — użyta pierwsza część",
  "newProject.materialsReading": "Czytam plik…",
  "newProject.materialsRemove": "Usuń plik",
  "newProject.materialsErrType": "nieobsługiwany typ pliku",
  "newProject.materialsErrSize": "plik większy niż {mb} MB",
  "newProject.materialsErrEmpty":
    "nie znaleziono tekstu (skan PDF? wklej najważniejsze fragmenty do wytycznych)",
  "newProject.materialsErrCount": "Możesz dołączyć maksymalnie {n} plików",
  "newProject.materialsErrGeneric": "nie udało się wgrać — spróbuj ponownie",

  // Section: Book Size
  "newProject.bookSize": "Rozmiar książki",
  "newProject.popular": "Popularne",
  "newProject.tierLabel.compact": "Kompaktowa",
  "newProject.tierLabel.standard": "Standardowa",
  "newProject.tierLabel.extended": "Rozszerzona",
  "newProject.tierLabel.comprehensive": "Obszerna",
  "newProject.tierLabel.complete": "Kompletna",
  "newProject.tierDesc.compact": "30–40 stron",
  "newProject.tierDesc.standard": "50–70 stron",
  "newProject.tierDesc.extended": "80–100 stron",
  "newProject.tierDesc.comprehensive": "130–150 stron",
  "newProject.tierDesc.complete": "170–200 stron",

  // Section: Color Scheme
  "newProject.colorScheme": "Kolorystyka",
  "newProject.colorSchemeDesc":
    "Wybierz 1–3 kolory akcentu dla nagłówków, ramek i tabel. Zostaw puste — dobierzemy kolory pasujące do tematu.",
  "newProject.rolePrimary": "Podstawowy",
  "newProject.roleSecondary": "Drugorzędny",
  "newProject.roleTertiary": "Trzeciorzędny",
  "newProject.chooseColors": "Wybierz kolory",
  "newProject.colorsSelected": "wybrano {s}/3",
  "newProject.addCustomColor": "Dodaj własny kolor",
  "newProject.add": "Dodaj",
  "newProject.cancel": "Anuluj",
  "newProject.howColorsUsed": "Jak zostaną użyte Twoje kolory:",
  "newProject.oneColorNote":
    "Przy 1 kolorze odcienie komplementarne generowane są automatycznie.",
  "newProject.colorRolePrimary":
    "Podstawowy — nagłówki rozdziałów, główne akcenty",
  "newProject.colorRoleSecondary":
    "Drugorzędny — ramki, wyróżnienia, wskazówki",
  "newProject.colorRoleTertiary":
    "Trzeciorzędny — detale, obramowania, subtelne elementy",

  // Color names
  "newProject.colorWhite": "Biały",
  "newProject.colorBlack": "Czarny",
  "newProject.colorRoyalBlue": "Królewski błękit",
  "newProject.colorBlue": "Niebieski",
  "newProject.colorSkyBlue": "Błękitny",
  "newProject.colorCyan": "Cyjan",
  "newProject.colorViolet": "Fioletowy",
  "newProject.colorPurple": "Purpurowy",
  "newProject.colorLavender": "Lawendowy",
  "newProject.colorPink": "Różowy",
  "newProject.colorEmerald": "Szmaragdowy",
  "newProject.colorGreen": "Zielony",
  "newProject.colorLime": "Limonkowy",
  "newProject.colorTeal": "Morski",
  "newProject.colorRed": "Czerwony",
  "newProject.colorOrange": "Pomarańczowy",
  "newProject.colorAmber": "Bursztynowy",
  "newProject.colorGold": "Złoty",
  "newProject.colorSlate": "Grafitowy",
  "newProject.colorGray": "Szary",
  "newProject.colorBrown": "Brązowy",
  "newProject.colorRose": "Wrzosowy",

  // Section: Book Cover
  "newProject.bookCover": "Okładka książki",
  "newProject.bookCoverDesc":
    "Wybierz, jak chcesz obsłużyć okładkę. Zawsze możesz to później zmienić.",
  "newProject.coverGenerateLabel": "Wygeneruj okładkę",
  "newProject.coverGenerateDesc":
    "Profesjonalna okładka zaprojektowana przez AI na podstawie szczegółów książki",
  "newProject.coverUploadLabel": "Prześlij własną okładkę",
  "newProject.coverUploadDesc": "Dodaj własny obraz w formacie {s}",
  "newProject.coverNoneLabel": "Bez okładki",
  "newProject.coverNoneDesc":
    "Zacznij bez okładki — dodasz ją później w edytorze",
  "newProject.aiIllustrations": "Ilustracje AI wewnątrz książki",
  "newProject.included": "W cenie",
  "newProject.aiIllustrationsDesc":
    "Obrazy generowane przez AI dopasowane do treści i Twojego stylu wizualnego. Bez dodatkowych kosztów. Po wygenerowaniu możesz też w edytorze dodać własne zdjęcia w dowolnym miejscu książki.",
  "newProject.howManyIllustrations": "Ile ilustracji?",
  "newProject.densityStandardLabel": "Standardowo",
  "newProject.densityStandardDesc": "~1 obraz na 5 stron",
  "newProject.densityRichLabel": "Bogato",
  "newProject.densityRichDesc":
    "~1 obraz na 3 strony — świetne do gotowania, rękodzieła, podróży",
  "newProject.imagePrefsLabel": "Preferencje obrazów (opcjonalnie)",
  "newProject.imagePrefsPlaceholder":
    "np. preferuj zdjęcia prawdziwych miejsc pracy, ciepłe tony, bez zbliżeń twarzy...",
  "newProject.imagePrefsHelp":
    "Delikatnie ukierunkuj obrazy AI — nastrój, kolor, tematy do preferowania lub unikania.",

  // Section: Settings
  "newProject.settings": "Ustawienia",
  "newProject.languageLabel": "Język książki",
  "newProject.pageFormatLabel": "Format strony",
  "newProject.visualStyleLabel": "Styl książki",
  "newProject.visualStyleHelp":
    "Wpływa na wygląd (fonty, kolory) oraz sposób pisania — dostrajany do tematu i Twoich wytycznych.",
  "newProject.footnotesLabel": "Przypisy i źródła",
  "newProject.footnoteAutoLabel": "Automatycznie",
  "newProject.footnoteAutoDesc":
    "Zgodnie ze stylem — Akademicki dostaje przypisy, pozostałe pozostają czyste",
  "newProject.footnoteAlwaysLabel": "Z przypisami",
  "newProject.footnoteAlwaysDesc":
    "Pełen aparat źródłowy w każdym rozdziale",
  "newProject.footnoteNeverLabel": "Bez przypisów",
  "newProject.footnoteNeverDesc":
    "Styl popularny — źródła wplecione w tekst",

  // Languages
  "newProject.langEn": "Angielski",
  "newProject.langPl": "Polski",
  "newProject.langDe": "Niemiecki",
  "newProject.langEs": "Hiszpański",
  "newProject.langFr": "Francuski",
  "newProject.langIt": "Włoski",
  "newProject.langPt": "Portugalski",
  "newProject.langNl": "Holenderski",

  // Styles
  "newProject.styleAuto": "Automatycznie — dobierzemy styl i kolory do tematu",
  "newProject.styleAutoSummary": "styl dobrany do tematu",
  "newProject.styleModern": "Nowoczesny — czysty design, bezpośredni współczesny język",
  "newProject.styleAcademic": "Akademicki — naukowy skład, precyzyjna formalna proza",
  "newProject.styleMinimal": "Minimalistyczny — elegancka prostota, oszczędny spokojny styl",
  "newProject.styleCreative": "Kreatywny — śmiały design, narracyjny język opowieści",
  "newProject.styleBusiness": "Biznesowy — profesjonalny wygląd, konkretny styl nastawiony na rezultaty",

  // Style names (for order summary)
  "newProject.styleNameModern": "Nowoczesny",
  "newProject.styleNameAcademic": "Akademicki",
  "newProject.styleNameMinimal": "Minimalistyczny",
  "newProject.styleNameCreative": "Kreatywny",
  "newProject.styleNameBusiness": "Biznesowy",

  // Formats
  "newProject.formatA5": "A5 (148×210mm) — Standard",
  "newProject.formatB5": "B5 (176×250mm) — Większy",
  "newProject.formatLetter": "Letter (216×279mm) — US",
  "newProject.formatA4": "A4 (210×297mm) — Pełny",
  "newProject.formatDescStandard": "Standard",
  "newProject.formatDescLarger": "Większy",
  "newProject.formatDescUs": "US",
  "newProject.formatDescFull": "Pełny",

  // Order summary
  "newProject.pages": "{s} stron",
  "newProject.styleSuffix": "styl",
  "newProject.summaryAiCover": "okładka AI",
  "newProject.summaryOwnCover": "własna okładka",
  "newProject.summaryNoCover": "bez okładki",
  "newProject.summaryAiIllustrations": "ilustracje AI",

  // Submit
  "newProject.continueToPayment": "Przejdź do płatności — {s}",
  "newProject.continueToPreview": "Zobacz spis treści mojej książki — za darmo",
  "newProject.previewHint": "Za darmo, bez karty. Płacisz dopiero, gdy plan Ci się spodoba.",
  "newProject.descriptionLabel": "Opisz swoją książkę",
  "newProject.descriptionPlaceholder": "np. Praktyczny 30-dniowy program dla początkujących, którzy cały dzień siedzą przy biurku: krótkie codzienne ćwiczenia na plecy, biodra i szyję, ergonomia stanowiska i mikroprzerwy. Przystępny język, bez żargonu, na końcu tracker postępów.",
  "newProject.descriptionHelp": "O czym ma być, dla kogo i co koniecznie ma się w niej znaleźć — tyle, ile chcesz. Wystarczy jedno zdanie, a szczegółowy opis da lepszą książkę.",
  "newProject.titleOptionalLabel": "Tytuł (opcjonalnie)",
  "newProject.lookTitle": "Wygląd i ustawienia",
  "newProject.lookHint": "Styl, format, kolory, okładka, ilustracje, przypisy — domyślne są dobre, a zmienisz je także później.",
  "newProject.lookChange": "Zmień",
  "newProject.previewBadge": "Darmowy podgląd Twojej książki",
  "newProject.previewPay": "Podoba mi się — płacę {s} i piszemy",
  "newProject.previewAssurance": "Zanim zaczniemy pisać, zobaczysz pełny konspekt i możesz go zmienić (plus jedno darmowe ponowne planowanie). Jeśli generowanie nie powiedzie się z przyczyn technicznych, zwracamy pieniądze.",
  "newProject.previewEdit": "Zmień opis",
  "newProject.previewEditHint": "To plan Twojej książki. Kliknij dowolny tytuł lub opis, żeby go zmienić, dodawaj i usuwaj rozdziały i podrozdziały, ustawiaj strony — albo poproś AI o nową wersję z Twoimi uwagami. Po płatności robimy research i rozwijamy dokładnie ten plan.",
  "newProject.previewRedo": "Nowa wersja od AI z Twoimi uwagami (jednorazowo)",
  "newProject.previewRejectedTitle": "Z tego opisu nie da się zaplanować książki",
  "newProject.previewLoadingTitle": "Planujemy Twoją książkę…",
  "newProject.previewLoadingText": "Tytuł, rozdziały i to, co w każdym znajdziesz. Zwykle 20–40 sekund.",
  "newProject.previewLimit": "Wykorzystano dzisiejsze darmowe podglądy. Książkę nadal możesz zamówić — po płatności zobaczysz i poprawisz pełny konspekt, zanim zaczniemy pisać.",
  "newProject.previewFailed": "Tym razem podgląd się nie wczytał. Spróbuj ponownie albo zamów od razu — po płatności zobaczysz i poprawisz pełny konspekt, zanim zaczniemy pisać.",

  // Toasts
  "newProject.draftRestored": "Przywrócono wersję roboczą",
  "newProject.pendingOrderTitle": "Masz zamówienie czekające na płatność",
  "newProject.pendingOrderBody": "„{s}” — opis i ustawienia są zapisane.",
  "newProject.pendingOrderCta": "Dokończ zamówienie",
  "newProject.maxColors": "Maksymalnie 3 kolory",
  "newProject.invalidHex": "Podaj prawidłowy kolor hex (np. #FF5500)",
  "newProject.colorAlreadySelected": "Kolor już wybrany",
  "newProject.projectCreated": "Projekt utworzony!",
  "newProject.failed": "Nie powiodło się",

  // Validation
  "newProject.titleTypoHint": "W temacie jest inna pisownia — czy chodziło o:",
  "newProject.errMinChars": "Min. 5 znaków",
  "newProject.errTitleOrTopic": "Opisz książkę albo podaj jej tytuł",
};
