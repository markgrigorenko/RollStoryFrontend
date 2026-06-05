import {
  completeCharacterCreation,
  createLocation,
  createQuest,
  linkQuestToLocation,
  listCharacters,
  listLocations,
  postCharacterAsi,
  postCharacterBasicInfo,
  postCharacterPointBuy,
  postCharacterProficiencies,
  startCharacterCreation,
} from '@/shared/api'
import type { components } from '@/shared/api/generated/schema'
import { getStoredUserId } from '@/shared/lib/authSession'
import {
  buildAsiBody,
  buildBasicInfoBody,
  buildPointBuyBody,
  buildProficienciesBody,
  mapProficiencyChoices,
  type ProficiencyPickGroup,
} from '@/shared/lib/characterCreateMappers'
import { BOOTSTRAP_LOCATION_PINS } from '@/shared/config/campaignBootstrapMapCoords'
import { patchLocationHierarchyEntry } from '@/shared/lib/locationHierarchyStorage'
import { readQuestMetadata, writeQuestMetadata } from '@/shared/lib/questMappers'
import { uploadDemoCharacterPortraitIfKnown } from '@/shared/lib/uploadDemoCharacterPortrait'
import type { CharacterAbilityScores, CharacterCreateDraft } from '@/types/character-campaign'
import { DEMO_LOCATION_SHEETS, MAIN_CAMPAIGN_MAP_CANVAS_ID } from '@/types/location-campaign'
import { useActiveCampaignStore } from '@/stores/activeCampaign'

const BOOTSTRAP_LOG = '[campaign-bootstrap]'

/** Point-buy на 27 очков (валидно для API). */
const BOOTSTRAP_ABILITY_SCORES: CharacterAbilityScores = {
  str: 15,
  dex: 14,
  con: 13,
  int: 10,
  wis: 12,
  cha: 8,
}

type BootstrapLocationSeed = {
  title: string
  description: string
  x: number
  y: number
}

const LOCATION_SEEDS: BootstrapLocationSeed[] = [
  {
    title: DEMO_LOCATION_SHEETS.liaren!.displayTitle,
    description: DEMO_LOCATION_SHEETS.liaren!.description,
    ...BOOTSTRAP_LOCATION_PINS.liaren,
  },
  {
    title: DEMO_LOCATION_SHEETS['dowid-castle']!.displayTitle,
    description: DEMO_LOCATION_SHEETS['dowid-castle']!.description,
    ...BOOTSTRAP_LOCATION_PINS.dowidCastle,
  },
  {
    title: DEMO_LOCATION_SHEETS['grey-ridges']!.displayTitle,
    description: DEMO_LOCATION_SHEETS['grey-ridges']!.description,
    ...BOOTSTRAP_LOCATION_PINS.greyRidges,
  },
]

type BootstrapCharacterSeed = {
  name: string
  backstory: string
  raceId: string
  classId: string
}

const CHARACTER_SEEDS: BootstrapCharacterSeed[] = [
  {
    name: "Глефф Драконорожденный из клана Велес'Раал",
    backstory:
      "Глефф вырос в стенах клана Велес'Раал — не как наследник линии, а как тот, кого терпели за упрямство.",
    raceId: 'dragonborn',
    classId: 'paladin',
  },
  {
    name: 'Торрин Дубощит',
    backstory: 'Торрин служил у дубовых ворот десять сезонов. Записей о нём мало — он предпочитал, чтобы говорили щиты.',
    raceId: 'dwarf',
    classId: 'fighter',
  },
  {
    name: 'Дуротан',
    backstory: 'Дуротан знает тропы лучше птиц — или так говорят те, кто с ним не спорит.',
    raceId: 'half-orc',
    classId: 'barbarian',
  },
]

const QUEST_SEEDS = [
  {
    title: 'Помощь бедняку Джо',
    description:
      'Джо просит разобраться с пропажей скота у старого моста. Награда скромная, но деревня готова укрыть от дождя и поделиться слухами о Серых Кряжах.',
    locationIndexes: [0, 1],
  },
  {
    title: 'Замок Доуида',
    description:
      'Гарнизон замка ищет отряд для разведки подступов. В награду — ночлег, провизия и право выкупа пленного торговца.',
    locationIndexes: [1],
  },
  {
    title: 'Набат на закате',
    description:
      'С колокольни Лиарен-Кал снова донёсся набат. Нужно выяснить, кто поднимает тревогу и зачем.',
    locationIndexes: [0],
  },
] as const

export type CampaignBootstrapResult = {
  ran: boolean
  success: boolean
  error?: string
}

function autoSelectProficiencies(groups: ProficiencyPickGroup[]): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const group of groups) {
    out[group.id] = group.options.slice(0, group.choose).map((o) => o.index)
  }
  return out
}

function buildAutoAsiAllocations(
  totalPoints: number
): components['schemas']['ASIAllocation'][] {
  const allocations: components['schemas']['ASIAllocation'][] = []
  let remaining = totalPoints
  const stats: Array<keyof components['schemas']['Stats']> = [
    'strength',
    'dexterity',
    'constitution',
    'intelligence',
    'wisdom',
    'charisma',
  ]
  for (const statIndex of stats) {
    if (remaining <= 0) break
    const points = Math.min(2, remaining) as 1 | 2
    allocations.push({ statIndex, points })
    remaining -= points
  }
  return allocations
}

