import { requireUser } from "../../utils/auth";

/**
 * Публичные поля текущего пользователя.
 *
 * Email, служебные идентификаторы Netlify и метаданные наружу не отдаются: они
 * не нужны клиенту и относятся к служебным данным.
 */
interface MeResponse {
  /** Идентификатор пользователя Netlify Identity. */
  id: string;
  /** Отображаемое имя из профиля Google, если оно есть. */
  name: string | null;
  /** Ссылка на аватар из профиля, если она есть. */
  pictureUrl: string | null;
  /** Провайдер, через который выполнен вход (ожидается `google`). */
  provider: string | null;
  /** Роли пользователя из `app_metadata.roles`. */
  roles: string[];
}

/**
 * `GET /api/v1/me` — текущий пользователь.
 *
 * Приватный эндпоинт: требует серверную сессию Netlify Identity. Используется
 * клиентом для проверки, что вход действителен на сервере, а не только в
 * браузере.
 *
 * @returns `MeResponse` — только явно перечисленные безопасные поля.
 * @throws 401 «Требуется вход», если сессии нет или она недействительна.
 */
export default defineEventHandler(async (): Promise<MeResponse> => {
  const user = await requireUser();

  return {
    id: user.id,
    name: user.name ?? null,
    pictureUrl: user.pictureUrl ?? null,
    provider: user.provider ?? null,
    roles: user.roles ?? [],
  };
});
