// Posts held back from indexing — the list and the reason live in
// site/blog-auto/index-hold.json. A held post is still built, linked and
// readable; it only carries "noindex, follow" and is left out of the sitemap,
// the homepage teasers and the footer.
import hold from "../../blog-auto/index-hold.json";

const HELD = new Set<string>(hold.slugs);

export const isHeld = (id: string): boolean => HELD.has(id);
