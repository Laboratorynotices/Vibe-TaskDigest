import { createError } from "h3";
import { getUser, type User } from "@netlify/identity";

/**
 * Требует авторизованного пользователя и возвращает его.
 *
 * Пользователь определяется только серверной сессией Netlify Identity:
 * `getUser()` читает cookie `nf_jwt` из рантайма Netlify Functions, поэтому
 * подделать идентификатор из тела запроса, query или заголовков нельзя.
 *
 * @returns Пользователь Netlify Identity (`id`, `name`, `provider`, `roles` и др.).
 * @throws 401 «Требуется вход», если сессии нет или она недействительна.
 */
export async function requireUser(): Promise<User> {
  const user = await getUser();

  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: "Требуется вход",
    });
  }

  return user;
}
