import { getAccessToken, isDevBypassSession } from '@/shared/lib/authSession'
import {
  AuthFailedError,
  HttpError,
  InternalServerError,
  InvalidCredentialsError,
  parseErrorMessageFromBody,
} from './defaultErrors'
import { buildReportParams, reportHttpErrorToSentry } from './reportHttpErrorToSentry'

export type HttpFetchInit = {
  method?: string
  headers?: Record<string, string>
  body?: BodyInit | null
  signal?: AbortSignal
  /** Источник для Sentry (стабильная строка). */
  source: string
  /** Не подставлять Bearer из сессии (публичные эндпоинты). */
  skipBearer?: boolean
}

function mergeHeaders(
  base: Record<string, string>,
  extra?: Record<string, string>
): Record<string, string> {
  return { ...base, ...extra }
}

function bearerFromSession(): string | null {
  const t = getAccessToken()
  if (!t) return null
  return t.startsWith('Bearer ') ? t : `Bearer ${t}`
}

export function httpFetch<T>(url: string, init: HttpFetchInit, retriedAfterRefresh = false): Promise<T | undefined> {
  const { method = 'GET', headers: extraHeaders, body, signal, source, skipBearer } = init

  const baseHeaders: Record<string, string> = {}
  const hasContentType =
    extraHeaders &&
    Object.keys(extraHeaders).some((k) => k.toLowerCase() === 'content-type')
  if (body !== undefined && body !== null && !(body instanceof FormData) && !hasContentType) {
    baseHeaders['Content-Type'] = 'application/json'
  }

  let headers = mergeHeaders(baseHeaders, extraHeaders)
  const hasAuth = Object.keys(headers).some((k) => k.toLowerCase() === 'authorization')
  if (!skipBearer && !hasAuth) {
    const bearer = bearerFromSession()
    if (bearer) {
      headers = { ...headers, Authorization: bearer }
    }
  }

  return fetch(url, { method, headers, body: body ?? undefined, signal }).then(async (response) => {
    const text = await response.text()
    let parsed: unknown = null
    if (text.length > 0) {
      const ct = response.headers.get('content-type') ?? ''
      if (ct.includes('application/json')) {
        try {
          parsed = JSON.parse(text) as unknown
        } catch {
          parsed = null
        }
      }
    }

    if (!response.ok) {
      const msg = parseErrorMessageFromBody(parsed, response.statusText || 'Ошибка запроса')
      if (
        response.status === 401 &&
        !skipBearer &&
        !retriedAfterRefresh &&
        !isDevBypassSession() &&
        !source.includes('authApi.refreshTokens')
      ) {
        const { tryRefreshSession } = await import('./tryRefreshSession')
        const refreshed = await tryRefreshSession()
        if (refreshed) {
          return httpFetch<T>(url, init, true)
        }
      }
      reportHttpErrorToSentry(
        buildReportParams(source, url, method, response.status, new Error(msg), text)
      )
      const err = mapStatusToError(response.status, msg, parsed)
      throw err
    }

    if (response.status === 204 || text.length === 0) {
      return undefined as T | undefined
    }

    const ct = response.headers.get('content-type') ?? ''
    if (ct.includes('application/json') && parsed !== null) {
      return parsed as T
    }

    return text as unknown as T
  })
}

function mapStatusToError(status: number, message: string, body: unknown): Error {
  // body протаскиваем во все подклассы, чтобы UI мог достать machine-readable
  // `reason` из ErrorResponse (например, login → reason: "email_not_verified").
  if (status === 401) {
    return new AuthFailedError(message, body)
  }
  if (status === 403) {
    return new InvalidCredentialsError(message, body)
  }
  if (status === 500) {
    return new InternalServerError(message, body)
  }
  return new HttpError(message, status, body)
}
