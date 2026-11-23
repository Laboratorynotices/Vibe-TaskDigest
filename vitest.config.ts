import { defineVitestConfig } from "@nuxt/test-utils/config";

/**
 * Конфигурация Vitest.
 *
 * Тесты выполняются в Nuxt-окружении (`environment: "nuxt"` из
 * `@nuxt/test-utils`): доступны автоимпорты, `useRuntimeConfig`, `$fetch` и
 * монтирование компонентов. DOM эмулирует happy-dom — он легче jsdom.
 *
 * Чистые функции, которым не нужен Nuxt, можно гонять в окружении Node: в
 * начале такого `*.spec.ts` достаточно указать `// @vitest-environment node`,
 * это переопределяет настройку ниже для конкретного файла.
 */
export default defineVitestConfig({
  test: {
    environment: "nuxt",
    environmentOptions: {
      nuxt: {
        // DOM-эмуляция внутри Nuxt-окружения: "happy-dom" или "jsdom".
        domEnvironment: "happy-dom",
      },
    },
  },
});
