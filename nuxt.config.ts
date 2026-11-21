// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ["@nuxt/eslint", "@nuxtjs/i18n", "@nuxtjs/seo", "@netlify/nuxt"],
  compatibilityDate: "2025-07-15",
  site: {
    // Обязательно: публичный продакшн-домен (нужен для canonical-ссылок, sitemap и OG-картинок)
    url: "https://taskdigest.netlify.app/",
    // Название сайта (используется в шаблонах заголовков и Schema.org)
    name: "TaskDigest",
    // Описание по умолчанию
    description:
      "Портфолио-проект для учёта времени, потраченного на задачи внутри проектов.",
    // Основной язык сайта (влияет на атрибут lang в <html> и разметку)
    // defaultLocale здесь НЕ пишем — он подтянется из i18n
  },
  devtools: { enabled: true },
});
