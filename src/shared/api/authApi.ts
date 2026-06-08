import { HttpError, postJson, resolveApiUrl } from './client'
import { defaultApiClient } from '@/shared/lib/apiClient'
import { refreshAuthHeaders } from '@/shared/api/parts/authHeaders'
import { API_ROUTES } from '@/shared/api/routes/apiRoutes'
import { verifyEmailReasonFromStatus, type VerifyEmailReason } from '@/shared/lib/verifyEmailErrors'
import type { components } from '@/shared/api/generated/schema'

export type VerifyEmailResult =
  | { status: 'success' }
  | { status: 'error'; reason: VerifyEmailReason }

export type SignUpRequestBody = components['schemas']['SigninRequest']
export type SignUpResponseBody = components['schemas']['SigninResponse']
export type LoginRequestBody = components['schemas']['LoginRequest']
export type LoginResponseBody = components['schemas']['LoginResponse']
export type ResendVerificationRequestBody = components['schemas']['ResendVerificationRequest']

/** Регистрация пользователя (OpenAPI: POST /auth/signin). */
export function signUp(body: SignUpRequestBody, signal?: AbortSignal): Promise<SignUpResponseBody> {
  return postJson<SignUpResponseBody, SignUpRequestBody>(
    API_ROUTES.auth.signin,
    body,
    undefined,
    signal,
    {
      skipBearer: true,
    }
  )
}

/** Логин (OpenAPI: POST /auth/login, обязателен заголовок X-Device-Id). */
export function login(
  body: LoginRequestBody,
  deviceId: string,
  signal?: AbortSignal
): Promise<LoginResponseBody> {
  return postJson<LoginResponseBody, LoginRequestBody>(
    API_ROUTES.auth.login,
    body,
    {
      'X-Device-Id': deviceId,
    },
    signal,
    { skipBearer: true }
  )
}

/**
 * Подтверждение email (GET /auth/verify-email?token=...).
 *
 * Бэкенд отдаёт JSON со статусами:
 *   200 → ok; 400 → empty; 403 → expired; 404 → not_found; 409 → used; 500 → internal.
 * Если в теле ошибки есть поле `reason` — используем его, иначе маппим по статусу.
 *
 * Сетевые ошибки (CORS, offline) — обычный throw. Всё остальное возвращается
 * как `VerifyEmailResult`, чтобы UI мог разветвлять рендер без try/catch.
 */
export async function verifyEmail(
  token: string,
  signal?: AbortSignal
): Promise<VerifyEmailResult> {
  const url = `${resolveApiUrl(API_ROUTES.auth.verifyEmail)}?${new URLSearchParams({ token })}`

  // skipBearer не нужен — это публичный эндпоинт, но `fetch` напрямую не дёргает
  // refresh-flow и не подставляет токены, поэтому достаточно plain fetch.
  const response = await fetch(url, { method: 'GET', signal })

  if (response.ok) {
    return { status: 'success' }
  }

  // Пробуем достать reason из тела (ErrorResponse). Если бэк не положил —
  // маппим по HTTP-статусу.
  let reason: string | null = null
  const ct = response.headers.get('content-type') ?? ''
  if (ct.includes('application/json')) {
    try {
      const body = (await response.json()) as { reason?: unknown }
      if (typeof body.reason === 'string' && body.reason.length > 0) {
        reason = body.reason
      }
    } catch {
      // Невалидный JSON — fallback ниже.
    }
  }

  return {
    status: 'error',
    reason: (reason as VerifyEmailReason) ?? verifyEmailReasonFromStatus(response.status),
  }
}

/**
 * Повторная отправка письма подтверждения email (POST /auth/resend-verification).
 * Принимает email+password как «лёгкую авторизацию». Всегда возвращает 204 —
 * фронту нельзя различать «не нашли пользователя» и «успешно отправили»,
 * чтобы избежать перечисления аккаунтов.
 */
export async function resendVerification(
  body: ResendVerificationRequestBody,
  signal?: AbortSignal
): Promise<void> {
  await postJson<void, ResendVerificationRequestBody>(
    API_ROUTES.auth.resendVerification,
    body,
    undefined,
    signal,
    { skipBearer: true }
  )
}

/** Обновление пары JWT (POST /auth/refresh). В `Authorization` передаётся refresh-токен. */
export async function refreshTokens(signal?: AbortSignal): Promise<LoginResponseBody> {
  const res = await defaultApiClient.post<LoginResponseBody>(
    API_ROUTES.auth.refresh,
    null,
    {
      headers: refreshAuthHeaders(),
      signal,
      source: 'authApi.refreshTokens',
    }
  )
  if (!res) {
    throw new Error('Пустой ответ refresh')
  }
  return res
}

// HttpError остаётся в экспортах для обратной совместимости с view-ами,
// которые ловят его при сетевых сбоях refresh/login.
export { HttpError }
