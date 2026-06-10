// @ts-check
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";

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
      // legal pages are noindex — keep them out of the sitemap
      filter: (page) =>
        !page.includes("/privacy") &&
        !page.includes("/terms") &&
        !page.includes("/polityka-prywatnosci") &&
        !page.includes("/regulamin"),
      serialize(item) {
        if (item.url === "https://inkmagnet.com/" || item.url === "https://inkmagnet.com/pl/") {
          item.priority = 1.0;
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
