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

export type QuestResponse = components['schemas']['QuestResponse']
export type QuestStatus = components['schemas']['QuestStatus']
export type QuestOutcome = components['schemas']['QuestOutcome']

export type CreateQuestRequest = {
  title: string
  description?: string
  tags?: string[]
}

export async function createQuest(
  campaignId: string,
  body: CreateQuestRequest,
  signal?: AbortSignal
): Promise<QuestResponse> {
  const res = await defaultApiClient.post<QuestResponse>(
    API_ROUTES.db.quest(campaignId),
    {
      title: body.title,
      description: body.description ?? '',
      ...(body.tags ? { tags: body.tags } : {}),
    } satisfies components['schemas']['CreateQuestRequest'],
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

export async function listQuests(
  campaignId: string,
  signal?: AbortSignal
): Promise<components['schemas']['ListQuestsResponse']> {
  const res = await defaultApiClient.get<components['schemas']['ListQuestsResponse']>(
    API_ROUTES.db.quest(campaignId),
    undefined,
    {
      headers: requireUserAuthHeaders(),
      signal,
      source: 'questApi.listQuests',
    }
  )
  if (!res) {
    throw new Error('Пустой ответ при запросе квестов')
  }
  return res
}

export async function activateQuest(
  campaignId: string,
  questId: string,
  signal?: AbortSignal
): Promise<void> {
  await defaultApiClient.post<undefined>(
    API_ROUTES.db.questActivate(campaignId, questId),
    null,
    {
      headers: requireUserAuthHeaders(),
      signal,
      source: 'questApi.activateQuest',
    }
  )
}

export async function completeQuest(
  campaignId: string,
  questId: string,
  outcome: QuestOutcome,
  signal?: AbortSignal
): Promise<void> {
  await defaultApiClient.post<undefined>(
    API_ROUTES.db.questComplete(campaignId, questId),
    { outcome } satisfies components['schemas']['CompleteQuestRequest'],
    {
      headers: requireUserAuthHeaders(),
      signal,
      source: 'questApi.completeQuest',
    }
  )
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
