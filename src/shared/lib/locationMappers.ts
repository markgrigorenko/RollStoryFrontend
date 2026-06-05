import type { components } from '@/shared/api/generated/schema'
import { resolveQuestDisplay, type QuestDisplayInfo } from '@/shared/lib/questMappers'
import {
  MAIN_CAMPAIGN_MAP_CANVAS_ID,
  type CampaignLocationListItem,
  type LocationSheet,
} from '@/types/location-campaign'

type LocationResponse = components['schemas']['LocationResponse']
type LocationDetailResponse = components['schemas']['LocationDetailResponse']

export function latLngToApiCoords(lat: number, lng: number): { x: number; y: number } {
  return { x: lng, y: lat }
}

export function apiCoordsToLatLng(x: number, y: number): { lat: number; lng: number } {
  return { lat: y, lng: x }
}

export function locationResponseToListItem(loc: LocationResponse): CampaignLocationListItem {
  return {
    id: loc.id,
    listName: loc.title,
  }
}

export function locationResponseToSheet(
  loc: LocationResponse,
  mapCanvasId: string = MAIN_CAMPAIGN_MAP_CANVAS_ID
): LocationSheet {
  const pin = apiCoordsToLatLng(loc.x, loc.y)
  return {
    id: loc.id,
    displayTitle: loc.title,
    quests: [],
    description: loc.description ?? '',
    imageUrl: loc.image_url?.trim() ? loc.image_url : null,
    mapCanvasId,
    pinLatLng: pin,
    detailRelatedLocations: [],
    detailRelatedQuests: [],
    detailRelatedCharacters: [],
  }
}

export function locationsListToCampaignState(
  locations: LocationResponse[],
  /** По умолчанию верхний уровень; позже — `mapCanvasIdFromParentLocationId(loc.parent_location_id)`. */
  mapCanvasId: string = MAIN_CAMPAIGN_MAP_CANVAS_ID
): { list: CampaignLocationListItem[]; sheets: Record<string, LocationSheet> } {
  const list: CampaignLocationListItem[] = []
  const sheets: Record<string, LocationSheet> = {}
  for (const loc of locations) {
    list.push(locationResponseToListItem(loc))
    sheets[loc.id] = locationResponseToSheet(loc, mapCanvasId)
  }
  return { list, sheets }
}

/** Обогащает лист связями из GET .../location/{id} (персонажи / квесты). */
export type CharacterTitleResolver = (characterId: string) => string | undefined
export type QuestDetailResolver = (questId: string) => QuestDisplayInfo | undefined

export function applyLocationDetailToSheet(
  sheet: LocationSheet,
  detail: LocationDetailResponse,
  resolveCharacterTitle?: CharacterTitleResolver,
  resolveQuestDetail?: QuestDetailResolver
): LocationSheet {
  const loc = detail.location
  const detailRelatedQuests = detail.quest_ids.map((id) => {
    const resolved = resolveQuestDetail?.(id) ?? resolveQuestDisplay(id, {})
    return {
      title: resolved.title,
      ...(resolved.description ? { description: resolved.description } : {}),
      linked: true,
      attachedQuestId: id,
    }
  })
  return {
    ...locationResponseToSheet(loc, sheet.mapCanvasId),
    quests: detailRelatedQuests.map((q) => q.title),
    detailRelatedCharacters: detail.character_ids.map((id) => ({
      title: resolveCharacterTitle?.(id) ?? id,
      attachedCharacterId: id,
      linked: true,
    })),
    detailRelatedQuests,
    detailRelatedLocations: sheet.detailRelatedLocations,
  }
}
