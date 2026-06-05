import type { components } from '@/shared/api/generated/schema'
import {
  localizeProficiencyGroupDesc,
  localizeProficiencyOptionName,
} from '@/shared/lib/dndProficiencyLabelsRu'
import type { AbilityScoreKey, CharacterAbilityScores, CharacterCreateDraft } from '@/types/character-campaign'

type Stats = components['schemas']['Stats']
type ProficiencyChoice = components['schemas']['ProficiencyChoice']
type ProficiencyOption = components['schemas']['ProficiencyOption']
type OptionSet = components['schemas']['OptionSet']

const ABILITY_TO_API: Record<AbilityScoreKey, keyof Stats> = {
  str: 'strength',
  dex: 'dexterity',
  con: 'constitution',
  int: 'intelligence',
  wis: 'wisdom',
  cha: 'charisma',
}

const API_TO_ABILITY: Record<keyof Stats, AbilityScoreKey> = {
  strength: 'str',
  dexterity: 'dex',
  constitution: 'con',
  intelligence: 'int',
  wisdom: 'wis',
  charisma: 'cha',
}

export interface ProficiencyPickOption {
  index: string
  name: string
}

export interface ProficiencyPickGroup {
  id: string
  desc: string
  choose: number
  options: ProficiencyPickOption[]
}

export function draftAbilityScoresToApiStats(scores: CharacterAbilityScores): Stats {
  return {
    strength: scores.str,
    dexterity: scores.dex,
    constitution: scores.con,
    intelligence: scores.int,
    wisdom: scores.wis,
    charisma: scores.cha,
  }
}

export function parseCharacterLevel(level: string): number {
  return Math.min(20, Math.max(1, parseInt(level.trim(), 10) || 1))
}

export function buildBasicInfoBody(
  sessionId: string,
  draft: CharacterCreateDraft
): components['schemas']['BasicInfoRequest'] {
  return {
    sessionId,
    name: draft.name.trim(),
    ...(draft.backstory.trim() ? { description: draft.backstory.trim() } : {}),
    raceIndex: draft.raceId,
    classIndex: draft.classId,
    level: parseCharacterLevel(draft.level),
  }
}

export function buildPointBuyBody(
  sessionId: string,
  draft: CharacterCreateDraft
): components['schemas']['PointBuyRequest'] {
  return {
    sessionId,
    baseStats: draftAbilityScoresToApiStats(draft.abilityScores),
  }
}

export function buildAsiBody(
  sessionId: string,
  allocations: components['schemas']['ASIAllocation'][]
): components['schemas']['ASIRequest'] {
  return { sessionId, asi: allocations }
}

export function buildProficienciesBody(
  sessionId: string,
  selections: Record<string, string[]>
): components['schemas']['ProficienciesRequest'] {
  const all = Object.values(selections).flat()
  return {
    sessionId,
    choices: {
      skillIndexes: all,
      toolIndexes: [],
      musicalInstrumentIndexes: [],
    },
  }
}

function optionToPick(opt: ProficiencyOption): ProficiencyPickOption | null {
  const index = opt.item?.index
  if (!index) return null
  const fallbackName = opt.item?.name?.trim() || index
  return {
    index,
    name: localizeProficiencyOptionName(index, fallbackName),
  }
}

function flattenOptionSet(from: OptionSet): ProficiencyPickOption[] {
  const out: ProficiencyPickOption[] = []
  const seen = new Set<string>()
  for (const opt of from.options ?? []) {
    const row = optionToPick(opt)
    if (!row || seen.has(row.index)) continue
    seen.add(row.index)
    out.push(row)
  }
  return out
}

export function mapProficiencyChoices(choices: ProficiencyChoice[] | undefined): ProficiencyPickGroup[] {
  if (!choices?.length) return []
  return choices.map((choice, i) => ({
    id: `prof-${i}`,
    desc: localizeProficiencyGroupDesc(choice.desc),
    choose: choice.choose,
    options: flattenOptionSet(choice.from),
  }))
}

export function apiStatIndexToAbilityKey(statIndex: string): AbilityScoreKey | null {
  const key = statIndex.toLowerCase() as keyof Stats
  if (key in API_TO_ABILITY) {
    return API_TO_ABILITY[key]
  }
  if (statIndex in ABILITY_TO_API) {
    return statIndex as AbilityScoreKey
  }
  return null
}

export { ABILITY_TO_API, API_TO_ABILITY }
