/** Тело ошибки API (`ErrorResponse` в schema.yaml). */
export type ErrorResponseBody = {
  error: string
}

export function parseErrorMessageFromBody(parsed: unknown, fallback: string): string {
  if (
    parsed &&
    typeof parsed === 'object' &&
    'error' in parsed &&
    typeof (parsed as ErrorResponseBody).error === 'string'
  ) {
    return (parsed as ErrorResponseBody).error
  }
  return fallback
}

/** Текст для UI: обрезка пробелов и заглавная первая буква (в т.ч. кириллица). */
export function formatApiErrorMessageForDisplay(message: string): string {
  const t = message.trim()
  if (t.length === 0) return message
  return t.charAt(0).toLocaleUpperCase() + t.slice(1)
}

/** Обёртка над HTTP-ошибкой с телом ответа (совместимость с прежним `HttpError`). */
export class HttpError extends Error {
  override name = 'HttpError'
  constructor(
    message: string,
    readonly status: number,
    readonly body: unknown
  ) {
    super(formatApiErrorMessageForDisplay(message))
  }
}

export class InternalServerError extends HttpError {
  override name = 'InternalServerError'
  constructor(message = 'Внутренняя ошибка сервера', body: unknown = null) {
    super(message, 500, body)
  }
}

export class InvalidCredentialsError extends HttpError {
  override name = 'InvalidCredentialsError'
  constructor(message = 'Недостаточно прав', body: unknown = null) {
    super(message, 403, body)
  }
}

export class AuthFailedError extends HttpError {
  override name = 'AuthFailedError'
  constructor(message = 'Требуется авторизация', body: unknown = null) {
    super(message, 401, body)
  }
}

export class AuthStateError extends Error {
  override name = 'AuthStateError'
  constructor(message = 'Нет данных сессии для запроса') {
    super(message)
  }
}
