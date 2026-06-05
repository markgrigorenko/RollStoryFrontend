import type { components } from '@/shared/api/generated/schema'
import type {
  CampaignQuestListItem,
  QuestLocationLink,
  QuestSheet,
} from '@/types/quest-campaign'
import { DEFAULT_LOCATION_CARD_IMAGE_URL } from '@/types/location-campaign'

export type QuestMetadataRecord = Record<string, { title: string; description: string }>

const QUEST_META_STORAGE_PREFIX = 'rs_quest_meta_'

export function questMetadataStorageKey(campaignId: string): string {
  return `${QUEST_META_STORAGE_PREFIX}${campaignId}`
}

export function readQuestMetadata(campaignId: string): QuestMetadataRecord {
  try {
    const raw = localStorage.getItem(questMetadataStorageKey(campaignId))
    if (!raw) return {}
    return JSON.parse(raw) as QuestMetadataRecord
  } catch {
    return {}
  }
}

export function writeQuestMetadata(campaignId: string, meta: QuestMetadataRecord): void {
  localStorage.setItem(questMetadataStorageKey(campaignId), JSON.stringify(meta))
}

function formatLocationCountSubtitle(count: number): string {
  const n = Math.abs(count) % 100
  const n1 = n % 10
  if (n > 10 && n < 20) return `${count} локаций`
  if (n1 === 1) return `${count} локация`
  if (n1 >= 2 && n1 <= 4) return `${count} локации`
  return `${count} локаций`
}

type LocationDetail = components['schemas']['LocationDetailResponse']

export function defaultQuestTitle(questId: string): string {
  const short = questId.replace(/-/g, '').slice(0, 8)
  return short ? `Квест ${short}` : 'Квест'
}

export type QuestDisplayInfo = { title: string; description?: string }

export function resolveQuestDisplay(
  questId: string,
  metadata: QuestMetadataRecord,
  sheets?: Record<string, QuestSheet>
): QuestDisplayInfo {
  const sheet = sheets?.[questId]
  if (sheet?.displayTitle?.trim()) {
    return {
      title: sheet.displayTitle.trim(),
      description: sheet.description?.trim() || undefined,
    }
  }
  const { title, description } = mergeQuestMetadata(questId, metadata)
  return { title, description: description.trim() || undefined }
}

export function mergeQuestMetadata(
  questId: string,
  metadata: QuestMetadataRecord
): { title: string; description: string } {
  const meta = metadata[questId]
  if (meta) {
    return {
      title: meta.title.trim() || defaultQuestTitle(questId),
      description: meta.description ?? '',
    }
  }
  return { title: defaultQuestTitle(questId), description: '' }
}

export function buildQuestStateFromLocationDetails(
  details: Array<{ detail: LocationDetail }>,
  metadata: QuestMetadataRecord,
  existingSheets: Record<string, QuestSheet>
): { list: CampaignQuestListItem[]; sheets: Record<string, QuestSheet> } {
  const linkMap = new Map<string, QuestLocationLink[]>()

  for (const { detail } of details) {
    const loc = detail.location
    const locationTitle = loc.title?.trim() || 'Локация'
    for (const questId of detail.quest_ids ?? []) {
      const prev = linkMap.get(questId) ?? []
      if (!prev.some((l) => l.locationId === loc.id)) {
        prev.push({ locationId: loc.id, locationTitle })
      }
      linkMap.set(questId, prev)
    }
  }

  for (const sheet of Object.values(existingSheets)) {
    if (!linkMap.has(sheet.id)) {
      linkMap.set(sheet.id, [...sheet.locationLinks])
    }
  }

  /** Квест без привязанных локаций всё ещё существует на бэке — не теряем его из списка. */
  for (const questId of Object.keys(metadata)) {
    if (!linkMap.has(questId)) {
      linkMap.set(questId, [])
    }
  }

  const list: CampaignQuestListItem[] = []
  const sheets: Record<string, QuestSheet> = {}

  for (const [questId, locationLinks] of linkMap.entries()) {
    const prev = existingSheets[questId]
    const { title: metaTitle, description: metaDescription } = mergeQuestMetadata(questId, metadata)
    const title =
      metaTitle !== defaultQuestTitle(questId)
        ? metaTitle
        : prev?.displayTitle?.trim() || metaTitle
    const description = metaDescription || prev?.description || ''
    list.push({ id: questId, listName: title })
    sheets[questId] = {
      id: questId,
      displayTitle: title,
      listSubtitle:
        locationLinks.length > 0 ? formatLocationCountSubtitle(locationLinks.length) : prev?.listSubtitle,
      description,
      imageUrl: prev?.imageUrl ?? DEFAULT_LOCATION_CARD_IMAGE_URL,
      locationLinks,
      isLocalOnly: prev?.isLocalOnly,
    }
  }

  list.sort((a, b) => a.listName.localeCompare(b.listName, 'ru'))
  return { list, sheets }
}
