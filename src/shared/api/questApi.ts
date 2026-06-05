import { defaultApiClient } from '@/shared/lib/apiClient'
import { requireUserAuthHeaders } from '@/shared/api/parts/authHeaders'
import {
  getLocationDetail,
  linkQuestToLocation,
  listLocations,
  unlinkQuestFromLocation,
} from '@/shared/api/locationApi'
import { API_ROUTES } from '@/shared/api/routes/apiRoutes'
import type { components } from '@/shared/api/generated/schema'

export { linkQuestToLocation, unlinkQuestFromLocation }

/** Контракт POST /db/campaign/{campaignId}/quest (ещё не в schema.yaml). */
export type CreateQuestRequest = {
  title: string
  description?: string
}

export type QuestResponse = {
  id: string
  campaign_id?: string
  title: string
  description?: string
  created_at?: string
  updated_at?: string
}

export async function createQuest(
  campaignId: string,
  body: CreateQuestRequest,
  signal?: AbortSignal
): Promise<QuestResponse> {
  const res = await defaultApiClient.post<QuestResponse>(
    API_ROUTES.db.quest(campaignId),
    body,
    {
      headers: requireUserAuthHeaders(),
      signal,
      source: 'questApi.createQuest',
    }
  )
  if (!res?.id) {
    throw new Error('Пустой ответ при создании квеста')
  }
  return res
}

export type LocationQuestDetail = {
  locationId: string
  detail: components['schemas']['LocationDetailResponse']
}

/** Собирает quest_ids по всем локациям кампании (OpenAPI: GET location + GET location detail). */
export async function fetchCampaignLocationQuestDetails(
  campaignId: string,
  signal?: AbortSignal
): Promise<LocationQuestDetail[]> {
  const { locations } = await listLocations(campaignId, signal)
  const results = await Promise.all(
    locations.map(async (loc) => {
      try {
        const detail = await getLocationDetail(campaignId, loc.id, signal)
        return { locationId: loc.id, detail }
      } catch {
        return null
      }
    })
  )
  return results.filter((r): r is LocationQuestDetail => r !== null)
}
