import { defineConfig } from "vitepress";

// GitHub Pages project site is served from /grimoire/.
// Override with DOCS_BASE for custom domains or local previews.
const base = process.env.DOCS_BASE ?? "/grimoire/";

export default defineConfig({
  base,
  lang: "en-US",
  title: "Grimoire",
  description: "Gherkin + MADR spec-driven development for AI coding assistants",
  cleanUrls: true,
  lastUpdated: true,
  themeConfig: {
    nav: [
      { text: "Guide", link: "/guide/getting-started" },
      { text: "CLI", link: "/reference/cli" },
    ],
    sidebar: {
      "/guide/": [
        {
          text: "Guide",
          items: [
            { text: "Getting started", link: "/guide/getting-started" },
            { text: "Setup & best practices", link: "/guide/setup" },
            { text: "Agent compatibility", link: "/guide/compatibility" },
          ],
        },
      ],
      "/reference/": [
        {
          text: "Reference",
          items: [{ text: "CLI", link: "/reference/cli" }],
        },
      ],
    },
    socialLinks: [
      { icon: "github", link: "https://github.com/KiwiData-AI/grimoire" },
    ],
    search: { provider: "local" },
    editLink: {
      pattern: "https://github.com/KiwiData-AI/grimoire/edit/main/docs/:path",
    },
  },
});
