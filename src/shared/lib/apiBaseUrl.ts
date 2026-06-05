const DEFAULT_BASE = 'https://api.rollstory.org/v1'

function readBaseFromEnv(): string | undefined {
  const fromApi = import.meta.env.VITE_API_BASE_URL
  if (typeof fromApi === 'string' && fromApi.trim().length > 0) {
    return fromApi.trim().replace(/\/$/, '')
  }
  const fromBackend = import.meta.env.VITE_BACKEND_BASE_URL
  if (typeof fromBackend === 'string' && fromBackend.trim().length > 0) {
    return fromBackend.trim().replace(/\/$/, '')
  }
  return undefined
}

/** База без завершающего /; в dev без env — пустая строка (тогда URL — `/v1` + path под Vite proxy). */
export function getApiBaseUrl(): string {
  const u = readBaseFromEnv()
  if (u !== undefined) {
    return u
  }
  if (import.meta.env.DEV) {
    return ''
  }
  return DEFAULT_BASE
}

/** Полный URL запроса к API (в dev по умолчанию — относительный `/v1/...`). */
export function resolveApiUrl(path: string): string {
  const rel = path.startsWith('/') ? path : `/${path}`
  const base = getApiBaseUrl()
  if (base.length === 0) {
    return `/v1${rel}`
  }
  return `${base}${rel}`
}
