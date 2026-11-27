import {
  getSettings,
  getUser as getIdentityUser,
  handleAuthCallback as handleIdentityAuthCallback,
  logout as identityLogout,
  oauthLogin,
  type CallbackResult,
  type User,
} from "@netlify/identity";

/**
 * Текущий пользователь, вошедший через Netlify Identity.
 *
 * Состояние общее для всех вызовов composable (сессия одна на вкладку браузера).
 * Заполняется только на клиенте: на сервере вход не выполняется, поэтому при SSR
 * значение всегда `null`. Это исключает утечку чужой сессии между запросами.
 */
const user = ref<User | null>(null);

/**
 * Признак выполнения запроса к сервису входа: блокирует повторные нажатия и
 * позволяет интерфейсу показать занятость (`aria-busy`).
 */
const pending = ref(false);

/**
 * Текст последней ошибки входа для live-региона. `null` — ошибок нет.
 */
const error = ref<string | null>(null);

/**
 * Доступен ли провайдер Google по настройкам проекта в Netlify.
 *
 * `null` — настройки ещё не загружены: интерфейс не должен показывать кнопку
 * входа, пока сервис не подтвердил, что провайдер включён.
 */
const googleAvailable = ref<boolean | null>(null);

/**
 * Приводит неизвестную ошибку к понятному пользователю тексту.
 *
 * @param cause — ошибка, пойманная в `try/catch`.
 * @returns Сообщение ошибки, если оно есть, иначе общий текст о неудачном запросе.
 */
function describeError(cause: unknown): string {
  if (cause instanceof Error && cause.message.trim() !== "") {
    return cause.message;
  }

  return "Не удалось выполнить запрос к сервису входа. Попробуйте ещё раз.";
}

/**
 * Управляет входом через Google и состоянием текущего пользователя.
 *
 * Все методы, обращающиеся к `@netlify/identity`, работают только в браузере:
 * на сервере они ничего не делают. Вход выполняется через Netlify Identity,
 * поэтому собственный OAuth-клиент и обмен токенами не нужны.
 *
 * @example
 * ```ts
 * const { user, loginWithGoogle, signOut } = useAuth();
 * loginWithGoogle(); // редирект на Google
 * await signOut();
 * ```
 */
export function useAuth() {
  /**
   * Вошёл ли пользователь. На сервере всегда `false`.
   */
  const isAuthenticated = computed(() => user.value !== null);

  /**
   * Имя пользователя для интерфейса. Email намеренно не используется: почта —
   * служебное поле и не выводится в публичные части приложения.
   */
  const displayName = computed(() => user.value?.name ?? "Пользователь");

  /**
   * Перечитывает текущего пользователя из сессии Netlify Identity.
   *
   * Вызывается при монтировании панели входа и после завершения OAuth-редиректа,
   * когда в адресе нет токена. Ошибка не выбрасывается: она попадает в `error`,
   * а `user` сбрасывается в `null`.
   */
  async function refreshUser(): Promise<void> {
    if (!import.meta.client) {
      return;
    }

    pending.value = true;
    error.value = null;

    try {
      user.value = await getIdentityUser();
    } catch (cause) {
      user.value = null;
      error.value = describeError(cause);
    } finally {
      pending.value = false;
    }
  }

  /**
   * Загружает настройки Netlify Identity и выясняет, включён ли провайдер Google.
   *
   * Кнопка входа показывается только при `googleAvailable === true`, поэтому
   * список провайдеров не зашит в интерфейс. Если настройки получить не удалось,
   * вход считается недоступным, а причина попадает в `error`.
   */
  async function loadSettings(): Promise<void> {
    if (!import.meta.client) {
      return;
    }

    try {
      const settings = await getSettings();
      googleAvailable.value = settings.providers.google === true;
    } catch (cause) {
      googleAvailable.value = false;
      error.value = describeError(cause);
    }
  }

  /**
   * Начинает вход через Google: перенаправляет браузер на страницу провайдера.
   *
   * Функция не возвращает управление — после редиректа браузер вернётся на эту
   * же страницу с токеном в адресе, который обработает {@link completeLogin}.
   */
  function loginWithGoogle(): void {
    if (!import.meta.client) {
      return;
    }

    error.value = null;
    oauthLogin("google");
  }

  /**
   * Завершает вход по токену из адресной строки.
   *
   * Обязательный шаг после редиректа Google, подтверждения почты и перехода по
   * ссылке-приглашению: без него сессия не создаётся. Вызывается один раз при
   * загрузке страницы.
   *
   * @returns Результат обработки токена или `null`, если токена в адресе нет
   * (например, при обычном открытии сайта).
   */
  async function completeLogin(): Promise<CallbackResult | null> {
    if (!import.meta.client) {
      return null;
    }

    pending.value = true;
    error.value = null;

    try {
      const result = await handleIdentityAuthCallback();

      if (result?.user) {
        user.value = result.user;
      } else if (result === null) {
        // Токена в адресе нет — это обычная загрузка страницы, подхватываем
        // уже существующую сессию из cookie.
        user.value = await getIdentityUser();
      }

      return result;
    } catch (cause) {
      error.value = describeError(cause);
      return null;
    } finally {
      pending.value = false;
    }
  }

  /**
   * Завершает сессию: удаляет cookie входа и сбрасывает пользователя.
   *
   * Если сервер не ответил, cookie всё равно очищаются библиотекой, поэтому
   * локальное состояние сбрасывается только после успешного вызова.
   */
  async function signOut(): Promise<void> {
    if (!import.meta.client) {
      return;
    }

    pending.value = true;
    error.value = null;

    try {
      await identityLogout();
      user.value = null;
    } catch (cause) {
      error.value = describeError(cause);
    } finally {
      pending.value = false;
    }
  }

  return {
    user,
    pending,
    error,
    googleAvailable,
    isAuthenticated,
    displayName,
    refreshUser,
    loadSettings,
    loginWithGoogle,
    completeLogin,
    signOut,
  };
}
