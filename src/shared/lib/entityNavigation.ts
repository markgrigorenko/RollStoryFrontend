import type { CampaignCharacterListItem, CharacterSheet } from '@/types/character-campaign'
import type { CampaignLocationListItem, LocationSheet } from '@/types/location-campaign'
import type { CampaignQuestListItem, QuestSheet } from '@/types/quest-campaign'

function normalizeTitle(value: string): string {
  return value.trim().toLowerCase()
}

function titlesMatch(a: string, b: string): boolean {
  const left = normalizeTitle(a)
  const right = normalizeTitle(b)
  if (!left || !right) return false
  return left === right || left.includes(right) || right.includes(left)
}

export function findLocationIdByTitle(
  title: string,
  locationList: CampaignLocationListItem[],
  locationSheets: Record<string, LocationSheet>
): string | null {
  for (const item of locationList) {
    const sheet = locationSheets[item.id]
    const candidates = [item.listName, sheet?.displayTitle, sheet?.listSubtitle].filter(Boolean) as string[]
    if (candidates.some((candidate) => titlesMatch(candidate, title))) {
      return item.id
    }
  }
  return null
}

export function findQuestIdByTitle(
  title: string,
  questList: CampaignQuestListItem[],
  questSheets: Record<string, QuestSheet>
): string | null {
  for (const item of questList) {
    const sheet = questSheets[item.id]
    const candidates = [item.listName, sheet?.displayTitle].filter(Boolean) as string[]
    if (candidates.some((candidate) => titlesMatch(candidate, title))) {
      return item.id
    }
  }
  return null
}

export function findCharacterIdByTitle(
  title: string,
  characterList: CampaignCharacterListItem[],
  characterSheets: Record<string, CharacterSheet>
): string | null {
  for (const item of characterList) {
    const sheet = characterSheets[item.id]
    const candidates = [item.listName, sheet?.displayTitle].filter(Boolean) as string[]
    if (candidates.some((candidate) => titlesMatch(candidate, title))) {
      return item.id
    }
  }
  return null
}
