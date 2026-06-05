import { httpFetch } from '@/shared/api/parts/httpFetch'
import { resolveApiUrl } from '@/shared/lib/apiBaseUrl'

function joinUrl(base: string, query?: Record<string, string>): string {
  if (!query || Object.keys(query).length === 0) {
    return base
  }
  const u = new URL(base, window.location.origin)
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== '') {
      u.searchParams.append(k, v)
    }
  }
  return u.pathname + u.search + u.hash
}

export type ApiCallContext = {
  signal?: AbortSignal
  source?: string
  skipBearer?: boolean
  headers?: Record<string, string>
}

export class ApiClient {
  constructor(
    private readonly resolvePath: (path: string) => string = resolveApiUrl
  ) {}

  private buildUrl(endpoint: string, query?: Record<string, string>): string {
    const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
    const base = this.resolvePath(path)
    return joinUrl(base, query)
  }

  get<T>(endpoint: string, query?: Record<string, string>, ctx?: ApiCallContext) {
    const source = ctx?.source ?? 'apiClient.get'
    return httpFetch<T>(this.buildUrl(endpoint, query), {
      method: 'GET',
      headers: ctx?.headers,
      signal: ctx?.signal,
      source,
      skipBearer: ctx?.skipBearer,
    })
  }

  post<T>(endpoint: string, body?: object | null, ctx?: ApiCallContext) {
    const payload =
      body === undefined || body === null ? undefined : JSON.stringify(body)
    const source = ctx?.source ?? 'apiClient.post'
    return httpFetch<T>(this.buildUrl(endpoint), {
      method: 'POST',
      headers: ctx?.headers,
      body: payload,
      signal: ctx?.signal,
      source,
      skipBearer: ctx?.skipBearer,
    })
  }

  put<T>(endpoint: string, body?: object | null, ctx?: ApiCallContext) {
    const payload =
      body === undefined || body === null ? undefined : JSON.stringify(body)
    const source = ctx?.source ?? 'apiClient.put'
    return httpFetch<T>(this.buildUrl(endpoint), {
      method: 'PUT',
      headers: ctx?.headers,
      body: payload,
      signal: ctx?.signal,
      source,
      skipBearer: ctx?.skipBearer,
    })
  }

  patch<T>(endpoint: string, body?: object | null, ctx?: ApiCallContext) {
    const payload =
      body === undefined || body === null ? undefined : JSON.stringify(body)
    const source = ctx?.source ?? 'apiClient.patch'
    return httpFetch<T>(this.buildUrl(endpoint), {
      method: 'PATCH',
      headers: ctx?.headers,
      body: payload,
      signal: ctx?.signal,
      source,
      skipBearer: ctx?.skipBearer,
    })
  }

  delete<T>(endpoint: string, body?: object | null, ctx?: ApiCallContext) {
    const payload =
      body === undefined || body === null ? undefined : JSON.stringify(body)
    const source = ctx?.source ?? 'apiClient.delete'
    return httpFetch<T>(this.buildUrl(endpoint), {
      method: 'DELETE',
      headers: ctx?.headers,
      body: payload,
      signal: ctx?.signal,
      source,
      skipBearer: ctx?.skipBearer,
    })
  }
}

export const defaultApiClient = new ApiClient()
