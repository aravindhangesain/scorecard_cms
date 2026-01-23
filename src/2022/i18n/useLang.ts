// src/i18n/useLang.ts
export function getLang(Astro) {
  // /zh = Chinese
  // default = English
  return Astro.url.pathname.startsWith("/zh") ? "zh" : "en";
}

export function getStrings(lang) {
  return lang === "zh"
    ? import("../i18n/ln-eg.json") // Chinese
    : import("../i18n/ln.json");   // English
}
