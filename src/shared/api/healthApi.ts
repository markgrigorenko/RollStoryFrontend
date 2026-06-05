import { defaultApiClient } from '@/shared/lib/apiClient'
import { API_ROUTES } from '@/shared/api/routes/apiRoutes'
import type { components } from '@/shared/api/generated/schema'

export async function fetchHealthPing(
  signal?: AbortSignal
): Promise<components['schemas']['OkResponse']> {
  const res = await defaultApiClient.get<components['schemas']['OkResponse']>(
    API_ROUTES.hc.ping,
    undefined,
    { signal, source: 'healthApi.ping', skipBearer: true }
  )
  if (!res) {
    throw new Error('Пустой ответ hc/ping')
  }
  return res
}

export async function fetchHealthReady(
  signal?: AbortSignal
): Promise<components['schemas']['OkResponse']> {
  const res = await defaultApiClient.get<components['schemas']['OkResponse']>(
    API_ROUTES.hc.ready,
    undefined,
    { signal, source: 'healthApi.ready', skipBearer: true }
  )
  if (!res) {
    throw new Error('Пустой ответ hc/ready')
  }
  return res
}
