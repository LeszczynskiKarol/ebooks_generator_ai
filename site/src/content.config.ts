import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const blog = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/blog" }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      description: z.string().max(170),
      lang: z.enum(["en", "pl"]),
      pubDate: z.coerce.date(),
      updatedDate: z.coerce.date().optional(),
      /** slug of the translation counterpart, if one exists */
      translationOf: z.string().optional(),
      /** hero per DESIGN-BOOK.md §4-6 — also becomes the article's og:image */
      heroImage: image().optional(),
      heroAlt: z.string().optional(),
      draft: z.boolean().default(false),
    }),
});

export const collections = { blog };
