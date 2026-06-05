import { defaultApiClient } from '@/shared/lib/apiClient'
import { requireUserAuthHeaders } from '@/shared/api/parts/authHeaders'
import { API_ROUTES } from '@/shared/api/routes/apiRoutes'
import type { components } from '@/shared/api/generated/schema'

export async function createCampaign(
  body: components['schemas']['CreateCampaignRequest'],
  signal?: AbortSignal
): Promise<components['schemas']['CreateCampaignResponse']> {
  const res = await defaultApiClient.post<components['schemas']['CreateCampaignResponse']>(
    API_ROUTES.db.campaign,
    body,
    {
      headers: requireUserAuthHeaders(),
      signal,
      source: 'campaignApi.createCampaign',
    }
  )
  if (!res) {
    throw new Error('Пустой ответ при создании кампании')
  }
  return res
}

export async function listCampaigns(
  signal?: AbortSignal
): Promise<components['schemas']['ListCampaignsResponse']> {
  const res = await defaultApiClient.get<components['schemas']['ListCampaignsResponse']>(
    API_ROUTES.db.campaigns,
    undefined,
    {
      headers: requireUserAuthHeaders(),
      signal,
      source: 'campaignApi.listCampaigns',
    }
  )
  if (!res) {
    throw new Error('Пустой ответ при запросе кампаний')
  }
  return res
}

export async function deleteCampaign(campaignId: string, signal?: AbortSignal): Promise<void> {
  await defaultApiClient.delete<undefined>(
    API_ROUTES.db.campaignById(campaignId),
    null,
    {
      headers: requireUserAuthHeaders(),
      signal,
      source: 'campaignApi.deleteCampaign',
    }
  )
}
