import { beforeEach, describe, expect, test, vi } from "vitest";
import type { User } from "@netlify/identity";

const { getUserMock, getSettingsMock, oauthLoginMock, logoutMock, callbackMock } =
  vi.hoisted(() => ({
    getUserMock: vi.fn(),
    getSettingsMock: vi.fn(),
    oauthLoginMock: vi.fn(),
    logoutMock: vi.fn(),
    callbackMock: vi.fn(),
  }));

vi.mock("@netlify/identity", () => ({
  getUser: getUserMock,
  getSettings: getSettingsMock,
  oauthLogin: oauthLoginMock,
  logout: logoutMock,
  handleAuthCallback: callbackMock,
}));

/**
 * Пользователь, которого возвращает мок Netlify Identity.
 */
const identityUser: User = {
  id: "user-1",
  name: "Иван",
  provider: "google",
  roles: ["member"],
};

/**
 * Импортирует composable заново, чтобы сбросить общее состояние между тестами.
 *
 * @returns Функцию `useAuth` из свежего экземпляра модуля.
 */
async function loadUseAuth() {
  vi.resetModules();
  const module = await import("./useAuth");

  return module.useAuth;
}

describe("useAuth", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    getSettingsMock.mockReset();
    oauthLoginMock.mockReset();
    logoutMock.mockReset();
    callbackMock.mockReset();
  });

  test("refreshUser сохраняет вошедшего пользователя", async () => {
    getUserMock.mockResolvedValue(identityUser);
    const useAuth = await loadUseAuth();
    const auth = useAuth();

    await auth.refreshUser();

    expect(auth.user.value).toEqual(identityUser);
    expect(auth.isAuthenticated.value).toBe(true);
    expect(auth.displayName.value).toBe("Иван");
  });

  test("refreshUser сбрасывает состояние, если пользователь не вошёл", async () => {
    getUserMock.mockResolvedValue(null);
    const useAuth = await loadUseAuth();
    const auth = useAuth();

    await auth.refreshUser();

    expect(auth.user.value).toBeNull();
    expect(auth.isAuthenticated.value).toBe(false);
    expect(auth.error.value).toBeNull();
  });

  test("refreshUser записывает ошибку и не выбрасывает исключение", async () => {
    getUserMock.mockRejectedValue(new Error("Сервис недоступен"));
    const useAuth = await loadUseAuth();
    const auth = useAuth();

    await expect(auth.refreshUser()).resolves.toBeUndefined();

    expect(auth.user.value).toBeNull();
    expect(auth.error.value).toBe("Сервис недоступен");
  });

  test("loadSettings показывает вход, когда Google включён", async () => {
    getSettingsMock.mockResolvedValue({
      autoconfirm: false,
      disableSignup: false,
      providers: { google: true, email: true },
    });
    const useAuth = await loadUseAuth();
    const auth = useAuth();

    await auth.loadSettings();

    expect(auth.googleAvailable.value).toBe(true);
  });

  test("loadSettings скрывает вход, когда Google выключен", async () => {
    getSettingsMock.mockResolvedValue({
      autoconfirm: false,
      disableSignup: false,
      providers: { google: false, email: true },
    });
    const useAuth = await loadUseAuth();
    const auth = useAuth();

    await auth.loadSettings();

    expect(auth.googleAvailable.value).toBe(false);
  });

  test("loadSettings при ошибке считает вход недоступным", async () => {
    getSettingsMock.mockRejectedValue(new Error("Identity не настроен"));
    const useAuth = await loadUseAuth();
    const auth = useAuth();

    await auth.loadSettings();

    expect(auth.googleAvailable.value).toBe(false);
    expect(auth.error.value).toBe("Identity не настроен");
  });

  test("loginWithGoogle запускает редирект к Google", async () => {
    const useAuth = await loadUseAuth();
    const auth = useAuth();

    auth.loginWithGoogle();

    expect(oauthLoginMock).toHaveBeenCalledWith("google");
  });

  test("completeLogin сохраняет пользователя после OAuth-редиректа", async () => {
    callbackMock.mockResolvedValue({ type: "oauth", user: identityUser });
    const useAuth = await loadUseAuth();
    const auth = useAuth();

    const result = await auth.completeLogin();

    expect(result?.type).toBe("oauth");
    expect(auth.user.value).toEqual(identityUser);
    expect(getUserMock).not.toHaveBeenCalled();
  });

  test("completeLogin без токена подхватывает существующую сессию", async () => {
    callbackMock.mockResolvedValue(null);
    getUserMock.mockResolvedValue(identityUser);
    const useAuth = await loadUseAuth();
    const auth = useAuth();

    await auth.completeLogin();

    expect(getUserMock).toHaveBeenCalledTimes(1);
    expect(auth.user.value).toEqual(identityUser);
  });

  test("completeLogin записывает ошибку, если токен недействителен", async () => {
    callbackMock.mockRejectedValue(new Error("Токен истёк"));
    const useAuth = await loadUseAuth();
    const auth = useAuth();

    const result = await auth.completeLogin();

    expect(result).toBeNull();
    expect(auth.error.value).toBe("Токен истёк");
  });

  test("signOut очищает пользователя и вызывает logout", async () => {
    getUserMock.mockResolvedValue(identityUser);
    logoutMock.mockResolvedValue(undefined);
    const useAuth = await loadUseAuth();
    const auth = useAuth();
    await auth.refreshUser();

    await auth.signOut();

    expect(logoutMock).toHaveBeenCalledTimes(1);
    expect(auth.user.value).toBeNull();
  });
});
