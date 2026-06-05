const ACCESS_TOKEN_KEY = 'rs_access_token'
const REFRESH_TOKEN_KEY = 'rs_refresh_token'
const USER_ID_KEY = 'rs_user_id'

/** Маркер dev-сессии без реального JWT (только `import.meta.env.DEV`). */
export const DEV_BYPASS_ACCESS_TOKEN = 'dev-bypass-access'

/** Фиксированный UUID для заголовка X-User-Id в dev. */
const DEV_BYPASS_USER_ID = '00000000-0000-4000-8000-000000000001'

export type AuthSessionPayload = {
  userId: string
  accessToken: string
  refreshToken: string
}

export function saveAuthSession(res: AuthSessionPayload): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, res.accessToken)
  localStorage.setItem(REFRESH_TOKEN_KEY, res.refreshToken)
  localStorage.setItem(USER_ID_KEY, res.userId)
}

export function clearAuthSession(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
  localStorage.removeItem(USER_ID_KEY)
}

export function isDevAuthBypassEnabled(): boolean {
  return import.meta.env.DEV || import.meta.env.VITE_DEV_AUTH_BYPASS === 'true'
}

export function isDevBypassSession(): boolean {
  return isDevAuthBypassEnabled() && getAccessToken() === DEV_BYPASS_ACCESS_TOKEN
}

/** Локальный вход без API (dev / VITE_DEV_AUTH_BYPASS). */
export function enterDevBypassSession(): void {
  if (!isDevAuthBypassEnabled()) return
  saveAuthSession({
    userId: DEV_BYPASS_USER_ID,
    accessToken: DEV_BYPASS_ACCESS_TOKEN,
    refreshToken: 'dev-bypass-refresh',
  })
}

export function isAuthenticated(): boolean {
  return Boolean(localStorage.getItem(ACCESS_TOKEN_KEY))
}

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY)
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY)
}

export function getStoredUserId(): string | null {
  return localStorage.getItem(USER_ID_KEY)
}
