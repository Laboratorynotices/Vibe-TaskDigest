<script setup lang="ts">
/**
 * Абсолютный адрес приложения из публичной конфигурации.
 *
 * Значение приходит из переменной окружения `NUXT_PUBLIC_APP_URL` через
 * `runtimeConfig.public.appUrl` (см. `nuxt.config.ts`). Выводится на страницу,
 * чтобы проверить, что переменная окружения действительно доходит до клиента.
 */
const appUrl = useRuntimeConfig().public.appUrl;
</script>

<template>
  <div class="app">
    <NuxtRouteAnnouncer />
    <NuxtWelcome />
    <p class="app__url">{{ appUrl }}</p>
  </div>
</template>
