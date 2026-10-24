import { defineAstroPaperConfig } from "./src/types/config";

export default defineAstroPaperConfig({
  site: {
    url: "https://lastexplorer.pages.dev/",
    title: "Explorer",
    description: "Explorer's digital garden for cloud architecture, AI engineering, and tech explorations.",
    author: "Explorer",
    profile: "https://github.com/lastexplorer",
    ogImage: "default-og.jpg",
    lang: "en",
    timezone: "Asia/Shanghai",
    dir: "ltr",
  },
  posts: {
    perPage: 20,
    perIndex: 4,
    scheduledPostMargin: 15 * 60 * 1000,
  },
  features: {
    lightAndDarkMode: true,
    dynamicOgImage: false,
    showArchives: true,
    showBreadcrumb: false,
    showBackButton: false,
    editPost: {
      enabled: true,
      url: "https://github.com/lastexplorer/Explorer/edit/main/",
    },
    search: "pagefind",
  },
  socials: [
    { name: "github",   url: "https://github.com/lastexplorer" },
    { name: "x",        url: "https://x.com/explorer" },
    { name: "telegram", url: "https://t.me/explorer" },
    { name: "whatsapp", url: "https://wa.me/1234567890" },
    { name: "facebook", url: "https://facebook.com/explorer" },
    { name: "mail",     url: "mailto:explorer@example.com" },
  ],
  shareLinks: [],
});
