import { refreshTokens } from '@/shared/api/authApi'
import { getRefreshToken, saveAuthSession } from '@/shared/lib/authSession'

let refreshInFlight: Promise<boolean> | null = null

/** Один refresh за раз; возвращает true, если сессия обновлена. */
export async function tryRefreshSession(): Promise<boolean> {
  if (!getRefreshToken()) {
    return false
  }
  if (refreshInFlight) {
    return refreshInFlight
  }
  refreshInFlight = (async () => {
    try {
      const res = await refreshTokens()
      saveAuthSession({
        userId: res.userId,
        accessToken: res.accessToken,
        refreshToken: res.refreshToken,
      })
      return true
    } catch {
      return false
    } finally {
      refreshInFlight = null
    }
  })()
  return refreshInFlight
}