function pickIndex(
  available: Array<{ index: string }>,
  preferred: string
): string | null {
  return available.find((item) => item.index === preferred)?.index ?? available[0]?.index ?? null
}

async function createBootstrapCharacter(
  campaignId: string,
  seed: BootstrapCharacterSeed,
  signal?: AbortSignal
): Promise<string | null> {
  const startRes = await startCharacterCreation(campaignId, { locale: 'ru' }, signal)
  const raceId = pickIndex(startRes.availableRaces, seed.raceId)
  const classId = pickIndex(startRes.availableClasses, seed.classId)
  if (!raceId || !classId) return null

  const draft: CharacterCreateDraft = {
    name: seed.name,
    backstory: seed.backstory,
    level: '1',
    raceId,
    classId,
    abilityScores: { ...BOOTSTRAP_ABILITY_SCORES },
    proficientSkillIds: [],
    pendingAvatarFile: null,
  }

  const sessionId = startRes.sessionId
  await postCharacterBasicInfo(campaignId, buildBasicInfoBody(sessionId, draft), signal)
  const pointBuyRes = await postCharacterPointBuy(
    campaignId,
    buildPointBuyBody(sessionId, draft),
    signal
  )

  let proficiencyChoices = pointBuyRes.proficiencyChoices
  const totalAsi = pointBuyRes.totalAsiPoints ?? 0
  if (totalAsi > 0) {
    const asiRes = await postCharacterAsi(
      campaignId,
      buildAsiBody(sessionId, buildAutoAsiAllocations(totalAsi)),
      signal
    )
    proficiencyChoices = asiRes.proficiencyChoices ?? proficiencyChoices
  }

  if (proficiencyChoices?.length) {
    const groups = mapProficiencyChoices(proficiencyChoices)
    await postCharacterProficiencies(
      campaignId,
      buildProficienciesBody(sessionId, autoSelectProficiencies(groups)),
      signal
    )
  }

  const completeRes = await completeCharacterCreation(campaignId, { sessionId }, signal)
  const characterId = completeRes.characterId ?? null
  if (characterId) {
    try {
      await uploadDemoCharacterPortraitIfKnown(campaignId, characterId, seed.name, signal)
    } catch (e) {
      console.warn(BOOTSTRAP_LOG, `портрет не загружен для «${seed.name}»`, e)
    }
  }
  return characterId
}

/** Кампания пуста, если на сервере нет локаций и персонажей (квесты живут в привязках к локациям). */
async function isCampaignEmpty(campaignId: string, signal?: AbortSignal): Promise<boolean> {
  const [{ locations }, { characters }] = await Promise.all([
    listLocations(campaignId, signal),
    listCharacters(campaignId, signal),
  ])

  return (locations?.length ?? 0) === 0 && (characters?.length ?? 0) === 0
}

export async function needsCampaignBootstrap(signal?: AbortSignal): Promise<boolean> {
  if (!getStoredUserId()) return false

  const campaignId = await useActiveCampaignStore().ensureCampaignId(signal)
  if (!campaignId) return false

  try {
    return await isCampaignEmpty(campaignId, signal)
  } catch (e) {
    console.warn(BOOTSTRAP_LOG, 'не удалось проверить пустоту кампании', e)
    return false
  }
}

export async function runCampaignBootstrap(signal?: AbortSignal): Promise<CampaignBootstrapResult> {
  const userId = getStoredUserId()
  if (!userId) return { ran: false, success: false }

  const shouldRun = await needsCampaignBootstrap(signal)
  if (!shouldRun) return { ran: false, success: true }

  const campaignId = await useActiveCampaignStore().ensureCampaignId(signal)
  if (!campaignId) {
    return { ran: true, success: false, error: 'Не удалось определить кампанию' }
  }

  console.info(BOOTSTRAP_LOG, 'старт первичной инициализации', { campaignId, userId })

  try {
    const createdLocationIds: string[] = []
    for (const seed of LOCATION_SEEDS) {
      const created = await createLocation(
        campaignId,
        {
          title: seed.title,
          description: seed.description,
          x: seed.x,
          y: seed.y,
        },
        signal
      )
      createdLocationIds.push(created.id)
      patchLocationHierarchyEntry(campaignId, created.id, {
        mapCanvasId: MAIN_CAMPAIGN_MAP_CANVAS_ID,
      })
    }

    for (const seed of CHARACTER_SEEDS) {
      const characterId = await createBootstrapCharacter(campaignId, seed, signal)
      if (!characterId) {
        throw new Error(`Не удалось создать персонажа «${seed.name}»`)
      }
    }

    const questMeta = readQuestMetadata(campaignId)
    for (const seed of QUEST_SEEDS) {
      const created = await createQuest(
        campaignId,
        { title: seed.title, description: seed.description },
        signal
      )
      questMeta[created.id] = {
        title: created.title?.trim() || seed.title,
        description: created.description?.trim() || seed.description,
      }
      for (const locIndex of seed.locationIndexes) {
        const locationId = createdLocationIds[locIndex]
        if (!locationId) continue
        await linkQuestToLocation(campaignId, locationId, created.id, signal)
      }
    }
    writeQuestMetadata(campaignId, questMeta)

    console.info(BOOTSTRAP_LOG, 'инициализация завершена')
    return { ran: true, success: true }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Не удалось подготовить кампанию'
    console.error(BOOTSTRAP_LOG, e)
    return { ran: true, success: false, error: message }
  }
}
