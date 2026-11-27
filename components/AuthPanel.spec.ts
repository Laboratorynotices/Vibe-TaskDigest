import { beforeEach, describe, expect, test, vi } from "vitest";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { flushPromises } from "@vue/test-utils";
import type { User } from "@netlify/identity";
import AuthPanel from "./AuthPanel.vue";

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
 * Настройки Identity с включённым провайдером Google.
 */
const settingsWithGoogle = {
  autoconfirm: false,
  disableSignup: false,
  providers: { google: true, email: true },
};

/**
 * Вошедший пользователь.
 */
const identityUser: User = {
  id: "user-1",
  name: "Иван",
  provider: "google",
};

describe("AuthPanel", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    getSettingsMock.mockReset();
    oauthLoginMock.mockReset();
    logoutMock.mockReset();
    callbackMock.mockReset();
  });

  test("гостю показывает кнопку входа через Google", async () => {
    getUserMock.mockResolvedValue(null);
    getSettingsMock.mockResolvedValue(settingsWithGoogle);

    const wrapper = await mountSuspended(AuthPanel);
    await flushPromises();

    const button = wrapper.get(".auth-panel__button");
    expect(button.text()).toBe("Войти через Google");
    expect(button.attributes("disabled")).toBeUndefined();
  });

  test("нажатие на кнопку входа запускает редирект к Google", async () => {
    getUserMock.mockResolvedValue(null);
    getSettingsMock.mockResolvedValue(settingsWithGoogle);

    const wrapper = await mountSuspended(AuthPanel);
    await flushPromises();

    await wrapper.get(".auth-panel__button").trigger("click");

    expect(oauthLoginMock).toHaveBeenCalledWith("google");
  });

  test("показывает кнопку входа и пояснение, если Google выключен", async () => {
    getUserMock.mockResolvedValue(null);
    getSettingsMock.mockResolvedValue({
      autoconfirm: false,
      disableSignup: false,
      providers: { google: false, email: true },
    });

    const wrapper = await mountSuspended(AuthPanel);
    await flushPromises();

    expect(wrapper.get(".auth-panel__button").text()).toBe(
      "Войти через Google",
    );
    expect(wrapper.text()).toContain("Вход через Google сейчас недоступен");
  });

  test("вошедшему показывает имя и кнопку выхода", async () => {
    getUserMock.mockResolvedValue(identityUser);
    getSettingsMock.mockResolvedValue(settingsWithGoogle);
    logoutMock.mockResolvedValue(undefined);

    const wrapper = await mountSuspended(AuthPanel);
    await flushPromises();

    expect(wrapper.get(".auth-panel__name").text()).toBe("Иван");

    await wrapper.get(".auth-panel__button").trigger("click");
    await flushPromises();

    expect(logoutMock).toHaveBeenCalledTimes(1);
    expect(wrapper.find(".auth-panel__name").exists()).toBe(false);
  });

  test("ошибка выводится в live-регионе", async () => {
    getUserMock.mockResolvedValue(null);
    getSettingsMock.mockRejectedValue(new Error("Identity не настроен"));

    const wrapper = await mountSuspended(AuthPanel);
    await flushPromises();

    const alert = wrapper.get(".auth-panel__error");
    expect(alert.attributes("role")).toBe("alert");
    expect(alert.text()).toBe("Identity не настроен");
  });
});
