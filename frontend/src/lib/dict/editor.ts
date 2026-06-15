// i18n strings for: editor  (keys prefixed "editor.")
export const en: Record<string, string> = {
  // BookEditor — modes
  "editor.modeVisual": "Visual",
  "editor.modeVisualDesc": "Word-like editor — no LaTeX knowledge needed",
  "editor.modeCode": "Code",
  "editor.modeCodeDesc": "LaTeX source with syntax highlighting",
  "editor.modeSuffix": "mode",

  // BookEditor — states / header
  "editor.loadingChapters": "Loading chapters...",
  "editor.loadChaptersFailed": "Failed to load chapters",
  "editor.noChapters": "No chapters available for editing.",
  "editor.editYourBook": "Edit Your Book",
  "editor.chaptersCount": "{n} chapters",
  "editor.unsavedChange": "{n} unsaved change",
  "editor.unsavedChanges": "{n} unsaved changes",
  "editor.chapterAbbr": "CH {n}",
  "editor.words": "{n} words",
  "editor.pages": "~{n} pages",
  "editor.chars": "{n} chars",

  // BookEditor — toolbar / buttons
  "editor.undoAll": "Undo All",
  "editor.image": "Image",
  "editor.insertImage": "Insert image",
  "editor.codeHint": "Ctrl+F to search · Ctrl+Z to undo",
  "editor.saving": "Saving...",
  "editor.save": "Save",
  "editor.saved": "Saved",
  "editor.visualHint":
    "Visual editor — edit like in Word. Click an image to resize, reposition, or delete. Switch to Code mode for raw LaTeX.",

  // BookEditor — toasts
  "editor.chapterSaved": "Chapter {n} saved",
  "editor.saveChapterFailed": "Save chapter {n} failed",

  // WysiwygEditor — placeholder + content
  "editor.startWriting": "Start writing…",
  "editor.yourContentHere": "Your content here.",

  // WysiwygEditor — toolbar tooltips
  "editor.undo": "Undo (Ctrl+Z)",
  "editor.redo": "Redo (Ctrl+Y)",
  "editor.sectionHeading": "Section heading",
  "editor.subsectionHeading": "Subsection heading",
  "editor.bold": "Bold (Ctrl+B)",
  "editor.italic": "Italic (Ctrl+I)",
  "editor.underline": "Underline (Ctrl+U)",
  "editor.bulletList": "Bullet list",
  "editor.numberedList": "Numbered list",
  "editor.quote": "Quote",
  "editor.horizontalRule": "Horizontal rule",
  "editor.insertCallout": "Insert callout box",
  "editor.callout": "Callout",
  "editor.insertTable": "Insert table",
  "editor.addColumn": "Add column",
  "editor.addRow": "Add row",
  "editor.deleteTable": "Delete table",

  // Callout labels (user-visible: dropdown + inserted box title)
  "editor.calloutTipbox": "Tip",
  "editor.calloutKeyinsight": "Key Insight",
  "editor.calloutWarningbox": "Warning",
  "editor.calloutExamplebox": "Example",

  // ImageBlock — controls
  "editor.wrapLeft": "Wrap left",
  "editor.center": "Center",
  "editor.wrapRight": "Wrap right",
  "editor.removeImage": "Remove image",
  "editor.addCaption": "Add caption...",
};

export const pl: Record<string, string> = {
  // BookEditor — modes
  "editor.modeVisual": "Wizualny",
  "editor.modeVisualDesc": "Edytor jak w Wordzie — bez znajomości LaTeX-a",
  "editor.modeCode": "Kod",
  "editor.modeCodeDesc": "Źródło LaTeX z podświetlaniem składni",
  "editor.modeSuffix": "tryb",

  // BookEditor — states / header
  "editor.loadingChapters": "Wczytywanie rozdziałów...",
  "editor.loadChaptersFailed": "Nie udało się wczytać rozdziałów",
  "editor.noChapters": "Brak rozdziałów do edycji.",
  "editor.editYourBook": "Edytuj swoją książkę",
  "editor.chaptersCount": "{n} rozdziałów",
  "editor.unsavedChange": "{n} niezapisana zmiana",
  "editor.unsavedChanges": "{n} niezapisanych zmian",
  "editor.chapterAbbr": "ROZ {n}",
  "editor.words": "{n} słów",
  "editor.pages": "~{n} stron",
  "editor.chars": "{n} znaków",

  // BookEditor — toolbar / buttons
  "editor.undoAll": "Cofnij wszystko",
  "editor.image": "Obraz",
  "editor.insertImage": "Wstaw obraz",
  "editor.codeHint": "Ctrl+F szukaj · Ctrl+Z cofnij",
  "editor.saving": "Zapisywanie...",
  "editor.save": "Zapisz",
  "editor.saved": "Zapisano",
  "editor.visualHint":
    "Edytor wizualny — edytuj jak w Wordzie. Kliknij obraz, aby zmienić rozmiar, położenie lub go usunąć. Przełącz na tryb Kod, aby edytować surowy LaTeX.",

  // BookEditor — toasts
  "editor.chapterSaved": "Rozdział {n} zapisany",
  "editor.saveChapterFailed": "Nie udało się zapisać rozdziału {n}",

  // WysiwygEditor — placeholder + content
  "editor.startWriting": "Zacznij pisać…",
  "editor.yourContentHere": "Tutaj wpisz treść.",

  // WysiwygEditor — toolbar tooltips
  "editor.undo": "Cofnij (Ctrl+Z)",
  "editor.redo": "Ponów (Ctrl+Y)",
  "editor.sectionHeading": "Nagłówek sekcji",
  "editor.subsectionHeading": "Nagłówek podsekcji",
  "editor.bold": "Pogrubienie (Ctrl+B)",
  "editor.italic": "Kursywa (Ctrl+I)",
  "editor.underline": "Podkreślenie (Ctrl+U)",
  "editor.bulletList": "Lista punktowana",
  "editor.numberedList": "Lista numerowana",
  "editor.quote": "Cytat",
  "editor.horizontalRule": "Linia pozioma",
  "editor.insertCallout": "Wstaw ramkę informacyjną",
  "editor.callout": "Ramka",
  "editor.insertTable": "Wstaw tabelę",
  "editor.addColumn": "Dodaj kolumnę",
  "editor.addRow": "Dodaj wiersz",
  "editor.deleteTable": "Usuń tabelę",

  // Callout labels (user-visible: dropdown + inserted box title)
  "editor.calloutTipbox": "Wskazówka",
  "editor.calloutKeyinsight": "Kluczowy wniosek",
  "editor.calloutWarningbox": "Uwaga",
  "editor.calloutExamplebox": "Przykład",

  // ImageBlock — controls
  "editor.wrapLeft": "Oblewanie z lewej",
  "editor.center": "Wyśrodkuj",
  "editor.wrapRight": "Oblewanie z prawej",
  "editor.removeImage": "Usuń obraz",
  "editor.addCaption": "Dodaj podpis...",
};
