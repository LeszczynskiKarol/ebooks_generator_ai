---
title: "What LaTeX typesetting does for a book that Word and Canva can't"
seoTitle: "LaTeX typesetting vs Word and Canva"
description: "Knuth-Plass line breaking, pattern-based hyphenation and microtype kerning explained, and why Springer, Elsevier and IEEE still run submissions through LaTeX."
lang: en
pubDate: 2026-09-02
translationOf: co-latex-daje-twojej-ksiazce
heroImage: ../../assets/blog/what-latex-does-for-your-book-hero.jpg
heroAlt: "A wooden compositor's type case filled with rows of metal printing letterforms, a marked-up galley proof and a printer's loupe resting beside a small finished deep indigo clothbound book"
coverPrompt: "A single small deep indigo clothbound hardcover book standing closed on a dark oak desk, its spine and cover completely blank without any lettering, beside a brass printer's loupe, a bone folder and a spool of binding thread, warm side light from a desk lamp, soft dark background, shallow depth of field"
eyebrow: "CRAFT"
---

Open a book laid out in Word next to one set in LaTeX and the difference doesn't announce itself. It's quieter than that: paragraphs that just look calmer, page breaks that never seem to fight the content, hyphens that land where a human editor would put them. None of it is decoration. It's forty years of typesetting research most writers never get to see, because Word and Canva were never built to run it.

## The paragraph Word never sees

Word breaks lines one at a time. It fills each line as full as it can, decides it's done, and moves to the next without looking back. That greedy, line-by-line approach is why justified text in Word produces rivers: pale vertical channels where the wide gaps Word inserted to stretch short lines happen to stack on top of each other down the page.

LaTeX's default line breaker uses the Knuth-Plass algorithm, published by Donald Knuth and Michael Plass, which scores an entire paragraph at once instead of one line at a time. It looks for the set of breaks that minimizes total "badness" across every line together, so a slightly tighter line early in the paragraph can prevent an ugly gap three lines later. The output reads as unremarkable, which is the whole point: nothing pulls your eye off the sentence.

## Hyphenation that actually knows the language

Canva and most Word templates ship with hyphenation off or barely tuned, which is exactly why so many self-published PDFs look loose or riddled with awkward line breaks. LaTeX's hyphenation comes from an algorithm Frank Liang built for his 1983 Stanford thesis: patterns compressed into a data structure called a packed trie, trained on real dictionaries, that predicts legal break points inside a word rather than guessing. Tested across nine languages, Liang's pattern method reaches roughly 96% mean word accuracy, and the English pattern set needs an exception list of just 14 words to cover the cases the patterns miss.

That's the difference between a hyphenation feature you toggle and a hyphenation system someone spent a doctoral thesis getting right. Liang's method is also language-agnostic by design: it doesn't encode English spelling rules directly, it learns break patterns from real hyphenated word lists, which is why the TeX community has since compiled equivalent pattern sets for dozens of other languages without rewriting the algorithm itself.

## The micro-adjustments no one names but everyone sees

LaTeX's microtype package adds two refinements no consumer tool touches. Character protrusion (sometimes called margin kerning) lets punctuation and a few letter shapes hang slightly past the text margin, so the block of text reads as optically straight instead of mechanically justified. Font expansion stretches or compresses individual glyphs by a fraction of a percent, line by line, so the line breaker has room to avoid a bad gap without visibly distorting a single word. Both run automatically on every paragraph through pdfTeX, XeTeX or LuaTeX. Canva's text boxes and Word's justification have neither option, at any zoom level.

## What ships beyond the paragraph

The same ecosystem that solves line breaking also standardizes the pieces around it: a clickable, auto-generated table of contents wired through the hyperref package rather than a hand-built list of page numbers, drop caps at chapter openers sized and positioned by the lettrine package instead of a stretched WordArt letter, tables ruled with the spacing conventions from the booktabs package instead of Word's default grid, and callout or insight boxes built as reusable tcolorbox environments instead of a text box someone nudges into place on every page. In a 150-page manuscript, that consistency isn't a nice-to-have. It's the only way every chapter opener, every table and every pull-quote box ends up looking like they came from the same book.

## The system behind academic publishing

This isn't a hobbyist toolchain. Springer, Elsevier and IEEE all run LaTeX internally, and a manuscript submitted in a compliant LaTeX class file can go close to straight to press, while a Word submission gets manually reformatted by someone on the publisher's side first. Physics, mathematics and computer science papers are typeset in LaTeX almost without exception, largely because equation-heavy documents expose exactly the line-breaking and spacing problems described above at their worst. None of that machinery was built with self-published nonfiction in mind, but a printed, professionally laid out ebook and a physics paper both need the same underlying algorithm to get justified text and page breaks right.

## What this means for the book you're actually making

You don't need to learn any of this to get the benefit of it. InkMagnet runs every chapter through this exact LaTeX pipeline (Knuth-Plass line breaking, pattern-based hyphenation, microtype kerning, a real hyperref table of contents, lettrine chapter openers, booktabs tables and tcolorbox insight callouts) automatically, the same system whether the finished book lands in the [30-45 page Compact tier at $9.99](/#pricing) or the 161-200 page Complete tier at $34.99. There's no template to configure and no export settings to fight. If you've been formatting drafts by hand in Word or Canva and wondering why the result never quite looks like a real book, [see what building the same book from a topic instead of a manuscript looks like](https://app.inkmagnet.com/auth/register), or read [what a dedicated typesetting tool like Atticus or Vellum still leaves you doing yourself](/blog/inkmagnet-vs-atticus-vellum/) once you've already written the words.

For the fuller picture of where a typeset, cover-designed book fits in a real production budget, [the full cost breakdown](/blog/cost-to-create-an-ebook/) prices formatting as its own separate line item, and [why AI-written books often read thin in the first place](/blog/ai-books-read-like-blog-posts/) covers the research side of the same pipeline.
