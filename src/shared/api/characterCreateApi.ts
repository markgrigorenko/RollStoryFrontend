import { defaultApiClient } from '@/shared/lib/apiClient'
import { requireUserAuthHeaders } from '@/shared/api/parts/authHeaders'
import { API_ROUTES } from '@/shared/api/routes/apiRoutes'
import type { components } from '@/shared/api/generated/schema'

const routes = API_ROUTES.db.characterCreate

export async function startCharacterCreation(
  campaignId: string,
  body: components['schemas']['StartCharacterCreationRequest'],
  signal?: AbortSignal
): Promise<components['schemas']['StartCharacterCreationResponse']> {
  const res = await defaultApiClient.post<
    components['schemas']['StartCharacterCreationResponse']
  >(routes.start(campaignId), body, {
    headers: requireUserAuthHeaders(),
    signal,
    source: 'characterCreateApi.start',
  })
  if (!res) throw new Error('Пустой ответ startCharacterCreation')
  return res
}

export async function postCharacterBasicInfo(
  campaignId: string,
  body: components['schemas']['BasicInfoRequest'],
  signal?: AbortSignal
): Promise<components['schemas']['BasicInfoResponse']> {
  const res = await defaultApiClient.post<components['schemas']['BasicInfoResponse']>(
    routes.basicInfo(campaignId),
    body,
    {
      headers: requireUserAuthHeaders(),
      signal,
      source: 'characterCreateApi.basicInfo',
    }
  )
  if (!res) throw new Error('Пустой ответ basicInfo')
  return res
}

export async function postCharacterPointBuy(
  campaignId: string,
  body: components['schemas']['PointBuyRequest'],
  signal?: AbortSignal
): Promise<components['schemas']['PointBuyResponse']> {
  const res = await defaultApiClient.post<components['schemas']['PointBuyResponse']>(
    routes.pointBuy(campaignId),
    body,
    {
      headers: requireUserAuthHeaders(),
      signal,
      source: 'characterCreateApi.pointBuy',
    }
  )
  if (!res) throw new Error('Пустой ответ pointBuy')
  return res
}

export async function postCharacterAsi(
  campaignId: string,
  body: components['schemas']['ASIRequest'],
  signal?: AbortSignal
): Promise<components['schemas']['ASIResponse']> {
  const res = await defaultApiClient.post<components['schemas']['ASIResponse']>(
    routes.asi(campaignId),
    body,
    {
      headers: requireUserAuthHeaders(),
      signal,
      source: 'characterCreateApi.asi',
    }
  )
  if (!res) throw new Error('Пустой ответ asi')
  return res
}

export async function postCharacterProficiencies(
  campaignId: string,
  body: components['schemas']['ProficienciesRequest'],
  signal?: AbortSignal
): Promise<components['schemas']['ProficienciesResponse']> {
  const res = await defaultApiClient.post<components['schemas']['ProficienciesResponse']>(
    routes.proficiencies(campaignId),
    body,
    {
      headers: requireUserAuthHeaders(),
      signal,
      source: 'characterCreateApi.proficiencies',
    }
  )
  if (!res) throw new Error('Пустой ответ proficiencies')
  return res
}

export async function rewindCharacterCreationStep(
  campaignId: string,
  body: components['schemas']['RewindStepRequest'],
  signal?: AbortSignal
): Promise<void> {
  await defaultApiClient.post<undefined>(routes.rewind(campaignId), body, {
    headers: requireUserAuthHeaders(),
    signal,
    source: 'characterCreateApi.rewind',
  })
}

export async function completeCharacterCreation(
  campaignId: string,
  body: components['schemas']['CompleteCharacterRequest'],
  signal?: AbortSignal
): Promise<components['schemas']['CompleteCharacterResponse']> {
  const res = await defaultApiClient.post<
    components['schemas']['CompleteCharacterResponse']
  >(routes.complete(campaignId), body, {
    headers: requireUserAuthHeaders(),
    signal,
    source: 'characterCreateApi.complete',
  })
  if (!res) throw new Error('Пустой ответ complete')
  return res
}
