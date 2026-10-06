---
title: "What languages can InkMagnet actually write in?"
seoTitle: "What languages does InkMagnet support?"
description: "InkMagnet fully supports English and Polish, not a marketing list of fifty. What a language actually needs to earn that claim, with real numbers."
lang: en
pubDate: 2026-09-30
translationOf: w-jakich-jezykach-pisze-inkmagnet
heroImage: ../../assets/blog/what-languages-does-inkmagnet-support-hero.jpg
heroAlt: "Three closed hardcover books of different sizes with blank spines and colorful ribbon bookmarks, a small deep indigo clothbound book resting on top beside a bone folder and a brass magnifying glass"
coverPrompt: "A stack of three closed hardcover books of different sizes on a dark wooden desk, each spine and cover completely blank without any lettering, marked with different colored ribbon bookmarks, one small deep indigo clothbound book resting on top of the stack, a bone folder and a brass magnifying glass beside them, warm side light from a desk lamp, soft dark background, shallow depth of field"
eyebrow: "GUIDE"
---

Open InkMagnet's project form and the language dropdown has two options: English and Polish. That's the whole list. No beta flag hiding a third option, no "coming soon" for Portuguese or German. It looks stingy next to a competitor's landing page that lists ten languages or claims to write in "any language" at all. At least until you look at what those longer lists actually deliver.

## Two languages, on purpose

Every InkMagnet book, in either language, goes through the same pipeline: research, chapter writing, an editing pass, then LaTeX typesetting with language-aware hyphenation. That last part is the one most "multilingual" AI book tools skip. English and Polish are the two languages the product is actually edited and proofread in, and the two the typesetting has been tuned for, not the two someone happened to translate the interface into.

Compare that to Designrr's AI drafting layer, Wordgenie, which drafts an ebook in ten languages: English, Dutch, French, German, Hungarian, Italian, Polish, Portuguese, Romanian and Spanish, according to its own documentation. Sqribble's ebook creator officially supports English only; the interface doesn't stop you from pasting in anything else, and some users report doing exactly that, with results that depend entirely on how much editing they're willing to do afterward, since the tool was never built or proofed for any language but English.

## What a claimed language actually has to cover

"Supports French" can mean three very different things: the AI can produce grammatically correct French sentences, the finished PDF hyphenates French words correctly at line breaks, and someone who reads French professionally has checked the output for the small things a fluent non-native speaker gets subtly wrong: word order, register, the difference between formal and informal address. A tool that only clears the first bar can still hand you a manuscript riddled with typographic errors a native reader notices in the first paragraph.

The typesetting layer is where the gap shows up fastest. [LaTeX's hyphenation system](/blog/what-latex-does-for-your-book/) is built on pattern sets trained for one specific language at a time; the underlying babel engine ships hyphenation patterns for roughly 170 languages across around 40 scripts, so the raw typesetting capability to break words correctly in dozens of languages already exists in the toolchain InkMagnet runs on. Having the pattern file is not the hard part. Verifying that a book actually reads like it was written by someone fluent in that language, chapter after chapter, is.

Take French as a concrete example of what that verification catches. An AI model asked to write French prose will usually produce something grammatically clean, but formal nonfiction French leans on a different register than a direct English-to-French draft tends to default to: longer subordinate clauses, a more distant "vous" address in how-to content, and idiom that doesn't survive a literal translation from an English-trained instinct for phrasing. None of that shows up as an error a spellchecker flags. It shows up as a book that reads like it was written by someone competent in French as a second language, not a first one, and only a fluent editorial pass catches the difference before a reader does.

## Two languages, two real markets

There's also a plainer reason the list is English and Polish rather than English and something else: those are the two markets InkMagnet is actually built for and sold into today, self-publishers, agencies and course creators writing in English, and the same audience in Poland. Adding a language nobody on the team can proofread and nobody in the current customer base is asking for would be optimizing the marketing page instead of the product.

## Why the list stays short instead of long

Every language on a "we support X languages" page is a language someone has to keep verifying as the underlying AI models change, as house style guides get refined, and as new chapter templates get added. Add a language you can't proofread and every future feature has to be re-checked against it too, or it quietly falls behind English while still sitting on the marketing page. That's a maintenance bill competitors are choosing to defer, not one they've paid.

Sticking to English and Polish means both get the same attention: the same review of idioms and register, the same scrutiny on hyphenation exceptions, the same chapter-opener and callout-box templates checked against real books in that language rather than assumed to translate cleanly. A ten-language list where nine of the ten only got a drafting pass isn't a bigger product. It's the same product with nine extra ways to disappoint a reader.

## If you need a book in a third language

Today, InkMagnet doesn't write in a third language, and there's no roadmap promise here to fill that gap by a specific date. If your project genuinely needs French, German or Spanish, the honest options are: write the book in English through InkMagnet and have a professional translator adapt it afterward, or wait, since adding a language properly means adding the proofing and typography work behind it, not just flipping a switch in a dropdown. A translated manuscript also keeps the research and structure work InkMagnet already did, which is usually the more expensive half of getting a book right in the first place, so translating a finished English draft costs less than commissioning an original book in that third language from scratch.

If you're weighing that trade-off against a tool that lists your target language on its homepage, it's worth actually opening a sample chapter in that language before paying for a subscription. A list of ten languages tells you what the AI drafting layer can attempt; it doesn't tell you whether anyone has checked what it produces.

For a project in English or Polish, though, [start a book from a single topic](https://app.inkmagnet.com/auth/register) and the full pipeline (research, writing, review, typesetting, cover) runs in the language you actually need it in. If you're still comparing this against tools that list more languages on paper, [the fuller Designrr comparison](/blog/inkmagnet-vs-designrr/) and [the Sqribble breakdown](/blog/inkmagnet-vs-sqribble/) go through what each one's language support looks like once you get past the landing page.
