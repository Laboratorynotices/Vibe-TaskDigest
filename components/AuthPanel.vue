<script setup lang="ts">
import { onMounted } from "vue";
import { useAuth } from "../app/composables/useAuth";

/**
 * Панель входа: показывает кнопку входа через Google либо текущего
 * пользователя с кнопкой выхода.
 *
 * Кнопка входа видна всегда, чтобы её можно было проверить до настройки
 * провайдера в дашборде. Настройки Identity (`googleAvailable`) лишь добавляют
 * пояснение, что провайдер выключен: попытка входа в этом случае вернёт ошибку
 * в live-регион.
 */
const {
  pending,
  error,
  googleAvailable,
  isAuthenticated,
  displayName,
  refreshUser,
  loadSettings,
  loginWithGoogle,
  signOut,
} = useAuth();

/**
 * Загружает текущую сессию и настройки провайдеров при появлении панели.
 */
onMounted(async () => {
  await Promise.all([refreshUser(), loadSettings()]);
});
</script>

<template>
  <section
    class="auth-panel"
    aria-labelledby="auth-panel-title"
    :aria-busy="pending"
  >
    <h2 id="auth-panel-title" class="auth-panel__title">Аккаунт</h2>

    <div v-if="isAuthenticated" class="auth-panel__user">
      <p class="auth-panel__name">{{ displayName }}</p>
      <button
        class="auth-panel__button auth-panel__button--secondary"
        type="button"
        :disabled="pending"
        @click="signOut"
      >
        Выйти
      </button>
    </div>

    <div v-else class="auth-panel__guest">
      <p class="auth-panel__note">
        Войдите через Google, чтобы управлять своими проектами и сессиями.
      </p>
      <button
        class="auth-panel__button"
        type="button"
        :disabled="pending"
        @click="loginWithGoogle"
      >
        Войти через Google
      </button>
      <p v-if="googleAvailable === false" class="auth-panel__note auth-panel__note--muted">
        Вход через Google сейчас недоступен.
      </p>
    </div>

    <!-- Контейнер live-региона существует всегда, чтобы скринридер озвучил
         ошибку, появившуюся без перезагрузки страницы. -->
    <p class="auth-panel__error" role="alert">{{ error ?? "" }}</p>
  </section>
</template>
