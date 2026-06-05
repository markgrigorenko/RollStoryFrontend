import { AuthStateError } from '@/shared/api/parts/defaultErrors'
import { getAccessToken, getRefreshToken, getStoredUserId } from '@/shared/lib/authSession'
import { getOrCreateDeviceId } from '@/shared/lib/deviceId'

/** Только Bearer access (редкие эндпоинты без X-User-Id). */
export function requireBearerAuthHeaders(): Record<string, string> {
  const token = getAccessToken()
  if (!token) {
    throw new AuthStateError('Нет access-токена')
  }
  const authorization = token.startsWith('Bearer ') ? token : `Bearer ${token}`
  return { Authorization: authorization }
}

/** Заголовки для защищённых эндпоинтов: Bearer access + X-User-Id. */
export function requireUserAuthHeaders(): Record<string, string> {
  const token = getAccessToken()
  const userId = getStoredUserId()
  if (!token) {
    throw new AuthStateError('Нет access-токена')
  }
  if (!userId) {
    throw new AuthStateError('Нет идентификатора пользователя')
  }
  const authorization = token.startsWith('Bearer ') ? token : `Bearer ${token}`
  return {
    Authorization: authorization,
    'X-User-Id': userId,
  }
}

/** POST /auth/refresh: Authorization (Bearer refresh), X-User-Id, X-Device-Id. */
export function refreshAuthHeaders(): Record<string, string> {
  const refresh = getRefreshToken()
  const userId = getStoredUserId()
  if (!refresh) {
    throw new AuthStateError('Нет refresh-токена')
  }
  if (!userId) {
    throw new AuthStateError('Нет идентификатора пользователя')
  }
  const authorization = refresh.startsWith('Bearer ') ? refresh : `Bearer ${refresh}`
  return {
    Authorization: authorization,
    'X-User-Id': userId,
    'X-Device-Id': getOrCreateDeviceId(),
  }
}
