import { defaultApiClient } from '@/shared/lib/apiClient'
import { requireUserAuthHeaders } from '@/shared/api/parts/authHeaders'
import { API_ROUTES } from '@/shared/api/routes/apiRoutes'
import type { components } from '@/shared/api/generated/schema'

export async function createLocation(
  campaignId: string,
  body: components['schemas']['CreateLocationRequest'],
  signal?: AbortSignal
): Promise<components['schemas']['LocationResponse']> {
  const res = await defaultApiClient.post<components['schemas']['LocationResponse']>(
    API_ROUTES.db.location(campaignId),
    body,
    {
      headers: requireUserAuthHeaders(),
      signal,
      source: 'locationApi.createLocation',
    }
  )
  if (!res) {
    throw new Error('Пустой ответ при создании локации')
  }
  return res
}

export async function listLocations(
  campaignId: string,
  signal?: AbortSignal
): Promise<components['schemas']['ListLocationsResponse']> {
  const res = await defaultApiClient.get<components['schemas']['ListLocationsResponse']>(
    API_ROUTES.db.locations(campaignId),
    undefined,
    {
      headers: requireUserAuthHeaders(),
      signal,
      source: 'locationApi.listLocations',
    }
  )
  if (!res) {
    throw new Error('Пустой ответ при запросе локаций')
  }
  return res
}

export async function getLocationDetail(
  campaignId: string,
  locationId: string,
  signal?: AbortSignal
): Promise<components['schemas']['LocationDetailResponse']> {
  const res = await defaultApiClient.get<components['schemas']['LocationDetailResponse']>(
    API_ROUTES.db.locationById(campaignId, locationId),
    undefined,
    {
      headers: requireUserAuthHeaders(),
      signal,
      source: 'locationApi.getLocationDetail',
    }
  )
  if (!res) {
    throw new Error('Пустой ответ при запросе локации')
  }
  return res
}

export async function updateLocation(
  campaignId: string,
  locationId: string,
  body: components['schemas']['UpdateLocationRequest'],
  signal?: AbortSignal
): Promise<components['schemas']['LocationResponse']> {
  const res = await defaultApiClient.patch<components['schemas']['LocationResponse']>(
    API_ROUTES.db.locationById(campaignId, locationId),
    body,
    {
      headers: requireUserAuthHeaders(),
      signal,
      source: 'locationApi.updateLocation',
    }
  )
  if (!res) {
    throw new Error('Пустой ответ при обновлении локации')
  }
  return res
}

export async function deleteLocation(
  campaignId: string,
  locationId: string,
  signal?: AbortSignal
): Promise<void> {
  await defaultApiClient.delete<undefined>(
    API_ROUTES.db.locationById(campaignId, locationId),
    null,
    {
      headers: requireUserAuthHeaders(),
      signal,
      source: 'locationApi.deleteLocation',
    }
  )
}

export async function linkCharacterToLocation(
  campaignId: string,
  locationId: string,
  characterId: string,
  signal?: AbortSignal
): Promise<void> {
  await defaultApiClient.post<undefined>(
    API_ROUTES.db.locationCharacter(campaignId, locationId, characterId),
    null,
    {
      headers: requireUserAuthHeaders(),
      signal,
      source: 'locationApi.linkCharacterToLocation',
    }
  )
}

export async function unlinkCharacterFromLocation(
  campaignId: string,
  locationId: string,
  characterId: string,
  signal?: AbortSignal
): Promise<void> {
  await defaultApiClient.delete<undefined>(
    API_ROUTES.db.locationCharacter(campaignId, locationId, characterId),
    null,
    {
      headers: requireUserAuthHeaders(),
      signal,
      source: 'locationApi.unlinkCharacterFromLocation',
    }
  )
}

export async function linkQuestToLocation(
  campaignId: string,
  locationId: string,
  questId: string,
  signal?: AbortSignal
): Promise<void> {
  await defaultApiClient.post<undefined>(
    API_ROUTES.db.locationQuest(campaignId, locationId, questId),
    null,
    {
      headers: requireUserAuthHeaders(),
      signal,
      source: 'locationApi.linkQuestToLocation',
    }
  )
}

export async function unlinkQuestFromLocation(
  campaignId: string,
  locationId: string,
  questId: string,
  signal?: AbortSignal
): Promise<void> {
  await defaultApiClient.delete<undefined>(
    API_ROUTES.db.locationQuest(campaignId, locationId, questId),
    null,
    {
      headers: requireUserAuthHeaders(),
      signal,
      source: 'locationApi.unlinkQuestFromLocation',
    }
  )
}
