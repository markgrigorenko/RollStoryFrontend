import type { LocationDetailLinkedItem, LocationSheet } from '@/types/location-campaign'

const STORAGE_PREFIX = 'rs_location_hierarchy_'

export type LocationHierarchyEntry = {
  /** Пока бэк не отдаёт parent_location_id — храним mapCanvasId локально. */
  mapCanvasId?: string
  /** Связи локация↔локация и POI — пока нет в API. */
  detailRelatedLocations?: LocationDetailLinkedItem[]
}

export type LocationHierarchyRecord = Record<string, LocationHierarchyEntry>

export function locationHierarchyStorageKey(campaignId: string): string {
  return `${STORAGE_PREFIX}${campaignId}`
}

export function readLocationHierarchyRecord(campaignId: string): LocationHierarchyRecord {
  try {
    const raw = localStorage.getItem(locationHierarchyStorageKey(campaignId))
    if (!raw) return {}
    return JSON.parse(raw) as LocationHierarchyRecord
  } catch {
    return {}
  }
}

export function writeLocationHierarchyRecord(
  campaignId: string,
  record: LocationHierarchyRecord
): void {
  localStorage.setItem(locationHierarchyStorageKey(campaignId), JSON.stringify(record))
}

export function patchLocationHierarchyEntry(
  campaignId: string,
  locationId: string,
  patch: LocationHierarchyEntry
): void {
  const record = readLocationHierarchyRecord(campaignId)
  record[locationId] = { ...record[locationId], ...patch }
  writeLocationHierarchyRecord(campaignId, record)
}

/**
 * Накладывает сохранённую иерархию на листы с API.
 * Когда бэк начнёт отдавать `parent_location_id`, маппер подставит его раньше localStorage.
 */
export function applyLocationHierarchyRecord(
  sheets: Record<string, LocationSheet>,
  record: LocationHierarchyRecord,
  previous?: Record<string, LocationSheet>
): Record<string, LocationSheet> {
  const out: Record<string, LocationSheet> = { ...sheets }
  for (const id of Object.keys(out)) {
    const stored = record[id]
    const prev = previous?.[id]
    const sheet = out[id]!
    const mapCanvasId = stored?.mapCanvasId ?? prev?.mapCanvasId ?? sheet.mapCanvasId
    const detailRelatedLocations =
      stored?.detailRelatedLocations ?? prev?.detailRelatedLocations ?? sheet.detailRelatedLocations
    out[id] = {
      ...sheet,
      mapCanvasId,
      detailRelatedLocations,
    }
  }
  return out
}
