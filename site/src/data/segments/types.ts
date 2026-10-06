// One segment landing (e.g. "ebook for a service business"): its OWN copy,
// rendered by components/SegmentLanding.astro. The example book block (table
// of contents, page previews, PDF) is pulled from examples.js +
// examplePages.json by `exampleSlug`, so it always shows a real book.
// Copy rule: original text per page, no em dashes.
import type { Lang } from "../../i18n/ui";

export interface Segment {
  key: string;
  lang: Lang;
  /** public path, e.g. "/pl/ebook-dla-firmy-uslugowej/" */
  path: string;
  /** path of the same segment in the other language, if it exists */
  altPath?: string;
  exampleSlug: string;
  seo: { title: string; description: string };
  hero: { badge: string; title: string; accent: string; sub: string; bullets: string[] };
  /** why this audience needs a book, in their own situation */
  problem: { title: string; paragraphs: string[] };
  /** concrete books this audience makes */
  uses: { title: string; sub: string; items: { title: string; desc: string }[] };
  /** how the work goes for this audience (screens shown alongside) */
  how: { title: string; sub: string; steps: { title: string; desc: string }[] };
  /** intro above the real table of contents of the example book */
  inside: { title: string; sub: string };
  /** intro above the page previews */
  fragment: { title: string; sub: string };
  /** practical advice: how to use the finished book in this business */
  playbook: { title: string; sub: string; items: { title: string; desc: string }[] };
  faq: { q: string; a: string }[];
  cta: { title: string; sub: string; button: string };
}
