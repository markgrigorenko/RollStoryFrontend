import { defaultApiClient } from '@/shared/lib/apiClient'
import { requireUserAuthHeaders } from '@/shared/api/parts/authHeaders'
import { API_ROUTES } from '@/shared/api/routes/apiRoutes'
import type { components } from '@/shared/api/generated/schema'

export async function listCharacters(
  campaignId: string,
  signal?: AbortSignal
): Promise<components['schemas']['ListCharactersResponse']> {
  const res = await defaultApiClient.get<components['schemas']['ListCharactersResponse']>(
    API_ROUTES.db.characters(campaignId),
    undefined,
    {
      headers: requireUserAuthHeaders(),
      signal,
      source: 'characterApi.listCharacters',
    }
  )
  if (!res) {
    throw new Error('Пустой ответ при запросе персонажей')
  }
  return res
}

export async function getCharacterDetail(
  campaignId: string,
  characterId: string,
  signal?: AbortSignal
): Promise<components['schemas']['CharacterDetailResponse']> {
  const res = await defaultApiClient.get<components['schemas']['CharacterDetailResponse']>(
    API_ROUTES.db.character(campaignId, characterId),
    undefined,
    {
      headers: requireUserAuthHeaders(),
      signal,
      source: 'characterApi.getCharacterDetail',
    }
  )
  if (!res) {
    throw new Error('Пустой ответ при запросе персонажа')
  }
  return res
}

export async function generateCharacter(
  campaignId: string,
  body: components['schemas']['GenerateCharacterRequest'],
  signal?: AbortSignal
): Promise<components['schemas']['CharacterDetailResponse']> {
  const res = await defaultApiClient.post<components['schemas']['CharacterDetailResponse']>(
    API_ROUTES.db.characterGenerate(campaignId),
    body,
    {
      headers: requireUserAuthHeaders(),
      signal,
      source: 'characterApi.generateCharacter',
    }
  )
  if (!res) {
    throw new Error('Пустой ответ при генерации персонажа')
  }
  return res
}

export async function createCharacterRelation(
  campaignId: string,
  body: components['schemas']['CreateCharacterRelationRequest'],
  signal?: AbortSignal
): Promise<components['schemas']['CreateCharacterRelationResponse']> {
  const res = await defaultApiClient.post<
    components['schemas']['CreateCharacterRelationResponse']
  >(API_ROUTES.db.characterRelation(campaignId), body, {
    headers: requireUserAuthHeaders(),
    signal,
    source: 'characterApi.createCharacterRelation',
  })
  if (!res) {
    throw new Error('Пустой ответ при создании связи')
  }
  return res
}

export async function deleteCharacterRelation(
  campaignId: string,
  body: components['schemas']['DeleteCharacterRelationRequest'],
  signal?: AbortSignal
): Promise<void> {
  await defaultApiClient.delete<undefined>(API_ROUTES.db.characterRelation(campaignId), body, {
    headers: requireUserAuthHeaders(),
    signal,
    source: 'characterApi.deleteCharacterRelation',
  })
}
