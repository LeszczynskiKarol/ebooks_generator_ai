// i18n strings for: newProject  (keys prefixed "newProject.")
export const en: Record<string, string> = {
  // Page header
  "newProject.title": "Create New Book",
  "newProject.subtitle": "Tell us about your eBook. Edit everything later.",

  // Section: Book Details
  "newProject.bookDetails": "Book Details",
  "newProject.bookTitleHelp":
    "Leave empty and we'll suggest one based on your topic",
  "newProject.materialsButton": "Attach files",
  "newProject.materialsHint":
    "or drop them here: guidelines, examples, sources, inspirations",
  "newProject.materialsFormats":
    "PDF, Word (DOC/DOCX), OpenDocument (ODT/ODP), RTF, TXT, Markdown, PowerPoint · up to {mb} MB each, max {n} files. The AI reads their text and follows them while writing.",
  "newProject.materialsChars": "{n} chars",
  "newProject.materialsTruncated": "long file, first part used",
  "newProject.materialsReading": "Reading file…",
  "newProject.materialsRemove": "Remove file",
  "newProject.materialsErrType": "unsupported file type",
  "newProject.materialsErrSize": "file larger than {mb} MB",
  "newProject.materialsErrEmpty":
    "no text found (a scanned PDF? paste the key parts into the guidelines instead)",
  "newProject.materialsErrCount": "You can attach up to {n} files",
  "newProject.materialsErrGeneric": "upload failed, try again",

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
  "newProject.colorRolePrimary": "Primary: chapter headings, main accents",
  "newProject.colorRoleSecondary": "Secondary: boxes, highlights, tips",
  "newProject.colorRoleTertiary":
    "Tertiary: details, borders, subtle elements",

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
    "Start without a cover and add one later in the editor",
  "newProject.aiIllustrations": "AI illustrations inside the book",
  "newProject.included": "Included",
  "newProject.aiIllustrationsDesc":
    "AI-generated images matched to the content and your visual style. No extra cost. After generation you can also add your own photos anywhere in the book editor.",
  "newProject.howManyIllustrations": "How many illustrations?",
  "newProject.densityStandardLabel": "Standard",
  "newProject.densityStandardDesc": "~1 image per 5 pages",
  "newProject.densityRichLabel": "Rich",
  "newProject.densityRichDesc":
    "~1 image per 3 pages, great for cooking, crafts, travel",
  "newProject.imagePrefsLabel": "Image preferences (optional)",
  "newProject.imagePrefsPlaceholder":
    "e.g., prefer photos of real workplaces, warm tones, no close-up faces...",
  "newProject.imagePrefsHelp":
    "Lightly steer the AI images: mood, color, subjects to prefer or avoid.",

  // Section: Settings
  "newProject.settings": "Settings",
  "newProject.languageLabel": "Book language",
  "newProject.pageFormatLabel": "Page Format",
  "newProject.visualStyleLabel": "Book Style",
  "newProject.visualStyleHelp":
    "Shapes both the design (fonts, colors) and the writing voice, fine-tuned to your topic and guidelines.",
  "newProject.footnotesLabel": "Footnotes & sources",
  "newProject.footnoteAutoLabel": "Auto",
  "newProject.footnoteAutoDesc":
    "Follows the style: Academic gets footnotes, others stay clean",
  "newProject.footnoteAlwaysLabel": "With footnotes",
  "newProject.footnoteAlwaysDesc": "Full source apparatus in every chapter",
  "newProject.footnoteNeverLabel": "No footnotes",
  "newProject.footnoteNeverDesc":
    "Popular style: sources woven into the text",

  // Languages
  "newProject.langEn": "English",
  "newProject.langPl": "Polish",
  "newProject.langDe": "German",
  "newProject.langEs": "Spanish",
  "newProject.langEsEs": "Spanish (Spain)",
  "newProject.langEs419": "Spanish (Latin America)",
  "newProject.langPtPt": "Portuguese (Portugal)",
  "newProject.langPtBr": "Portuguese (Brazil)",
  "newProject.langFr": "French",
  "newProject.langIt": "Italian",
  "newProject.langPt": "Portuguese",
  "newProject.langNl": "Dutch",

  // Styles
  "newProject.styleAuto": "Automatic: we pick the style and colours that suit your topic",
  "newProject.styleAutoSummary": "style matched to the topic",
  "newProject.styleModern": "Modern: clean design, direct contemporary writing",
  "newProject.styleAcademic": "Academic: scholarly layout, precise formal prose",
  "newProject.styleMinimal": "Minimal: elegant simplicity, spare calm prose",
  "newProject.styleCreative": "Creative: bold design, narrative storytelling voice",
  "newProject.styleBusiness": "Business: professional look, results-driven writing",

  // Style names (for order summary)
  "newProject.styleNameModern": "Modern",
  "newProject.styleNameAcademic": "Academic",
  "newProject.styleNameMinimal": "Minimal",
  "newProject.styleNameCreative": "Creative",
  "newProject.styleNameBusiness": "Business",

  // Formats
  "newProject.formatA5": "A5 (148×210mm), standard",
  "newProject.formatB5": "B5 (176×250mm), larger",
  "newProject.formatLetter": "Letter (216×279mm), US",
  "newProject.formatA4": "A4 (210×297mm), full size",
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
  "newProject.continueToPayment": "Continue to Payment: {s}",
  "newProject.continueToPreview": "See my book's table of contents for free",
  "newProject.previewHint": "Free, no card needed. You pay only if you like the plan.",
  "newProject.descriptionLabel": "Describe your book",
  "newProject.descriptionPlaceholder": "e.g. A practical 30-day program for beginners who sit at a desk all day: short daily exercises for the back, hips and neck, desk ergonomics and micro-breaks. Friendly tone, no jargon, with a tracker at the end.",
  "newProject.descriptionHelp": "What it's about, who it's for and what must be inside, as much or as little as you like. A sentence is enough; a detailed brief is better.",
  "newProject.titleOptionalLabel": "Title (optional)",
  "newProject.lookTitle": "Look & settings",
  "newProject.lookHint": "Style, format, colours, cover, illustrations, footnotes: the defaults are good and you can change them later.",
  "newProject.lookChange": "Change",
  "newProject.previewBadge": "Free preview of your book",
  "newProject.previewPay": "I like it, pay {s} and write my book",
  "newProject.previewAssurance": "Before writing starts you review the full outline and can change it (plus one free re-plan). If generation fails for technical reasons, we refund you.",
  "newProject.previewEdit": "Change the description",
  "newProject.previewEditHint": "This is your book's plan. Click any title or description to change it, add or remove chapters and sections, set pages, or ask the AI for a new version with your notes. After payment we research the topic and expand exactly this plan.",
  "newProject.previewRedo": "New version from AI with your notes (one time)",
  "newProject.previewRejectedTitle": "We couldn't plan a book from this description",
  "newProject.previewLoadingTitle": "Planning your book…",
  "newProject.previewLoadingText": "Title, chapters and what each one covers. Usually 20–40 seconds.",
  "newProject.previewLimit": "You've used today's free previews. You can still order the book: after payment you'll see and edit the full outline before writing starts.",
  "newProject.previewFailed": "The preview didn't load this time. You can try again or order straight away. After payment you'll see and edit the full outline before writing starts.",

  // Toasts
  "newProject.draftRestored": "Draft restored",
  "newProject.pendingOrderTitle": "You have an order waiting for payment",
  "newProject.pendingOrderBody": "“{s}”: your description and settings are saved.",
  "newProject.pendingOrderCta": "Complete order",
  "newProject.maxColors": "Maximum 3 colors",
  "newProject.invalidHex": "Enter a valid hex color (e.g. #FF5500)",
  "newProject.colorAlreadySelected": "Color already selected",
  "newProject.projectCreated": "Project created!",
  "newProject.failed": "Failed",

  // Validation
  "newProject.titleTypoHint": "The topic spells this differently. Did you mean:",
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
    "Zostaw puste, a zaproponujemy tytuł na podstawie tematu",
  "newProject.materialsButton": "Dołącz pliki",
  "newProject.materialsHint":
    "lub przeciągnij je tutaj: wskazówki, przykłady, źródła, inspiracje",
  "newProject.materialsFormats":
    "PDF, Word (DOC/DOCX), OpenDocument (ODT/ODP), RTF, TXT, Markdown, PowerPoint · do {mb} MB każdy, maks. {n} plików. AI czyta ich treść i trzyma się jej podczas pisania.",
  "newProject.materialsChars": "{n} znaków",
  "newProject.materialsTruncated": "długi plik, użyta pierwsza część",
  "newProject.materialsReading": "Czytam plik…",
  "newProject.materialsRemove": "Usuń plik",
  "newProject.materialsErrType": "nieobsługiwany typ pliku",
  "newProject.materialsErrSize": "plik większy niż {mb} MB",
  "newProject.materialsErrEmpty":
    "nie znaleziono tekstu (skan PDF? wklej najważniejsze fragmenty do wytycznych)",
  "newProject.materialsErrCount": "Możesz dołączyć maksymalnie {n} plików",
  "newProject.materialsErrGeneric": "nie udało się wgrać, spróbuj ponownie",

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
    "Wybierz 1–3 kolory akcentu dla nagłówków, ramek i tabel. Zostaw puste, a dobierzemy kolory pasujące do tematu.",
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
    "Podstawowy: nagłówki rozdziałów, główne akcenty",
  "newProject.colorRoleSecondary":
    "Drugorzędny: ramki, wyróżnienia, wskazówki",
  "newProject.colorRoleTertiary":
    "Trzeciorzędny: detale, obramowania, subtelne elementy",

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
    "Zacznij bez okładki i dodaj ją później w edytorze",
  "newProject.aiIllustrations": "Ilustracje AI wewnątrz książki",
  "newProject.included": "W cenie",
  "newProject.aiIllustrationsDesc":
    "Obrazy generowane przez AI dopasowane do treści i Twojego stylu wizualnego. Bez dodatkowych kosztów. Po wygenerowaniu możesz też w edytorze dodać własne zdjęcia w dowolnym miejscu książki.",
  "newProject.howManyIllustrations": "Ile ilustracji?",
  "newProject.densityStandardLabel": "Standardowo",
  "newProject.densityStandardDesc": "~1 obraz na 5 stron",
  "newProject.densityRichLabel": "Bogato",
  "newProject.densityRichDesc":
    "~1 obraz na 3 strony, świetne do gotowania, rękodzieła, podróży",
  "newProject.imagePrefsLabel": "Preferencje obrazów (opcjonalnie)",
  "newProject.imagePrefsPlaceholder":
    "np. preferuj zdjęcia prawdziwych miejsc pracy, ciepłe tony, bez zbliżeń twarzy...",
  "newProject.imagePrefsHelp":
    "Delikatnie ukierunkuj obrazy AI: nastrój, kolor, tematy do preferowania lub unikania.",

  // Section: Settings
  "newProject.settings": "Ustawienia",
  "newProject.languageLabel": "Język książki",
  "newProject.pageFormatLabel": "Format strony",
  "newProject.visualStyleLabel": "Styl książki",
  "newProject.visualStyleHelp":
    "Wpływa na wygląd (fonty, kolory) oraz sposób pisania. Dopasowujemy go do tematu i Twoich wytycznych.",
  "newProject.footnotesLabel": "Przypisy i źródła",
  "newProject.footnoteAutoLabel": "Automatycznie",
  "newProject.footnoteAutoDesc":
    "Zgodnie ze stylem: Akademicki dostaje przypisy, pozostałe pozostają czyste",
  "newProject.footnoteAlwaysLabel": "Z przypisami",
  "newProject.footnoteAlwaysDesc":
    "Pełen aparat źródłowy w każdym rozdziale",
  "newProject.footnoteNeverLabel": "Bez przypisów",
  "newProject.footnoteNeverDesc":
    "Styl popularny: źródła wplecione w tekst",

  // Languages
  "newProject.langEn": "Angielski",
  "newProject.langPl": "Polski",
  "newProject.langDe": "Niemiecki",
  "newProject.langEs": "Hiszpański",
  "newProject.langEsEs": "Hiszpański (Hiszpania)",
  "newProject.langEs419": "Hiszpański (Ameryka Łacińska)",
  "newProject.langPtPt": "Portugalski (Portugalia)",
  "newProject.langPtBr": "Portugalski (Brazylia)",
  "newProject.langFr": "Francuski",
  "newProject.langIt": "Włoski",
  "newProject.langPt": "Portugalski",
  "newProject.langNl": "Holenderski",

  // Styles
  "newProject.styleAuto": "Automatycznie: dobierzemy styl i kolory do tematu",
  "newProject.styleAutoSummary": "styl dobrany do tematu",
  "newProject.styleModern": "Nowoczesny: czysty design, bezpośredni współczesny język",
  "newProject.styleAcademic": "Akademicki: naukowy skład, precyzyjna formalna proza",
  "newProject.styleMinimal": "Minimalistyczny: elegancka prostota, oszczędny spokojny styl",
  "newProject.styleCreative": "Kreatywny: śmiały design, narracyjny język opowieści",
  "newProject.styleBusiness": "Biznesowy: profesjonalny wygląd, konkretny styl nastawiony na rezultaty",

  // Style names (for order summary)
  "newProject.styleNameModern": "Nowoczesny",
  "newProject.styleNameAcademic": "Akademicki",
  "newProject.styleNameMinimal": "Minimalistyczny",
  "newProject.styleNameCreative": "Kreatywny",
  "newProject.styleNameBusiness": "Biznesowy",

  // Formats
  "newProject.formatA5": "A5 (148×210mm), standardowy",
  "newProject.formatB5": "B5 (176×250mm), większy",
  "newProject.formatLetter": "Letter (216×279mm), amerykański",
  "newProject.formatA4": "A4 (210×297mm), pełny",
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
  "newProject.continueToPayment": "Przejdź do płatności: {s}",
  "newProject.continueToPreview": "Zobacz spis treści mojej książki za darmo",
  "newProject.previewHint": "Za darmo, bez karty. Płacisz dopiero, gdy plan Ci się spodoba.",
  "newProject.descriptionLabel": "Opisz swoją książkę",
  "newProject.descriptionPlaceholder": "np. Praktyczny 30-dniowy program dla początkujących, którzy cały dzień siedzą przy biurku: krótkie codzienne ćwiczenia na plecy, biodra i szyję, ergonomia stanowiska i mikroprzerwy. Przystępny język, bez żargonu, na końcu tracker postępów.",
  "newProject.descriptionHelp": "O czym ma być, dla kogo i co koniecznie ma się w niej znaleźć. Napisz tyle, ile chcesz. Wystarczy jedno zdanie, a szczegółowy opis da lepszą książkę.",
  "newProject.titleOptionalLabel": "Tytuł (opcjonalnie)",
  "newProject.lookTitle": "Wygląd i ustawienia",
  "newProject.lookHint": "Styl, format, kolory, okładka, ilustracje, przypisy: domyślne są dobre, a zmienisz je także później.",
  "newProject.lookChange": "Zmień",
  "newProject.previewBadge": "Darmowy podgląd Twojej książki",
  "newProject.previewPay": "Podoba mi się, płacę {s} i piszemy",
  "newProject.previewAssurance": "Zanim zaczniemy pisać, zobaczysz pełny konspekt i możesz go zmienić (plus jedno darmowe ponowne planowanie). Jeśli generowanie nie powiedzie się z przyczyn technicznych, zwracamy pieniądze.",
  "newProject.previewEdit": "Zmień opis",
  "newProject.previewEditHint": "To plan Twojej książki. Kliknij dowolny tytuł lub opis, żeby go zmienić, dodawaj i usuwaj rozdziały i podrozdziały, ustawiaj strony albo poproś AI o nową wersję z Twoimi uwagami. Po płatności robimy research i rozwijamy dokładnie ten plan.",
  "newProject.previewRedo": "Nowa wersja od AI z Twoimi uwagami (jednorazowo)",
  "newProject.previewRejectedTitle": "Z tego opisu nie da się zaplanować książki",
  "newProject.previewLoadingTitle": "Planujemy Twoją książkę…",
  "newProject.previewLoadingText": "Tytuł, rozdziały i to, co w każdym znajdziesz. Zwykle 20–40 sekund.",
  "newProject.previewLimit": "Wykorzystano dzisiejsze darmowe podglądy. Książkę nadal możesz zamówić: po płatności zobaczysz i poprawisz pełny konspekt, zanim zaczniemy pisać.",
  "newProject.previewFailed": "Tym razem podgląd się nie wczytał. Spróbuj ponownie albo zamów od razu. Po płatności zobaczysz i poprawisz pełny konspekt, zanim zaczniemy pisać.",

  // Toasts
  "newProject.draftRestored": "Przywrócono wersję roboczą",
  "newProject.pendingOrderTitle": "Masz zamówienie czekające na płatność",
  "newProject.pendingOrderBody": "„{s}”: opis i ustawienia są zapisane.",
  "newProject.pendingOrderCta": "Dokończ zamówienie",
  "newProject.maxColors": "Maksymalnie 3 kolory",
  "newProject.invalidHex": "Podaj prawidłowy kolor hex (np. #FF5500)",
  "newProject.colorAlreadySelected": "Kolor już wybrany",
  "newProject.projectCreated": "Projekt utworzony!",
  "newProject.failed": "Nie powiodło się",

  // Validation
  "newProject.titleTypoHint": "W temacie jest inna pisownia. Czy chodziło o:",
  "newProject.errMinChars": "Min. 5 znaków",
  "newProject.errTitleOrTopic": "Opisz książkę albo podaj jej tytuł",
};

