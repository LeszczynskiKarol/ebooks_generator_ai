// @ts-check
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { examples } from "./src/data/examples.js";

export default defineConfig({
  site: "https://inkmagnet.com",

  i18n: {
    defaultLocale: "en",
    locales: ["en", "pl"],
    routing: {
      prefixDefaultLocale: false,
    },
  },

  integrations: [
    sitemap({
      changefreq: "weekly",
      priority: 0.7,
      // downloadable sample ebooks — let Google discover the PDFs
      customPages: examples.map((b) => `https://inkmagnet.com/samples/${b.slug}.pdf`),
      // legal pages are noindex — keep them out of the sitemap
      filter: (page) =>
        !page.includes("/privacy") &&
        !page.includes("/terms") &&
        !page.includes("/polityka-prywatnosci") &&
        !page.includes("/regulamin"),
      serialize(item) {
        if (item.url === "https://inkmagnet.com/" || item.url === "https://inkmagnet.com/pl/") {
          item.priority = 1.0;
        } else if (item.url.includes("/samples/") && item.url.endsWith(".pdf")) {
          // sample books rarely change; lower priority than landing pages
          item.priority = 0.6;
          item.changefreq = "monthly";
        }
        return item;
      },
    }),
  ],

  output: "static",

  build: {
    assets: "_assets",
    // inline CSS — no stylesheet round-trip, zero CLS
    inlineStylesheets: "always",
  },

  vite: {
    plugins: [tailwindcss()],
    build: {
      cssMinify: true,
    },
  },
});
