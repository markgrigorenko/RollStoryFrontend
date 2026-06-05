import type { components } from '@/shared/api/generated/schema'
import { apiSkillIndexToCreatorId } from '@/shared/lib/dndProficiencyLabelsRu'
import {
  fillAbilitySkillRows,
  portraitUrlForCharacterName,
  type AbilityColumn,
  type CampaignCharacterListItem,
  type CharacterSheet,
  type QuestTag,
} from '@/types/character-campaign'

type CharacterItem = components['schemas']['CharacterItem']
type CharacterDetailResponse = components['schemas']['CharacterDetailResponse']
type StatDetail = components['schemas']['StatDetail']

const ABILITY_STYLES: Pick<AbilityColumn, 'id' | 'label' | 'headerBg' | 'skillCellBg'>[] = [
  {
    id: 'str',
    label: 'Сила',
    headerBg: 'rgba(127, 29, 29, 0.55)',
    skillCellBg: 'rgba(127, 29, 29, 0.35)',
  },
  {
    id: 'dex',
    label: 'Ловкость',
    headerBg: 'rgba(22, 101, 52, 0.55)',
    skillCellBg: 'rgba(22, 101, 52, 0.35)',
  },
  {
    id: 'con',
    label: 'Тело',
    headerBg: 'rgba(154, 52, 18, 0.5)',
    skillCellBg: 'rgba(154, 52, 18, 0.32)',
  },
  {
    id: 'int',
    label: 'Интеллект',
    headerBg: 'rgba(30, 58, 138, 0.55)',
    skillCellBg: 'rgba(30, 58, 138, 0.35)',
  },
  {
    id: 'wis',
    label: 'Мудрость',
    headerBg: 'rgba(88, 28, 135, 0.5)',
    skillCellBg: 'rgba(88, 28, 135, 0.32)',
  },
  {
    id: 'cha',
    label: 'Харизма',
    headerBg: 'rgba(120, 53, 15, 0.5)',
    skillCellBg: 'rgba(120, 53, 15, 0.32)',
  },
]

const STAT_KEYS = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'] as const

function formatModifier(value: number): string {
  return value >= 0 ? `+${value}` : `${value}`
}

function statToAbilityColumn(
  meta: (typeof ABILITY_STYLES)[number],
  stat: StatDetail
): AbilityColumn {
  return {
    ...meta,
    modifier: formatModifier(stat.modificator),
    score: stat.value,
    skills: [],
  }
}

function mapSkillIndexesToCreatorIds(indexes: string[] | undefined): string[] {
  if (!indexes?.length) return []
  const out: string[] = []
  for (const index of indexes) {
    const id = apiSkillIndexToCreatorId(index)
    if (id) out.push(id)
  }
  return out
}

function tagsToQuestTags(tags: string[] | undefined): QuestTag[] {
  if (!tags?.length) return []
  return tags.map((label, i) => ({
    label,
    variant: i === 0 ? 'orange' : 'blue',
  }))
}

export function characterItemToListItem(item: CharacterItem): CampaignCharacterListItem {
  return {
    id: item.id,
    listName: item.name,
  }
}

export function characterItemToMinimalSheet(item: CharacterItem): CharacterSheet {
  const subtitle = `${item.class} · ${item.race} · ур. ${item.level}`
  return {
    id: item.id,
    breadcrumbTail: item.race,
    displayTitle: item.name,
    listSubtitle: subtitle,
    questTags: [],
    portraitUrl: portraitUrlForCharacterName(item.name, null),
    hits: 0,
    ac: 0,
    speed: 0,
    abilities: [],
    history: '',
  }
}

export function characterDetailToSheet(detail: CharacterDetailResponse): CharacterSheet {
  const stats = [
    detail.strength,
    detail.dexterity,
    detail.constitution,
    detail.intelligence,
    detail.wisdom,
    detail.charisma,
  ]
  const abilityColumns = ABILITY_STYLES.map((meta, i) => statToAbilityColumn(meta, stats[i]!))
  const abilities = fillAbilitySkillRows(
    abilityColumns,
    mapSkillIndexesToCreatorIds(detail.skillIndexes),
    detail.level
  )
  const subtitle = `${detail.class} · ${detail.race} · ур. ${detail.level}`

  return {
    id: detail.id,
    breadcrumbTail: detail.race,
    displayTitle: detail.name,
    listSubtitle: subtitle,
    questTags: tagsToQuestTags(detail.tags),
    portraitUrl: portraitUrlForCharacterName(detail.name, detail.avatarLink),
    hits: detail.hitPoints,
    ac: detail.armorClass,
    speed: detail.speed,
    abilities,
    history: detail.description?.trim() ?? '',
  }
}

export function charactersListToState(characters: CharacterItem[]): {
  list: CampaignCharacterListItem[]
  sheets: Record<string, CharacterSheet>
} {
  const list: CampaignCharacterListItem[] = []
  const sheets: Record<string, CharacterSheet> = {}
  for (const item of characters) {
    list.push(characterItemToListItem(item))
    sheets[item.id] = characterItemToMinimalSheet(item)
  }
  return { list, sheets }
}
