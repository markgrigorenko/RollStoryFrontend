import { HttpError, postJson, resolveApiUrl } from './client'
import { defaultApiClient } from '@/shared/lib/apiClient'
import { refreshAuthHeaders } from '@/shared/api/parts/authHeaders'
import { API_ROUTES } from '@/shared/api/routes/apiRoutes'
import {
  parseVerifyEmailReasonFromLocation,
  isVerifyEmailErrorLocation,
} from '@/shared/lib/verifyEmailErrors'
import type { components } from '@/shared/api/generated/schema'

export type VerifyEmailResult =
  | { status: 'success' }
  | { status: 'error'; reason: string }

export type SignUpRequestBody = components['schemas']['SigninRequest']
export type SignUpResponseBody = components['schemas']['SigninResponse']
export type LoginRequestBody = components['schemas']['LoginRequest']
export type LoginResponseBody = components['schemas']['LoginResponse']

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

/** Подтверждение email (GET /auth/verify-email?token=...). */
export async function verifyEmail(
  token: string,
  signal?: AbortSignal
): Promise<VerifyEmailResult> {
  const url = `${resolveApiUrl(API_ROUTES.auth.verifyEmail)}?${new URLSearchParams({ token })}`

  const response = await fetch(url, { method: 'GET', redirect: 'manual', signal })
  const location = response.headers.get('Location')

  if (location) {
    const reason = parseVerifyEmailReasonFromLocation(location)
    if (reason && isVerifyEmailErrorLocation(location)) {
      return { status: 'error', reason }
    }
    if (response.status >= 300 && response.status < 400) {
      return { status: 'success' }
    }
  }

  // Cross-origin 302: Location недоступен, status может быть 0 — редирект всё равно означает ответ verify-email.
  if (response.type === 'opaqueredirect' || response.status === 0) {
    return { status: 'success' }
  }

  if (response.status >= 300 && response.status < 400) {
    return { status: 'success' }
  }

  if (!response.ok) {
    const text = await response.text()
    throw new HttpError(
      text || response.statusText || 'Ошибка подтверждения email',
      response.status,
      text
    )
  }

  return { status: 'success' }
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
