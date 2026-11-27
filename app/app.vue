<script setup lang="ts">
import { onMounted } from "vue";
import AuthPanel from "../components/AuthPanel.vue";
import { useAuth } from "./composables/useAuth";

/**
 * Абсолютный адрес приложения из публичной конфигурации.
 *
 * Значение приходит из переменной окружения `NUXT_PUBLIC_APP_URL` через
 * `runtimeConfig.public.appUrl` (см. `nuxt.config.ts`). Выводится на страницу,
 * чтобы проверить, что переменная окружения действительно доходит до клиента.
 */
const appUrl = useRuntimeConfig().public.appUrl;

/**
 * Завершение входа по токену в адресе.
 *
 * Netlify Identity возвращает пользователя на эту же страницу с токеном в
 * хеше (`#access_token=...` либо `#confirmation_token=...`). Без вызова
 * `handleAuthCallback()` сессия не создаётся, поэтому обработчик запускается
 * один раз при монтировании корневого компонента.
 */
const { completeLogin } = useAuth();

onMounted(() => {
  void completeLogin();
});
</script>

<template>
  <div class="app">
    <AuthPanel />
    <NuxtRouteAnnouncer />
    <NuxtWelcome />
    <p class="app__url">{{ appUrl }}</p>
  </div>
</template>
