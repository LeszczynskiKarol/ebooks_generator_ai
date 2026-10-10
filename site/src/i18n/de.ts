// German translations (formal "Sie"). Same shape as `ui.en` in ./ui.ts.
// Glossary (matches the web app): Kapitel, Abschnitt, Inhaltsverzeichnis,
// Gliederung, Leseprobe, Cover, Satz, Recherche, Quellen, Fußnoten /
// Quellenangaben, Editor, Lektorat, KI, Abo.
export const de = {
  nav: {
    tagline: "KI-E-Book-Generator",
    how: "So funktioniert’s",
    features: "Funktionen",
    pricing: "Preise",
    faq: "FAQ",
    examples: "Beispiele",
    blog: "Blog",
    signIn: "Anmelden",
    cta: "E-Book erstellen",
    app: "Android-App",
  },
  hero: {
    badge: "KI-E-Book-Generator",
    title1: "Ihr E-Book, ohne selbst zu schreiben.",
    titleAccent: "In einer Stunde bereit zur Veröffentlichung.",
    title2: "",
    sub: "Beschreiben Sie Ihr Thema. InkMagnet recherchiert es in aktuellen Quellen, schreibt jedes Kapitel, führt ein Lektorat durch und setzt alles als PDF und EPUB, mit Cover, Inhaltsverzeichnis und Quellenangaben. Kein Abo: Sie zahlen für ein einzelnes Buch, und erst, nachdem Sie seine Gliederung gesehen haben.",
    ctaPrimary: "Mein Buch kostenlos planen",
    ctaSecondary: "So funktioniert’s",
    bullets: [
      "Inhaltsverzeichnis und 2 Seiten Leseprobe kostenlos",
      "Quellenangaben zu echten Quellen",
      "Lektorat bei jedem Buch",
      "PDF + EPUB, volle kommerzielle Nutzungsrechte",
    ],
  },
  how: {
    title: "In vier Schritten von der Beschreibung zum fertigen Buch",
    sub: "Sie sehen die Gliederung, bevor Sie zahlen. Den Rest erledigt die Pipeline.",
    steps: [
      {
        title: "Beschreiben Sie Ihr Buch",
        desc: "Ein Feld, bis zu 15.000 Zeichen: das Thema, die Zielgruppe und was unbedingt hineingehört. Hängen Sie Notizen oder Dateien an, wenn Sie welche haben, und wählen Sie dann den Umfang. Stil, Format, Farben, Cover und Illustrationen sind optional. Lassen Sie alles auf „Automatisch“, wählt die KI einen Stil und eine Farbpalette, die zu Ihrem Thema passen.",
      },
      {
        title: "Sehen Sie Ihr Inhaltsverzeichnis kostenlos",
        desc: "Noch vor der Zahlung erhalten Sie einen Titel und das vollständige Inhaltsverzeichnis: Kapitel und Abschnitte, jeweils mit einer kurzen Beschreibung. Bearbeiten Sie alles, fügen Sie Kapitel hinzu oder entfernen Sie welche, oder lassen Sie die KI anhand Ihrer Anmerkungen eine neue Version erstellen und behalten Sie die, die Ihnen besser gefällt. Sie möchten wissen, wie es sich liest? Eine kostenlose zweiseitige Leseprobe aus Kapitel 1, gesetzt genau wie das fertige Buch, ist in etwa einer Minute fertig.",
      },
      {
        title: "Sie zahlen, dann recherchiert und schreibt die KI",
        desc: "Sie zahlen erst, wenn Ihnen die Gliederung gefällt. Die Engine recherchiert Ihr Thema live im Web und arbeitet Ihre Gliederung zu einer Feingliederung aus, die Sie bearbeiten (oder einmal neu erstellen lassen) können, bevor ein Kapitel geschrieben wird. Danach wird jedes Kapitel geschrieben und geprüft, und das gesamte Buch durchläuft vor dem Satz ein Lektorat und eine Konsistenzprüfung.",
      },
      {
        title: "Herunterladen und veröffentlichen",
        desc: "Sie erhalten ein druckfertiges PDF und ein shopfertiges EPUB, mit gestaltetem Cover. Bearbeiten Sie jedes Kapitel im integrierten Editor, fügen Sie eigene Fotos hinzu und kompilieren Sie das Buch jederzeit neu.",
      },
    ],
  },
  features: {
    title: "Was diese Bücher zu einem Lesevergnügen macht",
    sub: "Die meisten KI-Buchtools liefern einen langen Blogartikel in einer PDF-Hülle. InkMagnet baut richtige Bücher.",
    items: [
      {
        title: "Echte Web-Recherche",
        desc: "Bevor auch nur ein Kapitel geschrieben wird, recherchiert die Engine Ihr Thema online und stützt den Inhalt auf aktuelle, überprüfbare Quellen.",
      },
      {
        title: "Professioneller Satz",
        desc: "Die Bücher werden mit LaTeX kompiliert, dem System hinter wissenschaftlichen Publikationen. Saubere Ränder, Kolumnentitel, Silbentrennung, ein klickbares Inhaltsverzeichnis.",
      },
      {
        title: "KI-Illustrationen, die passen",
        desc: "Optionale fotografische oder illustrierte Bilder, pro Kapitel generiert, abgestimmt auf Thema, Sprache und Region und im Preis enthalten.",
      },
      {
        title: "Gestaltete Cover",
        desc: "Das Cover wird mit Ihrem Titel, Ihrer Farbpalette und dem Layout Ihrer Wahl erstellt. Im Cover-Editor passen Sie es an, wann immer Sie möchten.",
      },
      {
        title: "Ihre Änderungen sind unantastbar",
        desc: "Schreiben Sie jedes Kapitel im WYSIWYG-Editor um. Eine erneute Generierung überschreibt niemals, was Sie von Hand geändert haben.",
      },
      {
        title: "PDF + EPUB, bereit für den Verkauf",
        desc: "Ein PDF in Druckqualität und ein valides EPUB für Kindle, Apple Books oder Ihren Shop. Keine Wasserzeichen, volle kommerzielle Nutzungsrechte.",
      },
    ],
  },
  deepDive: {
    title: "Mehr als ein Chatbot in einer Hülle",
    sub: "Ein Spitzenmodell kann Absätze schreiben. Damit aus diesen Absätzen ein Buch wird, das Menschen tatsächlich zu Ende lesen, braucht es eine Pipeline. Das läuft hinter jedem Projekt ab.",
    items: [
      {
        title: "Erst die Recherche, dann das erste Wort",
        desc: "Die meisten KI-Texte entstehen aus dem Gedächtnis des Modells. Genau deshalb erfinden sie Statistiken und Quellenangaben, die einem Faktencheck nicht standhalten. InkMagnet durchsucht zuerst das Live-Web zu Ihrem Thema, liest echte Quellen und stützt jedes Kapitel darauf. So verweisen Zahlen, Namen und Belege auf Dinge, die es wirklich gibt.",
      },
      {
        title: "Ein ganzes Buch statt einer langen Antwort",
        desc: "Ein Buch mit 120 Seiten passt nicht in eine einzelne Chat-Antwort. Ein Chatbot kürzt, wiederholt sich und hat Kapitel 2 bei Kapitel 9 längst vergessen. InkMagnet plant zuerst die Struktur, schreibt dann jedes Kapitel und prüft es gegen die anderen, damit Begriffe, Argumente und Ton vom Cover bis zum Schlusswort einheitlich bleiben.",
      },
      {
        title: "Satz, Illustrationen und fertige Dateien inklusive",
        desc: "Echte Bücher sind kein Markdown. Jedes Projekt wird mit LaTeX kompiliert (dem System hinter wissenschaftlichen Publikationen), mit klickbarem Inhaltsverzeichnis, korrekter Silbentrennung, Initialen, gestalteten Tabellen und KI-Illustrationen pro Kapitel. Sie erhalten ein druckfertiges PDF und ein shopfertiges EPUB mit gestaltetem Cover, keine Textwüste, die Sie selbst formatieren müssen.",
      },
    ],
  },
  compare: {
    title: "„Kann ich nicht einfach ChatGPT oder Claude nehmen?“",
    sub: "In einem Chatfenster können Sie Text schreiben. Ein fertiges, verkaufsfähiges Buch liefert Ihnen ein Chatfenster aber nicht. Das müssen Sie selbst erledigen. Dieselbe Modellklasse, ein völlig anderes Ergebnis.",
    colA: "ChatGPT / Claude pur",
    colB: "InkMagnet",
    rows: [
      {
        label: "Was Sie tatsächlich bekommen",
        a: "Chatnachrichten, die Sie kopieren und selbst zusammensetzen",
        b: "Ein fertiges PDF + EPUB mit gestaltetem Cover",
      },
      {
        label: "Fakten und Quellen",
        a: "Aus dem Gedächtnis geschrieben, Quellenangaben sind daher häufig erfunden",
        b: "Live-Web-Recherche, gestützt auf überprüfbare, zitierte Quellen",
      },
      {
        label: "Bücher in voller Länge",
        a: "Kontextgrenzen führen zu Kürzungen, Wiederholungen und Brüchen zwischen den Kapiteln",
        b: "Das ganze Buch, Kapitel für Kapitel, durchgehend konsistent",
      },
      {
        label: "Satz",
        a: "Reiner Text oder Markdown, die Formatierung bleibt an Ihnen hängen",
        b: "Professionelles LaTeX: Inhaltsverzeichnis, Ränder, Silbentrennung, Initialen",
      },
      {
        label: "Cover und Bilder",
        a: "Keine, bestenfalls eine Beschreibung zum Nachbauen an anderer Stelle",
        b: "Gestaltetes Cover + KI-Illustrationen pro Kapitel",
      },
      {
        label: "Zeit für die Zusammenstellung",
        a: "Stunden mit Kopieren, Formatieren und Exportieren",
        b: "Automatisch: ein fertiges Buch in etwa einer Stunde",
      },
      {
        label: "Spätere Bearbeitung",
        a: "Neu prompten und neu einfügen, Ihre manuellen Änderungen gehen verloren",
        b: "Integrierter Editor, Ihre Änderungen bleiben erhalten, jederzeit neu kompilierbar",
      },
      {
        label: "Kosten",
        a: "Monatliches Abo + Ihre Zeit",
        b: "Ein fester Preis pro Buch, volle kommerzielle Nutzungsrechte",
      },
    ],
    note: "InkMagnet nutzt dieselbe Klasse von Spitzenmodellen, der Sie bereits vertrauen. Es bettet sie lediglich in die gesamte Publikationspipeline ein, damit Sie am Ende ein Buch in der Hand halten und kein Chatprotokoll.",
  },
  gallery: {
    title: "So sehen Ihre fertigen Seiten aus",
    sub: "Ein klickbares Inhaltsverzeichnis, klare Kapitelanfänge, gestaltete Infokästen und hervorgehobene Kennzahlen: das Buchdesign, mit dem jeder InkMagnet-Titel ausgeliefert wird.",
    items: [
      {
        caption: "Klickbares Inhaltsverzeichnis",
        alt: "Seite mit dem Inhaltsverzeichnis eines generierten Buches",
      },
      {
        caption: "Kapitelanfänge mit hervorgehobenen Zahlen",
        alt: "Kapitelanfang mit einer groß hervorgehobenen Statistik",
      },
      {
        caption: "Infokästen für Erkenntnisse und Fakten",
        alt: "Buchseite mit gestalteten Infokästen",
      },
      {
        caption: "Hervorgehobene Statistiken und Kennzahlen",
        alt: "Abschnittsanfang mit einer groß hervorgehobenen Kennzahl",
      },
    ],
    note: "Echte Seiten aus einem mit InkMagnet erstellten, englischsprachigen Buch, exportiert als PDF und EPUB.",
  },
  realApp: {
    title: "So sieht die Arbeit in InkMagnet aus",
    sub: "Echte Bildschirme eines fertigen Buches. Keine Mock-ups.",
    note: "Bildschirme aus der polnischen Ausgabe der App. Die Oberfläche ist vollständig auf Deutsch verfügbar.",
    items: [
      {
        title: "Ihr privates Buch-Dashboard",
        text: "Nur für Sie sichtbar: Cover, Seitenzahl, Sprache, Stil und ein Fortschrittsbalken. Vor der Zahlung finden Sie hier Ihr kostenloses Inhaltsverzeichnis und die zweiseitige Leseprobe. Nach der Zahlung verfolgen Sie Recherche, Schreiben und Satz, bis das Buch fertig ist.",
        alt: "InkMagnet-Buch-Dashboard mit Cover und Fortschrittsbalken",
      },
      {
        title: "Kapitel, die Sie einzeln öffnen können",
        text: "Das fertige Buch ist eine Liste von Kapiteln mit Wortzahlen. Öffnen Sie ein beliebiges Kapitel, lesen Sie, korrigieren Sie einen Satz, ergänzen Sie einen Absatz.",
        alt: "Kapitelliste im InkMagnet-Editor",
      },
      {
        title: "Ein visueller Editor, wie eine Textverarbeitung",
        text: "Überschriften, Fettdruck, Listen, Infokästen, Tabellen und Bilder: Sie bearbeiten den Text wie in Word, und das Buch wird für Sie neu gesetzt. Für Neugierige ist der reine LaTeX-Modus nur einen Klick entfernt.",
        alt: "Visueller Kapitel-Editor von InkMagnet",
      },
    ],
  },
  appShowcase: {
    title: "Eine Oberfläche für alle Ihre Bücher",
    sub: "Cover, Generierungsfortschritt und Downloads: Ihre gesamte Bibliothek an einem Ort.",
    alt: "Das InkMagnet-Dashboard",
  },
  mock: {
    urlDashboard: "app.inkmagnet.com/dashboard",
    urlNew: "app.inkmagnet.com/projects/new",
    urlProject: "app.inkmagnet.com/projects/8f2a",
    dashTitle: "Meine Bücher",
    newBook: "Neues Buch",
    newBookShort: "Neu",
    statusDone: "Fertig",
    statusWriting: "Wird geschrieben…",
    pagesWord: "Seiten",
    chaptersWord: "Kapitel",
    books: [
      {
        title: "Das Lean-SaaS-Launch-Playbook",
        author: "Jonas Richter",
        pages: 60,
        fmt: "A5",
        status: "done",
        pct: 0,
      },
      {
        title: "Gewohnheiten für Gründer",
        author: "Mara Lindqvist",
        pages: 84,
        fmt: "B5",
        status: "writing",
        pct: 62,
      },
      {
        title: "Handbuch für Remote-Teams",
        author: "Daniel Okoro",
        pages: 72,
        fmt: "A5",
        status: "done",
        pct: 0,
      },
      {
        title: "Designsysteme von A bis Z",
        author: "Sofia Marchetti",
        pages: 96,
        fmt: "A4",
        status: "done",
        pct: 0,
      },
      {
        title: "Die mediterrane Küche",
        author: "Elena Costa",
        pages: 120,
        fmt: "B5",
        status: "done",
        pct: 0,
      },
      {
        title: "Achtsam produktiv",
        author: "Tom Becker",
        pages: 56,
        fmt: "A5",
        status: "done",
        pct: 0,
      },
      {
        title: "Praxisleitfaden für Freelancer",
        author: "Priya Nair",
        pages: 68,
        fmt: "A5",
        status: "done",
        pct: 0,
      },
      {
        title: "Private Finanzen verständlich erklärt",
        author: "Christian Hahn",
        pages: 90,
        fmt: "B5",
        status: "done",
        pct: 0,
      },
    ],
    book: {
      title: "Das Lean-SaaS-Launch-Playbook",
      author: "Jonas Richter",
      topic:
        "Ein praktischer Leitfaden für den Start eines profitablen SaaS im Jahr 2025, geschrieben für Gründer ohne technischen Hintergrund. Validierung der Idee, ein schlankes MVP, die ersten zehn Kunden und die Preisgestaltung. Einfache Sprache, echte Beispiele, eine Checkliste nach jedem Kapitel.",
      chapters: [
        {
          n: 1,
          title: "Die Idee validieren",
          pages: 8,
          sections: [
            "Ein drängendes Problem finden",
            "Preis und Zahlungsbereitschaft",
          ],
        },
        { n: 2, title: "Das MVP bauen", pages: 9, sections: [] },
        {
          n: 3,
          title: "Die ersten Kunden gewinnen",
          pages: 11,
          sections: [],
        },
        { n: 4, title: "Preise und Pakete", pages: 8, sections: [] },
      ],
      tocTitle: "Inhalt",
      toc: [
        { label: "Einleitung", page: 1 },
        { label: "1  Die Idee validieren", page: 7 },
        { label: "2  Das MVP bauen", page: 21 },
        { label: "3  Die ersten Kunden gewinnen", page: 38 },
        { label: "4  Preise und Pakete", page: 55 },
        { label: "5  Skalieren, was funktioniert", page: 72 },
        { label: "Schlusswort", page: 88 },
      ],
      chapterLabel: "Kapitel 3",
      chapterTitle: "Die ersten Kunden gewinnen",
      dropcap: "D",
      body: "ie meisten Gründer sind vom Produkt besessen und vergessen das schwierigere Problem: jemanden zu finden, irgendjemanden, der dafür bezahlt. Die ersten zehn Kunden kommen selten über Anzeigen oder Growth Hacks. Sie kommen aus Gesprächen, die Sie einzeln führen, an den Orten, an denen sich Ihre künftigen Nutzer ohnehin aufhalten.",
      body2:
        "Beginnen Sie dort, wo der Schmerz am lautesten ist. Erfassen Sie die drei Communitys, in denen sich Ihre Käufer bereits über das Problem beklagen, das Sie lösen, und treten Sie dort als Teilnehmer auf, nicht als Werbetreibender.",
      tableTitle: "Tabelle 3.1: Akquisekanäle nach Kosten und Tempo",
      tableCols: ["Kanal", "Kosten", "Erster Lead"],
      tableRows: [
        ["Kaltakquise", "€", "1–3 Tage"],
        ["Communitys", "kostenlos", "~1 Woche"],
        ["Content / SEO", "€€", "2–3 Monate"],
        ["Bezahlte Anzeigen", "€€€", "am selben Tag"],
      ],
      insightLabel: "Kernerkenntnis",
      insightText:
        "Bei Ihren ersten zehn Kunden schlägt die direkte Ansprache jeden bezahlten Kanal. Sie kostet nichts außer Zeit und zeigt Ihnen genau die Worte, die Ihre Käufer verwenden.",
      figCaption:
        "Abbildung 4.2. Eine einfache Preisstaffel: eine kostenlose Testphase, ein Basistarif und ein Premiumtarif für Teams.",
    },
    ui: {
      createNewBook: "Neues Buch erstellen",
      topicLabel: "Beschreiben Sie Ihr Buch",
      topicCounter: "412 / 15000",
      bookSize: "Umfang",
      popular: "Beliebt",
      tierStandard: "Standard · 60 Seiten",
      tierComprehensive: "Comprehensive · 120 Seiten",
      colorScheme: "Farben",
      optional: "optional",
      colorAuto: "Automatisch (passend zum Thema)",
      seeContents: "Inhaltsverzeichnis meines Buches kostenlos ansehen",
      bookStructure: "Inhaltsverzeichnis",
      freePreview: "Kostenlose Vorschau",
      bookTitleLabel: "Buchtitel",
      addChapter: "Kapitel hinzufügen",
      redoOnce: "Neue Version (1×)",
      payAndWrite: "Gefällt mir: {price} zahlen und schreiben lassen",
      generatingBook: "Ihr Buch wird erstellt",
      remaining: "noch ~6 Min.",
      phaseResearch: "Recherche und Quellenanalyse",
      phaseWriting: "Texterstellung",
      phaseReview: "Prüfung und Überarbeitung",
      phasePdf: "PDF-Kompilierung",
      phaseEpub: "EPUB-Erstellung",
      inProgress: "Läuft",
      doneBadge: "Fertig",
      written: "2/8 geschrieben",
      pagesTarget: "Ziel: 60 Seiten",
      chaptersStat: "8 Kapitel",
      downloadBook: "Ihr Buch herunterladen",
      versions: "Versionen",
      downloadPdf: "PDF herunterladen",
      pdfDesc: "Druckfertig, gestaltetes Layout",
      downloadEpub: "EPUB herunterladen",
      epubDesc: "Kindle, Apple Books, Kobo",
      latest: "v3 (aktuell)",
      versionMeta: "15. Juni, 14:08 · 4,2 MB · 60 Seiten",
    },
    editor: {
      heading: "Buchinhalt bearbeiten",
      visual: "Visuell",
      code: "LaTeX",
      save: "Speichern",
      unsaved: "2 ungespeichert",
      editing: "Kapitel in Bearbeitung",
    },
  },
  sourcing: {
    title: "Woher die Tiefe kommt",
    sub: "Die meisten KI-Texte sind eine selbstsichere Vermutung aus Trainingsdaten. InkMagnet baut jedes Buch auf echten Quellen auf, die es bei der Erstellung liest, und auf einer Struktur, die geplant ist, bevor der erste Satz entsteht.",
    items: [
      {
        title: "Vollständige Quellen statt Textschnipsel",
        desc: "Für jedes Buch durchsucht die Engine das Live-Web und liest Dutzende vollständiger Seiten und wissenschaftlicher Dokumente von Anfang bis Ende, nicht die zweizeiligen Vorschauen einer Suchmaske. Zahlen, Namen und Quellenangaben stammen aus dem, was in den Quellen tatsächlich steht.",
      },
      {
        title: "Erst die Struktur, dann der Satz",
        desc: "Zuerst wird das gesamte Buch geplant (Kapitel, Abschnitte und ein Recherche-Briefing für jedes davon), dann wird nach diesem Plan geschrieben. So weiß jedes Kapitel, was die anderen behandeln. Kein Abschweifen, keine Wiederholungen, keine losen Enden.",
      },
      {
        title: "Geprüft und dann überarbeitet",
        desc: "Nach dem ersten Entwurf prüft ein KI-Lektor die Abdeckung, kürzt redundante Passagen und schließt Lücken. Das ist der Lektoratsdurchgang, den ein Buch vor der Auslieferung bekommt, kein Text aus einem einzigen Durchlauf.",
      },
      {
        title: "Fundiert und eigenständig",
        desc: "Weil aus gerade gelesenen Quellen geschrieben wird und nicht aus dem Gedächtnis, ist der Text aktuell, konkret und Ihrer: geschrieben für genau Ihr Thema, Ihre Zielgruppe und Ihren Blickwinkel.",
      },
    ],
  },
  universality: {
    title: "Was sich recherchieren lässt, kann ein Buch werden",
    sub: "InkMagnet ist nicht an eine Nische gebunden. Dieselbe Pipeline recherchiert und schreibt ein Kochbuch, einen Begleitband zur Abschlussarbeit, ein SaaS-Playbook oder ein Kurshandbuch zu praktisch jedem Thema: auf Deutsch, Englisch, Polnisch, Spanisch (Spanien oder Lateinamerika) oder Portugiesisch (Portugal oder Brasilien).",
    topics: [
      "Business und Start-ups",
      "Marketing und Vertrieb",
      "Private Finanzen",
      "Gesundheit und Ernährung",
      "Kochen und Rezepte",
      "Wissenschaft und Abschlussarbeiten",
      "Psychologie und Selbsthilfe",
      "Technologie und Programmierung",
      "Bildung und Kurse",
      "Reisen und Lifestyle",
      "Recht und Compliance",
      "Erziehung",
      "Fitness und Sport",
      "Hobbys und Handwerk",
      "Karriere und Produktivität",
      "Wissenschaft verständlich erklärt",
    ],
    note: "Sie wählen das Thema. InkMagnet übernimmt das Lesen.",
  },
  editorSection: {
    title: "Ein Absatz gefällt Ihnen nicht? Drei Wege, ihn zu ändern.",
    sub: "Jedes fertige Buch öffnet sich in einem vollwertigen Editor. Schreiben Sie die Stelle selbst um, sagen Sie der KI, was sie in einem Kapitel oder Abschnitt ändern soll, und übernehmen Sie das Ergebnis nur, wenn es Ihnen gefällt, oder geben Sie die Korrektur an unseren Lektor. Erzeugen Sie anschließend ein frisches PDF. Ihre manuellen Änderungen werden nie überschrieben.",
    points: [
      "Mit KI verbessern: Sie beschreiben die Änderung, sehen sie zuerst und entscheiden, ob Sie sie übernehmen (3 pro Buch)",
      "Von einem Menschen prüfen lassen: Sie beschreiben, was nicht stimmt, und ein Lektor korrigiert es von Hand, kostenlos (bis zu 3 Anfragen pro Buch)",
      "Visuell oder LaTeX: Bearbeiten Sie, wie Sie möchten",
      "Überschriften, Fettdruck, Listen, Zitate, Infokästen, Tabellen und Bilder",
      "Versionsverlauf: Jede neue Kompilierung wird gespeichert",
      "Ihre Änderungen sind unantastbar: Eine erneute Generierung überschreibt sie nie",
    ],
  },
  interiorReader: {
    title: "Echte Bücher statt einer Textwüste",
    sub: "Öffnen Sie ein E-Book von InkMagnet und Sie sehen echtes Buchdesign: ein klickbares Inhaltsverzeichnis, Kapitelanfänge mit Initialen, gestaltete Tabellen, Infokästen und passende Illustrationen, gesetzt mit dem System hinter wissenschaftlichen Publikationen. Liest sich auf jedem Gerät hervorragend.",
    note: "Echte Innenseiten aus einem mit InkMagnet erstellten Buch.",
    device: "Kindle · Tablets · Smartphones · Druck",
  },
  useCases: {
    title: "Gemacht für alle, die Bücher brauchen, die etwas bewirken",
    items: [
      {
        title: "Lead-Magnete",
        desc: "Ein gehaltvolles E-Book im eigenen Branding konvertiert besser als eine zweiseitige Checkliste. Veröffentlichen Sie eines pro Kampagne.",
      },
      {
        title: "Kursanbieter",
        desc: "Verpacken Sie Ihren Lehrplan als Begleitbuch, das Ihre Teilnehmer behalten können.",
      },
      {
        title: "Trainer und Berater",
        desc: "Ein Buch mit Ihrem Namen auf dem Cover ist nach wie vor der stärkste Vertrauensbeweis, den es gibt.",
      },
      {
        title: "Agenturen",
        desc: "Liefern Sie Kunden-E-Books in Tagen statt in Wochen, zu einem Bruchteil des Honorars eines Ghostwriters.",
      },
      {
        title: "Autoren und Fachexperten",
        desc: "Machen Sie aus dem Wissen in Ihrem Kopf ein glaubwürdiges Buch mit Ihrem Namen auf dem Cover, ohne sechs Monate lang selbst daran zu schreiben.",
      },
      {
        title: "Marketing- und Content-Teams",
        desc: "Erstellen Sie bei Bedarf E-Books hinter einem Formular, Whitepaper und Ratgeber, jeweils gestützt auf echte Recherche und vom Cover bis zur letzten Seite im Markenauftritt.",
      },
    ],
  },
  valueAnchor: {
    title: "Was ein solches Buch überall sonst kostet",
    sub: "InkMagnet bündelt Recherche, Schreiben, Prüfung, Satz, Cover und Dateien in einer einzigen Zahlung. Wer diese Leistungen einzeln einkauft, landet schnell bei unschönen Summen.",
    items: [
      {
        label: "KI-„Buch“-Generatoren",
        cost: "30–90 $ pro Monat",
        note: "Ein Abo, und am Ende steht ein Rohentwurf, den Sie noch selbst formatieren müssen.",
      },
      {
        label: "Satzprogramme (Atticus, Vellum)",
        cost: "147–250 $ einmalig",
        note: "Formatieren nur ein fertiges Manuskript. Das ganze Buch müssen Sie trotzdem selbst schreiben.",
      },
      {
        label: "Satz durch Freelancer",
        cost: "200–1.000 $ pro Buch",
        note: "Pro Buch, jedes Mal. Ein gestaltetes Cover kostet extra.",
      },
      {
        label: "Ghostwriter + Coverdesigner",
        cost: "mehrere Tausend $",
        note: "Wochenlanges Hin und Her für ein einziges fertiges Buch.",
      },
    ],
    usLabel: "InkMagnet",
    usPre: "ab",
    usNote:
      "Recherche, Schreiben, Prüfung, Satz, Cover, PDF + EPUB. Eine Zahlung, volle kommerzielle Nutzungsrechte, kein Abo.",
    foot: "Die Vergleichswerte sind marktübliche Preise aus dem Jahr 2025 und variieren je nach Anbieter.",
  },
  pricing: {
    title: "Ein Preis pro Buch. Nichts Wiederkehrendes.",
    sub: "Sie zahlen erst, wenn Ihnen die Gliederung gefällt. Der Titel, das vollständige Inhaltsverzeichnis und eine zweiseitige Leseprobe im Zielstil sind kostenlos. Recherche, Schreiben, Illustrationen, Cover, PDF und EPUB: Alles ist inklusive.",
    perBook: "pro Buch",
    pages: "Seiten",
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
    note: "Volle kommerzielle Nutzungsrechte. Unbegrenzte Bearbeitungen und Neukompilierungen für jedes gekaufte Buch.",
    cta: "Erstes Buch kostenlos planen",
  },
  faq: {
    title: "Häufig gestellte Fragen",
    items: [
      {
        q: "Wem gehören die Bücher, die ich erstelle?",
        a: "Ihnen. Jedes Buch kommt mit vollen kommerziellen Nutzungsrechten: Verkaufen Sie es, verschenken Sie es als Lead-Magnet, veröffentlichen Sie es unter Ihrem Namen.",
      },
      {
        q: "Wie lange dauert es?",
        a: "Titel und Inhaltsverzeichnis sind in weniger als einer Minute fertig, noch vor der Zahlung, und die optionale zweiseitige Leseprobe dauert etwa eine weitere Minute. Nach der Zahlung braucht ein vollständiges Buch (recherchiert, geschrieben, illustriert, gesetzt und kompiliert) in der Regel weniger als eine Stunde.",
      },
      {
        q: "Kann ich mein Buch sehen, bevor ich zahle?",
        a: "Ja. Kostenlos erhalten Sie den Titel und das vollständige Inhaltsverzeichnis: Kapitel und Abschnitte, jeweils mit einer kurzen Beschreibung. Sie bearbeiten es wie ein gewöhnliches Dokument: umbenennen, Beschreibungen umschreiben, Kapitel und Abschnitte hinzufügen oder entfernen. Wünschen Sie einen anderen Ansatz, erstellt die KI anhand Ihrer Anmerkungen eine neue Version, und Sie entscheiden sich für Version 1 oder Version 2. Außerdem können Sie eine kostenlose zweiseitige Leseprobe anfordern: den Anfang von Kapitel 1, geschrieben und gesetzt genau wie das fertige Buch. Lassen Sie Stil und Farben auf „Automatisch“, wählt die KI passende für Ihr Thema. Sie zahlen erst, wenn Sie mit der Gliederung zufrieden sind.",
      },
      {
        q: "Welche Sprachen werden unterstützt?",
        a: "Die Sprache des Buches wählen Sie beim Anlegen des Projekts. Deutsch, Englisch, Polnisch, Spanisch (Spanien oder Lateinamerika) und Portugiesisch (Portugal oder Brasilien) werden vollständig unterstützt, einschließlich sprachspezifischer Typografie und Silbentrennung. Die regionalen Varianten unterscheiden sich im Wortschatz und in den Formulierungen, nicht nur in der Schreibweise.",
      },
      {
        q: "Kann ich den Inhalt bearbeiten?",
        a: "Ja, auf drei Wegen. Jedes Kapitel lässt sich im integrierten WYSIWYG-Editor bearbeiten, und Ihre manuellen Änderungen werden von späteren Generierungen nie überschrieben. Sie können außerdem der KI sagen, was sie in einem Kapitel oder Abschnitt ändern soll (kürzen, vereinfachen, ein Beispiel ergänzen): Sie sehen die Änderung, bevor sie übernommen wird, und können sie rückgängig machen, dreimal pro Buch. Und wenn etwas schlicht falsch ist, nutzen Sie „Von einem Menschen prüfen lassen“: Sie beschreiben das Problem, und unser Lektor korrigiert das Buch von Hand, kostenlos, bis zu drei Anfragen pro Buch. PDF und EPUB können Sie beliebig oft neu erzeugen.",
      },
      {
        q: "Ist der Inhalt ein Original?",
        a: "Jedes Buch wird für Ihr konkretes Thema, Ihre Zielgruppe und Ihre Vorgaben von Grund auf neu geschrieben, gestützt auf Live-Web-Recherche mit zitierten Quellen. Kein Buch gleicht dem anderen.",
      },
      {
        q: "Was genau lade ich herunter?",
        a: "Ein PDF in Druckqualität (mit gestaltetem Cover, klickbarem Inhaltsverzeichnis und professionellem Satz) sowie ein EPUB, das auf Kindle, Apple Books, Kobo und in E-Book-Shops funktioniert.",
      },
      {
        q: "Warum nicht einfach ChatGPT oder Claude verwenden?",
        a: "Diese Tools schreiben Text in einem Chatfenster. Recherche, Faktencheck, Struktur, Formatierung, Covergestaltung und Export bleiben weiterhin an Ihnen hängen. InkMagnet nutzt dieselbe Modellklasse, ergänzt sie aber um Live-Web-Recherche, Konsistenz über das gesamte Buch, professionellen Satz, ein gestaltetes Cover und den Export als PDF/EPUB. Sie erhalten ein fertiges Buch und kein Chatprotokoll, das Sie erst zusammensetzen müssen.",
      },
      {
        q: "Worin unterscheidet sich das von anderen KI-Buchtools?",
        a: "Die meisten „KI-Buch“-Tools verpacken einen Chatbot und liefern Ihnen einen langen Blogartikel in einem PDF. InkMagnet recherchiert Ihr Thema live im Web, erzeugt mit LaTeX echten Buchsatz, generiert ein gestaltetes Cover und passende Illustrationen und bewahrt Ihre manuellen Änderungen über alle Neukompilierungen hinweg.",
      },
      {
        q: "Brauche ich Kenntnisse im Schreiben, Gestalten oder Formatieren?",
        a: "Nein. Sie beschreiben das Buch in einem einzigen Feld (ein Satz genügt, ein ausführliches Briefing ist besser), und alles andere, vom Stil bis zu den Farben, kann auf „Automatisch“ bleiben. Die Pipeline übernimmt Recherche, Schreiben, Layout, Cover und Export. Möchten Sie etwas ändern, ist der integrierte Editor ein schlichter WYSIWYG-Editor, ganz ohne LaTeX und ohne Designsoftware.",
      },
    ],
  },
  finalCta: {
    title: "Ihr Buch ist nur ein Formular entfernt",
    sub: "Beschreiben Sie Ihr Buch noch heute, sehen Sie sein Inhaltsverzeichnis kostenlos und laden Sie das fertige E-Book innerhalb einer Stunde nach der Zahlung herunter.",
    // No amount here on purpose: EUR prices are converted at build time and
    // rendered next to the copy (see lib/rate.ts), never hard-coded.
    cta: "Gliederung kostenlos ansehen. Ein Preis pro Buch, kein Abo",
  },
  phone: {
    time: "9:41",
    books: {
      title: "Meine Bücher",
      items: [
        { title: "Das Lean-SaaS-Launch-Playbook", meta: "60 Seiten · DE · premium", status: "Fertig", state: "done" },
        { title: "Gewohnheiten für Gründer", meta: "84 Seiten · DE · modern", status: "Wird geschrieben…", state: "writing" },
        { title: "Handbuch für Remote-Teams", meta: "72 Seiten · DE · modern", status: "Fertig", state: "done" },
      ],
    },
    create: {
      title: "Neues Buch",
      topicLabel: "Beschreiben Sie Ihr Buch",
      topicPlaceholder: "z. B. Heißluftfritteuse: 60 einfache Alltagsrezepte für Familien mit wenig Zeit, mit Einkaufslisten",
      styleLabel: "Stil und Farben",
      styleValue: "Automatisch",
      langLabel: "Sprache des Buches",
      langs: ["Deutsch", "English"],
      sizeLabel: "Umfang",
      sizes: [
        { name: "Compact", pages: "30–40 Seiten" },
        { name: "Standard", pages: "50–70 Seiten" },
        { name: "Extended", pages: "80–100 Seiten" },
      ],
    },
    detail: {
      title: "Krafttraining zu Hause",
      status: "Fertig",
      progressLabel: "Fortschritt",
      steps: ["Gliederung", "Leseprobe", "Zahlung", "Schreiben", "Satz", "Fertig"],
      downloadLabel: "Herunterladen",
      pdf: "PDF öffnen",
      epub: "EPUB öffnen",
      webLink: "Kapitel in der Web-App bearbeiten",
    },
  },
  appPromo: {
    badge: "Neu: Android-App",
    title: "Jetzt starten Sie ein Buch auch vom Smartphone aus",
    sub: "InkMagnet gibt es als Android-App. Beschreiben Sie ein Buch im Bus, prüfen Sie das kostenlose Inhaltsverzeichnis beim Kaffee, öffnen Sie das fertige PDF im Zug nach Hause. Dasselbe Konto, dieselben Bücher, dieselbe Engine wie in der Web-App.",
    points: [
      "Sehen Sie vor dem Kauf die kostenlose Gliederung und eine zweiseitige Leseprobe und verfolgen Sie danach jede Phase live: Recherche, Schreiben, Satz.",
      "Öffnen Sie das fertige PDF und EPUB direkt auf dem Smartphone.",
      "Zahlen Sie einmal pro Buch über Google Play. Kein Abo.",
      "Kapitel, die Sie im Web bearbeitet haben, bleiben genau so, wie Sie sie hinterlassen haben.",
    ],
    cta: "Jetzt bei Google Play",
    more: "Mehr über die App",
    note: "Erfordert Android 7.0 oder neuer. Der vollständige Kapitel-Editor bleibt in der Web-App.",
  },
  appPage: {
    badge: "Android-App",
    title1: "Der KI-E-Book-Generator,",
    titleAccent: "in Ihrer Tasche",
    sub: "InkMagnet für Android macht aus einem Thema ein fertiges Buch: live im Web recherchiert, Kapitel für Kapitel geschrieben, illustriert, gesetzt und als PDF in Druckqualität und als EPUB geliefert. Bestellen Sie es vom Smartphone aus, sehen Sie zu, wie es entsteht, und lesen Sie es, sobald es da ist.",
    bullets: ["Kostenlose Installation", "Eine Zahlung pro Buch", "PDF + EPUB auf dem Smartphone"],
    ctaSecondary: "Beispielseiten ansehen",
    screens: {
      title: "Drei Bildschirme, der gesamte Ablauf",
      sub: "Nichts ist nur am Desktop möglich: Bestellen, Verfolgen und Herunterladen funktionieren vollständig auf dem Smartphone.",
      items: [
        {
          title: "Ihre Bibliothek",
          text: "Jedes Buch, das Sie bestellt haben, mit seinem aktuellen Status: wartet auf Zahlung, Planung, Schreiben, Satz, fertig. Bücher, die Sie im Browser begonnen haben, erscheinen hier ebenfalls, denn es ist ein Konto und nicht zwei Produkte.",
        },
        {
          title: "Ein neues Buch bestellen",
          text: "Beschreiben Sie Ihr Buch in einem Feld und wählen Sie einen von fünf Umfängen, von 30 bis 200 Seiten. Sie erhalten eine kostenlose Gliederung mit dem vollständigen Inhaltsverzeichnis, eine Neufassung durch die KI anhand Ihrer Anmerkungen und eine kostenlose zweiseitige Leseprobe. Erst dann zahlen Sie über Google Play, und die Pipeline startet innerhalb von Sekunden.",
        },
        {
          title: "Verfolgen und herunterladen",
          text: "Eine Leiste mit sechs Phasen zeigt genau, wo Ihr Buch steht: Gliederung, Leseprobe, Zahlung, Schreiben, Satz, fertig. Ist es fertig, öffnen sich PDF und EPUB direkt aus der App.",
        },
      ],
    },
    why: {
      title: "Warum sich die App auf dem Smartphone lohnt",
      sub: "Ein Buch entsteht in etwa einer Stunde. Dank der App verbringen Sie diese Stunde, wo Sie möchten.",
      items: [
        {
          title: "Bestellen Sie in den zwei Minuten, die Sie wirklich haben",
          desc: "Eine Warteschlange, der Arbeitsweg, ein Wartezimmer. Das Buch zu beschreiben dauert eine Minute, und die Engine arbeitet, während Sie Ihren Tag fortsetzen.",
        },
        {
          title: "Prüfen Sie die Gliederung dort, wo Sie gerade sind",
          desc: "Das Inhaltsverzeichnis ist die eine Entscheidung, die alles Weitere prägt, und Sie sehen es kostenlos, vor der Zahlung. Bearbeiten Sie es, lassen Sie die KI eine neue Version erstellen, sehen Sie sich eine zweiseitige Leseprobe an. Dafür sollte niemand einen Laptop brauchen.",
        },
        {
          title: "Lesen Sie auf dem Gerät, auf dem Sie ohnehin lesen",
          desc: "Das fertige PDF und EPUB öffnen sich in der App. Ein Buch, das um neun Uhr morgens generiert wurde, lesen Sie abends auf dem Sofa, ohne Dateien zwischen Geräten zu verschieben.",
        },
        {
          title: "Zahlen Sie über Google Play",
          desc: "Sobald Ihnen die Gliederung gefällt, läuft die Zahlung über das Play-Konto, das Sie bereits haben, in Ihrer Landeswährung. Um Beleg und Erstattungsrichtlinie kümmert sich Google.",
        },
      ],
    },
    split: {
      title: "App und Web teilen sich ein Konto",
      sub: "Zwei Fenster zu denselben Büchern, und jedes kann etwas besser.",
      appTitle: "Das erledigen Sie in der App",
      appItems: [
        "Ein Buch beschreiben und seine kostenlose Gliederung samt zweiseitiger Leseprobe ansehen",
        "Das Inhaltsverzeichnis bearbeiten oder eine neue Version von der KI erhalten",
        "Über Google Play zahlen, sobald Ihnen die Gliederung gefällt",
        "Die Erstellung Phase für Phase verfolgen",
        "Das fertige PDF und EPUB öffnen, lesen und teilen",
      ],
      webTitle: "Das erledigen Sie im Browser",
      webItems: [
        "Kapiteltexte im vollwertigen Editor bearbeiten",
        "Ein einzelnes Kapitel oder eine Illustration neu generieren",
        "PDF und EPUB nach Änderungen neu kompilieren",
        "Cover-Varianten und Typografie verwalten",
      ],
      note: "Manuelle Änderungen aus dem Browser werden durch nichts überschrieben, was Sie in der App tun.",
    },
    price: {
      title: "Derselbe Preis, anders bezahlt",
      body: "In der App ist ein Buch ein einmaliger In-App-Kauf über Google Play, abgerechnet in Ihrer eigenen Währung und inklusive lokaler Steuern. Deshalb entspricht der Betrag auf dem Smartphone nicht eins zu eins dem Preis auf dieser Website. Keine der beiden Varianten hat ein Abo, und ein in der App gekauftes Buch ist dasselbe Buch: volle kommerzielle Nutzungsrechte, kein Wasserzeichen.",
    },
    faq: {
      title: "Fragen zur App",
      items: [
        {
          q: "Ist die App kostenlos?",
          a: "Die Installation und das Stöbern in der App sind kostenlos. Sie zahlen erst, wenn Sie ein konkretes Buch bestellen, als einmaligen In-App-Kauf über Google Play.",
        },
        {
          q: "Brauche ich ein separates Konto?",
          a: "Nein. Es ist dasselbe InkMagnet-Konto wie im Web. Melden Sie sich auf dem Smartphone an, und Ihre vorhandenen Bücher sind da. Bestellen Sie auf dem Smartphone, und das Buch erscheint im Browser.",
        },
        {
          q: "Kann ich Kapitel in der App bearbeiten?",
          a: "Noch nicht. Die App führt Sie von der Idee zum fertigen, herunterladbaren Buch. Kapiteltexte schreiben Sie im Web-Editor um, und die App verlinkt direkt dorthin.",
        },
        {
          q: "Gibt es eine iPhone-Version?",
          a: "Derzeit nicht. Unter iOS läuft die Web-App in Safari, sodass Sie Bücher von dort aus bestellen, verfolgen und herunterladen können.",
        },
        {
          q: "Welche Android-Version brauche ich?",
          a: "Android 7.0 (Nougat) oder neuer.",
        },
        {
          q: "Was passiert, wenn ich die App schließe, während ein Buch geschrieben wird?",
          a: "Nichts wird unterbrochen. Die gesamte Pipeline läuft auf unseren Servern. Sie können also die App schließen, den Empfang verlieren oder das Smartphone neu starten: Das Buch entsteht weiter und wartet auf Sie, wenn Sie zurückkommen.",
        },
      ],
    },
    final: {
      title: "Installieren Sie die App und beginnen Sie Ihr erstes Buch",
      sub: "Kostenlose Installation. Eine Zahlung pro Buch, wann immer Sie eines erstellen möchten.",
    },
  },
  footer: {
    tagline: "Professionelle, von KI geschriebene E-Books mit echtem Buchsatz.",
    product: "Produkt",
    legal: "Rechtliches",
    privacy: "Datenschutz",
    terms: "AGB",
    contact: "Kontakt",
    rights: "Alle Rechte vorbehalten.",
  },
} as const;
