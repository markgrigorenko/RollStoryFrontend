import { httpFetch } from '@/shared/api/parts/httpFetch'
import { resolveApiUrl } from '@/shared/lib/apiBaseUrl'

export { getApiBaseUrl, resolveApiUrl } from '@/shared/lib/apiBaseUrl'
export { HttpError } from '@/shared/api/parts/defaultErrors'

export async function postJson<TResponse, TBody extends object>(
  path: string,
  body: TBody,
  extraHeaders?: Record<string, string>,
  signal?: AbortSignal,
  options?: { skipBearer?: boolean }
): Promise<TResponse> {
  const url = resolveApiUrl(path)
  const res = await httpFetch<TResponse>(url, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
    signal,
    source: 'postJson',
    skipBearer: options?.skipBearer,
  })
  return res as TResponse
}
