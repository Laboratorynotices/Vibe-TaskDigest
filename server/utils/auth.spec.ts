import { beforeEach, describe, expect, test, vi } from "vitest";
import type { User } from "@netlify/identity";
import { requireUser } from "./auth";

const { getUserMock } = vi.hoisted(() => ({ getUserMock: vi.fn() }));

vi.mock("@netlify/identity", () => ({
  getUser: getUserMock,
}));

/**
 * Авторизованный пользователь, которого возвращает мок.
 */
const identityUser: User = {
  id: "user-1",
  name: "Иван",
  provider: "google",
};

describe("requireUser", () => {
  beforeEach(() => {
    getUserMock.mockReset();
  });

  test("возвращает пользователя из серверной сессии", async () => {
    getUserMock.mockResolvedValue(identityUser);

    await expect(requireUser()).resolves.toEqual(identityUser);
  });

  test("прерывает запрос ошибкой 401 без сессии", async () => {
    getUserMock.mockResolvedValue(null);

    await expect(requireUser()).rejects.toMatchObject({
      statusCode: 401,
      statusMessage: "Требуется вход",
    });
  });

  test("не подставляет пользователя из аргументов запроса", async () => {
    getUserMock.mockResolvedValue(null);

    await expect(requireUser()).rejects.toMatchObject({ statusCode: 401 });
    expect(getUserMock).toHaveBeenCalledWith();
  });
});
