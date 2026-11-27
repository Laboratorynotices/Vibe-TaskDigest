/**
 * Публичный абсолютный адрес приложения (например, https://taskdigest.netlify.app/).
 *
 * Берётся из переменной окружения `NUXT_PUBLIC_APP_URL`, которую задаёт
 * владелец проекта (в Netlify или локально через Netlify/Nuxt CLI). Одно и то же
 * значение используется для canonical-ссылок, sitemap и OG-картинок, а также
 * доступно клиенту через `runtimeConfig.public.appUrl`. Если переменная не
 * задана на этапе сборки, адрес будет `undefined` и SEO-разметка не получит
 * базового URL.
 */
const appUrl = process.env.NUXT_PUBLIC_APP_URL;

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ["@nuxt/eslint", "@nuxtjs/i18n", "@nuxtjs/seo", "@netlify/nuxt"],
  compatibilityDate: "2025-07-15",
  // Единая точка входа стилей: только @import, см. assets/styles/style.css.
  css: ["~~/assets/styles/style.css"],
  // AI-ready функции @nuxtjs/seo подключают нативную зависимость mdream. При
  // сборке на Netlify она падала с ошибкой "Cannot find native binding": биндинг
  // собирался под локальную arm64, а Netlify Functions работает на x64. Поэтому
  // AI-ready отключены.
  aiReady: false,
  i18n: {
    // Язык по умолчанию — немецкий. Для стратегии `prefix_except_default`
    // (используется по умолчанию) он обязателен, иначе nuxt-i18n пишет
    // предупреждение в лог.
    defaultLocale: "de",
    // Файлы переводов лежат в `locales/` в корне проекта, а не в каталоге
    // модуля `i18n/`, поэтому корнем структуры i18n считается сам проект.
    // TODO: переместить файлы переводов в каталог модуля i18n, чтобы не было лишнего уровня вложенности.
    restructureDir: ".",
    langDir: "locales",
    // Список языков сайта. `file` — имя файла переводов внутри `locales/`,
    // `language` — ISO-код для атрибута lang и hreflang.
    locales: [
      { code: "de", language: "de-DE", name: "Deutsch", file: "de.json" },
      { code: "en", language: "en-US", name: "English", file: "en.json" },
      { code: "ru", language: "ru-RU", name: "Русский", file: "ru.json" },
    ],
  },
  // Публичная конфигурация, доступная клиенту. Значение `appUrl`
  // переопределяется переменной окружения `NUXT_PUBLIC_APP_URL`.
  runtimeConfig: {
    public: {
      /** Абсолютный адрес приложения без завершающей обработки: см. `appUrl`. */
      appUrl,
    },
  },
  site: {
    // Обязательно: публичный продакшн-домен (нужен для canonical-ссылок, sitemap и OG-картинок).
    // Берётся из `NUXT_PUBLIC_APP_URL`, а не из строки в коде.
    url: appUrl,
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
