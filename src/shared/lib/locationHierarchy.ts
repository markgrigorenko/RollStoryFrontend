import {
  MAIN_CAMPAIGN_MAP_CANVAS_ID,
  type LocationDetailLinkedItem,
  type LocationSheet,
} from '@/types/location-campaign'

/**
 * Родитель локации в иерархии кампании.
 * `null` — локация верхнего уровня (пин на главной карте).
 * UUID — подлокация внутри региональной карты родителя.
 *
 * На бэке позже ожидается поле `parent_location_id` с той же семантикой.
 */
export function getLocationParentId(sheet: Pick<LocationSheet, 'mapCanvasId'>): string | null {
  return sheet.mapCanvasId === MAIN_CAMPAIGN_MAP_CANVAS_ID ? null : sheet.mapCanvasId
}

export function isTopLevelLocation(sheet: Pick<LocationSheet, 'mapCanvasId'>): boolean {
  return getLocationParentId(sheet) === null
}

/** mapCanvasId для листа: из будущего `parent_location_id` API или явного значения. */
export function mapCanvasIdFromParentLocationId(parentLocationId?: string | null): string {
  return parentLocationId ?? MAIN_CAMPAIGN_MAP_CANVAS_ID
}

/** Обратное преобразование для записи в API, когда появится `parent_location_id`. */
export function parentLocationIdFromMapCanvasId(mapCanvasId: string): string | null {
  return mapCanvasId === MAIN_CAMPAIGN_MAP_CANVAS_ID ? null : mapCanvasId
}

/** Можно ли показывать список «привязать локацию кампании» (только верхний уровень). */
export function canPickCampaignLocationFromList(sheet: Pick<LocationSheet, 'mapCanvasId'>): boolean {
  return isTopLevelLocation(sheet)
}

/** Связь «локация кампании ↔ локация кампании» — только между соседями верхнего уровня. */
export function canLinkCampaignLocations(
  source: Pick<LocationSheet, 'id' | 'mapCanvasId'>,
  target: Pick<LocationSheet, 'id' | 'mapCanvasId'>
): boolean {
  if (source.id === target.id) return false
  return isTopLevelLocation(source) && isTopLevelLocation(target)
}

export function filterAttachableCampaignLocationIds(
  source: LocationSheet,
  locationIds: string[],
  sheets: Record<string, LocationSheet>,
  alreadyLinkedIds: Set<string>
): string[] {
  if (!canPickCampaignLocationFromList(source)) return []
  return locationIds.filter((id) => {
    if (id === source.id || alreadyLinkedIds.has(id)) return false
    const target = sheets[id]
    if (!target) return false
    return canLinkCampaignLocations(source, target)
  })
}

/** POI (без targetLocationId) всегда валидны; кампанийные связи — по правилам уровня. */
export function isValidDetailRelatedLocationRow(
  row: LocationDetailLinkedItem,
  source: LocationSheet,
  sheets: Record<string, LocationSheet>
): boolean {
  if (!row.targetLocationId) return true
  const target = sheets[row.targetLocationId]
  if (!target) return false
  return canLinkCampaignLocations(source, target)
}

export function sanitizeDetailRelatedLocations(
  rows: LocationDetailLinkedItem[] | undefined,
  source: LocationSheet,
  sheets: Record<string, LocationSheet>
): LocationDetailLinkedItem[] {
  return (rows ?? []).filter((row) => isValidDetailRelatedLocationRow(row, source, sheets))
}
