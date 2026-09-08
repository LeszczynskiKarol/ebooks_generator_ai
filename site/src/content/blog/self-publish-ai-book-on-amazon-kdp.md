---
title: "Self-publishing on Amazon KDP with an AI-written, typeset book"
seoTitle: "Publish an AI book on Amazon KDP"
description: "Amazon widened the 70% KDP royalty band to $12.99 in July 2026. The price math, and the exact EPUB, cover and TOC bar an AI-written book must clear first."
lang: en
pubDate: 2026-09-08
translationOf: jak-wydac-ksiazke-ai-na-amazon-kdp
heroImage: ../../assets/blog/self-publish-ai-book-on-amazon-kdp-hero.jpg
heroAlt: "A single closed hardcover book with a completely blank, unmarked cover resting on a plain kraft mailing envelope with no stamps or lettering, tied with string, a magnifying loupe and a wooden ruler beside it, one small deep indigo clothbound book standing upright next to the envelope"
coverPrompt: "A single closed hardcover book with a completely blank, unmarked cover and spine, resting on a plain kraft paper mailing envelope with no stamps, labels or lettering, tied with string, a magnifying loupe and a wooden ruler beside it, one small deep indigo clothbound book standing upright next to the envelope, warm directional window light, shallow depth of field"
eyebrow: "GUIDE"
---

Amazon widened the 70% royalty band for Kindle ebooks from $2.99-$9.99 to $2.99-$12.99, effective July 7, 2026. Outside that band the rate drops to 35%, and the drop is not gentle: a book priced at $12.99 earns roughly $9.09 per sale before the delivery fee, while the same book at $14.99, now just above the new ceiling, earns about $5.25. A wider band changes the pricing math. It does nothing for the part that actually blocks most self-published books from going live cleanly: the file itself.

## The 70% band just got wider, the delivery fee didn't

KDP still deducts a delivery fee from every 70%-tier sale, $0.15 per megabyte in the US (£0.10 in the UK, €0.12 in the EU), calculated on the file KDP delivers to the device. A lean, text-driven EPUB in the 2-4 MB range costs $0.30-$0.60 per sale in fees, so a $12.99 book nets around $8.60 after delivery, not the full $9.09. A photo-heavy book at 15-20 MB can lose $2-3 a sale to the same fee, which is the detail that makes "just export everything as high-res PNGs" an expensive habit. One more constraint rides along with pricing: if you also sell a print edition, [KDP requires the ebook list price to sit at least 20% below the print list price](https://kdp.amazon.com/en_US/help/topic/G200634560), so the paperback price gets set first if you're planning both formats.

## The file bar KDP actually checks

None of the royalty math matters if the file doesn't clear review. KDP's own reviewers don't grade prose, but they do reject a file that fails structurally, and three checks catch most self-published uploads:

- **A validated EPUB3, not a converted PDF.** KDP accepts EPUB, DOCX and KPF, but EPUB is the format built for how Kindle actually renders text, and a file run through [epubcheck](https://github.com/w3c/epubcheck) before upload skips a review round-trip. [The PDF-vs-EPUB split](/blog/pdf-vs-epub/) isn't cosmetic here: KDP does ingest a PDF, but the reading experience it produces on a phone or Kindle is the kind that shows up in one-star reviews, not in the upload rejection.
- **Two tables of contents, not one.** KDP wants a machine-readable NCX navigation file and a human-facing HTML contents page inside the book, and they are genuinely different things. A book with only the machine nav still fails review; a book with only an in-text page loses the "jump to chapter" feature Kindle readers expect.
- **A cover built for a thumbnail, not a full-page tear sheet.** The technical floor is 1,000 px on the longest side at a 1.6:1 ratio in sRGB, no transparency, but anything under 2,560 x 1,600 gets flagged "low quality" in Kindle store search. A cover meant for a 300 DPI print run clears that floor without a second export.
- **Metadata that fills every field KDP gives you.** Title, subtitle, a description written as sales copy rather than a synopsis, seven keyword slots and up to three categories. None of it blocks the upload if left half-empty, which is exactly why so many listings sit on page four of a category with the box unchecked.

## Where "AI-written" and "ready for KDP" quietly split

KDP does not verify formatting quality for you. It will publish a book with inconsistent heading sizes, a missing NCX or paragraph breaks that only look right in one font size, as long as the file technically validates, and the cost lands later as reviews, not as a rejection email. A common failure mode: a manuscript drafted in a chat interface, pasted into a Word template, exported to PDF and run through a free online PDF-to-EPUB converter. The file uploads, KDP accepts it, and the first review a week later says the chapter headings look like random paragraphs and the table of contents doesn't jump anywhere. None of that is a writing problem.

The actual gap between an AI-written manuscript and a store-ready one sits below the prose: the H1-H6 hierarchy, the TOC entries, the chapter breaks a reading device relies on, has to exist as real structure from the moment the book is generated, not get patched in by a converter afterward. [The four-step process that turns a topic into a finished book](/blog/how-ai-writes-a-book/) produces that structure at generation time for exactly this reason, because a converted or reflowed-after-the-fact EPUB is the kind epubcheck catches every time.

## From manuscript to a listing that survives review

[InkMagnet](/) writes each chapter from research, then runs it through the same typesetting pipeline for both output files: a press-ready PDF and a store EPUB built from that structured source, not converted from the PDF afterward, with real heading levels feeding both the NCX and the in-book TOC page. The cover is generated for the print run at 300 DPI, which clears KDP's 2,560 x 1,600 recommendation without a separate export pass. A 76-115 page Extended book, the range most nonfiction manuscripts land in without padding, is $19.99 once, with full commercial rights and no watermark on either file, so the two files you upload to KDP are the same ones the book shipped with.

## Wide, or into KDP Select

Nothing above changes the exclusivity trade-off: enroll in KDP Select and the book goes into Kindle Unlimited for rolling 90-day windows in exchange for giving up sales everywhere else, or launch wide on KDP, Apple Books and Kobo and keep every channel. [The full case for each path, plus the launch-week checklist](/blog/how-to-self-publish-an-ebook/) covers that decision in more depth than a KDP-specific piece should. The file bar above applies either way; it's the part that decides whether the pricing and exclusivity questions ever get a chance to matter.

Compare the one-time cost of a typeset, dual-format book against a freelance formatter's per-project fee at [InkMagnet's tier pricing](/#pricing), or [start from your own manuscript topic](https://app.inkmagnet.com/auth/register) and see the chapter structure ready for approval within minutes.