export const de: Record<string, string> = {
  // Page header
  "newProject.title": "Neues Buch erstellen",
  "newProject.subtitle":
    "Erzählen Sie uns von Ihrem E-Book. Sie können später alles bearbeiten.",

  // Section: Book Details
  "newProject.bookDetails": "Angaben zum Buch",
  "newProject.bookTitleHelp":
    "Lassen Sie das Feld leer, dann schlagen wir einen Titel passend zu Ihrem Thema vor",
  "newProject.materialsButton": "Dateien anhängen",
  "newProject.materialsHint":
    "oder hier ablegen: Vorgaben, Beispiele, Quellen, Inspirationen",
  "newProject.materialsFormats":
    "PDF, Word (DOC/DOCX), OpenDocument (ODT/ODP), RTF, TXT, Markdown, PowerPoint · je bis zu {mb} MB, max. {n} Dateien. Die KI liest den Text und hält sich beim Schreiben daran.",
  "newProject.materialsChars": "{n} Zeichen",
  "newProject.materialsTruncated": "lange Datei, erster Teil verwendet",
  "newProject.materialsReading": "Datei wird gelesen…",
  "newProject.materialsRemove": "Datei entfernen",
  "newProject.materialsErrType": "Dateityp wird nicht unterstützt",
  "newProject.materialsErrSize": "Datei größer als {mb} MB",
  "newProject.materialsErrEmpty":
    "kein Text gefunden (ein gescanntes PDF? Fügen Sie die wichtigsten Passagen stattdessen in die Vorgaben ein)",
  "newProject.materialsErrCount": "Sie können bis zu {n} Dateien anhängen",
  "newProject.materialsErrGeneric":
    "Hochladen fehlgeschlagen, bitte versuchen Sie es erneut",

  // Section: Book Size
  "newProject.bookSize": "Umfang des Buchs",
  "newProject.popular": "Beliebt",
  "newProject.tierLabel.compact": "Kompakt",
  "newProject.tierLabel.standard": "Standard",
  "newProject.tierLabel.extended": "Erweitert",
  "newProject.tierLabel.comprehensive": "Umfassend",
  "newProject.tierLabel.complete": "Komplett",
  "newProject.tierDesc.compact": "30–40 Seiten",
  "newProject.tierDesc.standard": "50–70 Seiten",
  "newProject.tierDesc.extended": "80–100 Seiten",
  "newProject.tierDesc.comprehensive": "130–150 Seiten",
  "newProject.tierDesc.complete": "170–200 Seiten",

  // Section: Color Scheme
  "newProject.colorScheme": "Farbschema",
  "newProject.colorSchemeDesc":
    "Wählen Sie 1–3 Akzentfarben für Überschriften, Kästen und Tabellen. Lassen Sie die Auswahl leer, dann wählen wir Farben, die zu Ihrem Thema passen.",
  "newProject.rolePrimary": "Primär",
  "newProject.roleSecondary": "Sekundär",
  "newProject.roleTertiary": "Tertiär",
  "newProject.chooseColors": "Farben wählen",
  "newProject.colorsSelected": "{s}/3 ausgewählt",
  "newProject.addCustomColor": "Eigene Farbe hinzufügen",
  "newProject.add": "Hinzufügen",
  "newProject.cancel": "Abbrechen",
  "newProject.howColorsUsed": "So werden Ihre Farben verwendet:",
  "newProject.oneColorNote":
    "Bei 1 Farbe werden passende Abstufungen automatisch erzeugt.",
  "newProject.colorRolePrimary": "Primär: Kapitelüberschriften, Hauptakzente",
  "newProject.colorRoleSecondary": "Sekundär: Kästen, Hervorhebungen, Tipps",
  "newProject.colorRoleTertiary":
    "Tertiär: Details, Rahmen, dezente Elemente",

  // Color names
  "newProject.colorWhite": "Weiß",
  "newProject.colorBlack": "Schwarz",
  "newProject.colorRoyalBlue": "Königsblau",
  "newProject.colorBlue": "Blau",
  "newProject.colorSkyBlue": "Himmelblau",
  "newProject.colorCyan": "Cyan",
  "newProject.colorViolet": "Violett",
  "newProject.colorPurple": "Lila",
  "newProject.colorLavender": "Lavendel",
  "newProject.colorPink": "Pink",
  "newProject.colorEmerald": "Smaragdgrün",
  "newProject.colorGreen": "Grün",
  "newProject.colorLime": "Limette",
  "newProject.colorTeal": "Petrol",
  "newProject.colorRed": "Rot",
  "newProject.colorOrange": "Orange",
  "newProject.colorAmber": "Bernstein",
  "newProject.colorGold": "Gold",
  "newProject.colorSlate": "Schiefergrau",
  "newProject.colorGray": "Grau",
  "newProject.colorBrown": "Braun",
  "newProject.colorRose": "Altrosa",

  // Section: Book Cover
  "newProject.bookCover": "Buchcover",
  "newProject.bookCoverDesc":
    "Legen Sie fest, wie Ihr Cover entstehen soll. Sie können das später jederzeit ändern.",
  "newProject.coverGenerateLabel": "Cover erstellen lassen",
  "newProject.coverGenerateDesc":
    "Professionelles, von der KI gestaltetes Cover auf Basis Ihrer Angaben zum Buch",
  "newProject.coverUploadLabel": "Eigenes Cover hochladen",
  "newProject.coverUploadDesc": "Laden Sie ein eigenes Bild im Format {s} hoch",
  "newProject.coverNoneLabel": "Kein Cover",
  "newProject.coverNoneDesc":
    "Ohne Cover starten und später im Editor eines hinzufügen",
  "newProject.aiIllustrations": "KI-Illustrationen im Buch",
  "newProject.included": "Inklusive",
  "newProject.aiIllustrationsDesc":
    "KI-generierte Bilder, abgestimmt auf den Inhalt und Ihren visuellen Stil. Ohne Aufpreis. Nach der Erstellung können Sie im Editor außerdem an jeder Stelle des Buchs eigene Fotos einfügen.",
  "newProject.howManyIllustrations": "Wie viele Illustrationen?",
  "newProject.densityStandardLabel": "Standard",
  "newProject.densityStandardDesc": "~1 Bild pro 5 Seiten",
  "newProject.densityRichLabel": "Reichhaltig",
  "newProject.densityRichDesc":
    "~1 Bild pro 3 Seiten, ideal für Kochen, Basteln, Reisen",
  "newProject.imagePrefsLabel": "Bildwünsche (optional)",
  "newProject.imagePrefsPlaceholder":
    "z. B. lieber Fotos echter Arbeitsplätze, warme Töne, keine Nahaufnahmen von Gesichtern...",
  "newProject.imagePrefsHelp":
    "Lenken Sie die KI-Bilder behutsam: Stimmung, Farbe, Motive, die bevorzugt oder vermieden werden sollen.",

  // Section: Settings
  "newProject.settings": "Einstellungen",
  "newProject.languageLabel": "Sprache des Buchs",
  "newProject.pageFormatLabel": "Seitenformat",
  "newProject.visualStyleLabel": "Buchstil",
  "newProject.visualStyleHelp":
    "Prägt sowohl die Gestaltung (Schriften, Farben) als auch den Schreibstil, fein abgestimmt auf Ihr Thema und Ihre Vorgaben.",
  "newProject.footnotesLabel": "Fußnoten und Quellen",
  "newProject.footnoteAutoLabel": "Automatisch",
  "newProject.footnoteAutoDesc":
    "Richtet sich nach dem Stil: Akademisch erhält Fußnoten, die anderen bleiben schlicht",
  "newProject.footnoteAlwaysLabel": "Mit Fußnoten",
  "newProject.footnoteAlwaysDesc":
    "Vollständiger Quellenapparat in jedem Kapitel",
  "newProject.footnoteNeverLabel": "Ohne Fußnoten",
  "newProject.footnoteNeverDesc":
    "Populärer Stil: Quellen in den Text eingeflochten",

  // Languages
  "newProject.langEn": "Englisch",
  "newProject.langPl": "Polnisch",
  "newProject.langDe": "Deutsch",
  "newProject.langEs": "Spanisch",
  "newProject.langEsEs": "Spanisch (Spanien)",
  "newProject.langEs419": "Spanisch (Lateinamerika)",
  "newProject.langPtPt": "Portugiesisch (Portugal)",
  "newProject.langPtBr": "Portugiesisch (Brasilien)",
  "newProject.langFr": "Französisch",
  "newProject.langIt": "Italienisch",
  "newProject.langPt": "Portugiesisch",
  "newProject.langNl": "Niederländisch",

  // Styles
  "newProject.styleAuto": "Automatisch: Wir wählen Stil und Farben passend zu Ihrem Thema",
  "newProject.styleAutoSummary": "Stil passend zum Thema",
  "newProject.styleModern": "Modern: klares Design, direkte zeitgemäße Sprache",
  "newProject.styleAcademic": "Akademisch: wissenschaftliches Layout, präzise formelle Prosa",
  "newProject.styleMinimal": "Minimalistisch: elegante Schlichtheit, knappe ruhige Prosa",
  "newProject.styleCreative": "Kreativ: mutiges Design, erzählerischer Ton",
  "newProject.styleBusiness": "Business: professioneller Auftritt, ergebnisorientierte Sprache",

  // Style names (for order summary)
  "newProject.styleNameModern": "Modern",
  "newProject.styleNameAcademic": "Akademisch",
  "newProject.styleNameMinimal": "Minimalistisch",
  "newProject.styleNameCreative": "Kreativ",
  "newProject.styleNameBusiness": "Business",

  // Formats
  "newProject.formatA5": "A5 (148×210mm), Standard",
  "newProject.formatB5": "B5 (176×250mm), größer",
  "newProject.formatLetter": "Letter (216×279mm), US",
  "newProject.formatA4": "A4 (210×297mm), volle Größe",
  "newProject.formatDescStandard": "Standard",
  "newProject.formatDescLarger": "Größer",
  "newProject.formatDescUs": "US",
  "newProject.formatDescFull": "Voll",

  // Order summary
  "newProject.pages": "{s} Seiten",
  "newProject.styleSuffix": "Stil",
  "newProject.summaryAiCover": "KI-Cover",
  "newProject.summaryOwnCover": "Eigenes Cover",
  "newProject.summaryNoCover": "Kein Cover",
  "newProject.summaryAiIllustrations": "KI-Illustrationen",

  // Submit
  "newProject.continueToPayment": "Weiter zur Zahlung: {s}",
  "newProject.continueToPreview": "Inhaltsverzeichnis meines Buchs kostenlos ansehen",
  "newProject.previewHint": "Kostenlos, keine Karte nötig. Sie zahlen nur, wenn Ihnen die Gliederung gefällt.",
  "newProject.descriptionLabel": "Beschreiben Sie Ihr Buch",
  "newProject.descriptionPlaceholder": "z. B. Ein praktisches 30-Tage-Programm für Einsteiger, die den ganzen Tag am Schreibtisch sitzen: kurze tägliche Übungen für Rücken, Hüfte und Nacken, Ergonomie am Arbeitsplatz und Mikropausen. Freundlicher Ton, kein Fachjargon, mit einem Fortschrittstracker am Ende.",
  "newProject.descriptionHelp": "Worum es geht, für wen es gedacht ist und was unbedingt enthalten sein muss. Schreiben Sie so viel oder so wenig, wie Sie möchten. Ein Satz genügt, eine ausführliche Beschreibung ist besser.",
  "newProject.titleOptionalLabel": "Titel (optional)",
  "newProject.lookTitle": "Aussehen und Einstellungen",
  "newProject.lookHint": "Stil, Format, Farben, Cover, Illustrationen, Fußnoten: Die Voreinstellungen sind gut und lassen sich später ändern.",
  "newProject.lookChange": "Ändern",
  "newProject.previewBadge": "Kostenlose Vorschau Ihres Buchs",
  "newProject.previewPay": "Gefällt mir, {s} zahlen und mein Buch schreiben lassen",
  "newProject.previewAssurance": "Bevor das Schreiben beginnt, prüfen Sie die vollständige Gliederung und können sie ändern (plus eine kostenlose Neuplanung). Schlägt die Erstellung aus technischen Gründen fehl, erstatten wir Ihnen den Betrag.",
  "newProject.previewEdit": "Beschreibung ändern",
  "newProject.previewEditHint": "Das ist die Gliederung Ihres Buchs. Klicken Sie auf einen Titel oder eine Beschreibung, um sie zu ändern, fügen Sie Kapitel und Abschnitte hinzu oder entfernen Sie sie, legen Sie Seitenzahlen fest oder bitten Sie die KI um eine neue Version mit Ihren Anmerkungen. Nach der Zahlung recherchieren wir das Thema und arbeiten genau diese Gliederung aus.",
  "newProject.previewRedo": "Neue Version von der KI mit Ihren Anmerkungen (einmalig)",
  "newProject.previewRejectedTitle": "Aus dieser Beschreibung konnten wir kein Buch planen",
  "newProject.previewLoadingTitle": "Ihr Buch wird geplant…",
  "newProject.previewLoadingText": "Titel, Kapitel und was jedes davon behandelt. Dauert meist 20–40 Sekunden.",
  "newProject.previewLimit": "Sie haben die kostenlosen Vorschauen für heute aufgebraucht. Sie können das Buch trotzdem bestellen: Nach der Zahlung sehen und bearbeiten Sie die vollständige Gliederung, bevor das Schreiben beginnt.",
  "newProject.previewFailed": "Die Vorschau konnte diesmal nicht geladen werden. Versuchen Sie es erneut oder bestellen Sie direkt. Nach der Zahlung sehen und bearbeiten Sie die vollständige Gliederung, bevor das Schreiben beginnt.",

  // Toasts
  "newProject.draftRestored": "Entwurf wiederhergestellt",
  "newProject.pendingOrderTitle": "Eine Bestellung wartet auf die Zahlung",
  "newProject.pendingOrderBody": "„{s}“: Ihre Beschreibung und Einstellungen sind gespeichert.",
  "newProject.pendingOrderCta": "Bestellung abschließen",
  "newProject.maxColors": "Maximal 3 Farben",
  "newProject.invalidHex": "Geben Sie eine gültige Hex-Farbe ein (z. B. #FF5500)",
  "newProject.colorAlreadySelected": "Farbe bereits ausgewählt",
  "newProject.projectCreated": "Projekt erstellt!",
  "newProject.failed": "Fehlgeschlagen",

  // Validation
  "newProject.titleTypoHint": "Im Thema wird das anders geschrieben. Meinten Sie:",
  "newProject.errMinChars": "Mind. 5 Zeichen",
  "newProject.errTitleOrTopic": "Beschreiben Sie das Buch oder geben Sie den Titel an",
};
