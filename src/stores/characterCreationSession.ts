import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  completeCharacterCreation,
  postCharacterAsi,
  postCharacterBasicInfo,
  postCharacterPointBuy,
  postCharacterProficiencies,
  rewindCharacterCreationStep,
  startCharacterCreation,
} from '@/shared/api'
import {
  buildAsiBody,
  buildBasicInfoBody,
  buildPointBuyBody,
  buildProficienciesBody,
  mapProficiencyChoices,
  type ProficiencyPickGroup,
} from '@/shared/lib/characterCreateMappers'
import type { components } from '@/shared/api/generated/schema'
import type { CharacterCreateDraft, PickListItem } from '@/types/character-campaign'
import { useActiveCampaignStore } from '@/stores/activeCampaign'

/** Ключи шагов визарда → targetStep для POST .../character/create/rewind */
const REWIND_TARGET_BY_WIZARD_STEP = {
  basic: 'basic_info',
  stats: 'point_buy',
  asi: 'asi',
  prof: 'proficiency',
} as const satisfies Record<string, components['schemas']['RewindStepRequest']['targetStep']>

export type CharacterCreateRewindableStep = keyof typeof REWIND_TARGET_BY_WIZARD_STEP

export const useCharacterCreationSessionStore = defineStore('characterCreationSession', () => {
  const apiActive = ref(false)
  const sessionId = ref<string | null>(null)
  /** characterId выдаётся на start — нужен для upload до complete. */
  const draftCharacterId = ref<string | null>(null)
  const raceOptions = ref<PickListItem[]>([])
  const classOptions = ref<PickListItem[]>([])
  const proficiencyGroups = ref<ProficiencyPickGroup[]>([])
  const needsAsiStep = ref(false)
  const totalAsiPoints = ref(0)
  const asiAllocations = ref<components['schemas']['ASIAllocation'][]>([])
  const proficiencySelections = ref<Record<string, string[]>>({})
  const submitting = ref(false)
  const lastError = ref<string | null>(null)

  const hasSession = computed(() => apiActive.value && Boolean(sessionId.value))

  function reset() {
    apiActive.value = false
    sessionId.value = null
    draftCharacterId.value = null
    raceOptions.value = []
    classOptions.value = []
    proficiencyGroups.value = []
    needsAsiStep.value = false
    totalAsiPoints.value = 0
    asiAllocations.value = []
    proficiencySelections.value = {}
    submitting.value = false
    lastError.value = null
  }

  function applyProficiencyChoices(choices: components['schemas']['ProficiencyChoice'][] | undefined) {
    proficiencyGroups.value = mapProficiencyChoices(choices)
    const next: Record<string, string[]> = {}
    for (const g of proficiencyGroups.value) {
      next[g.id] = proficiencySelections.value[g.id] ?? []
    }
    proficiencySelections.value = next
  }

  async function begin(signal?: AbortSignal): Promise<boolean> {
    reset()
    const campaignId = await useActiveCampaignStore().ensureCampaignId(signal)
    if (!campaignId) return false

    try {
      const res = await startCharacterCreation(campaignId, { locale: 'ru' }, signal)
      sessionId.value = res.sessionId
      draftCharacterId.value = res.characterId
      raceOptions.value = res.availableRaces.map((r) => ({ id: r.index, label: r.name }))
      classOptions.value = res.availableClasses.map((c) => ({ id: c.index, label: c.name }))
      apiActive.value = true
      return true
    } catch (e) {
      lastError.value = e instanceof Error ? e.message : 'Не удалось начать создание персонажа'
      return false
    }
  }

  async function submitBasicInfo(draft: CharacterCreateDraft, signal?: AbortSignal): Promise<boolean> {
    if (!sessionId.value) return false
    const campaignId = useActiveCampaignStore().campaignId
    if (!campaignId) return false

    submitting.value = true
    lastError.value = null
    try {
      await postCharacterBasicInfo(campaignId, buildBasicInfoBody(sessionId.value, draft), signal)
      return true
    } catch (e) {
      lastError.value = e instanceof Error ? e.message : 'Ошибка сохранения основной информации'
      return false
    } finally {
      submitting.value = false
    }
  }

  async function submitPointBuy(draft: CharacterCreateDraft, signal?: AbortSignal): Promise<boolean> {
    if (!sessionId.value) return false
    const campaignId = useActiveCampaignStore().campaignId
    if (!campaignId) return false

    submitting.value = true
    lastError.value = null
    try {
      const res = await postCharacterPointBuy(
        campaignId,
        buildPointBuyBody(sessionId.value, draft),
        signal
      )
      totalAsiPoints.value = res.totalAsiPoints ?? 0
      needsAsiStep.value = totalAsiPoints.value > 0
      if (!needsAsiStep.value && res.proficiencyChoices?.length) {
        applyProficiencyChoices(res.proficiencyChoices)
      }
      return true
    } catch (e) {
      lastError.value = e instanceof Error ? e.message : 'Ошибка сохранения характеристик'
      return false
    } finally {
      submitting.value = false
    }
  }

  async function submitAsi(signal?: AbortSignal): Promise<boolean> {
    if (!sessionId.value) return false
    const campaignId = useActiveCampaignStore().campaignId
    if (!campaignId) return false

    submitting.value = true
    lastError.value = null
    try {
      const res = await postCharacterAsi(
        campaignId,
        buildAsiBody(sessionId.value, asiAllocations.value),
        signal
      )
      applyProficiencyChoices(res.proficiencyChoices)
      return true
    } catch (e) {
      lastError.value = e instanceof Error ? e.message : 'Ошибка распределения ASI'
      return false
    } finally {
      submitting.value = false
    }
  }

  async function rewindToWizardStep(
    stepKey: CharacterCreateRewindableStep,
    signal?: AbortSignal
  ): Promise<boolean> {
    if (!sessionId.value) return true
    const campaignId = useActiveCampaignStore().campaignId
    if (!campaignId) return false

    submitting.value = true
    lastError.value = null
    try {
      await rewindCharacterCreationStep(
        campaignId,
        { sessionId: sessionId.value, targetStep: REWIND_TARGET_BY_WIZARD_STEP[stepKey] },
        signal
      )
      if (stepKey === 'basic' || stepKey === 'stats' || stepKey === 'asi') {
        proficiencyGroups.value = []
        proficiencySelections.value = {}
      }
      return true
    } catch (e) {
      lastError.value = e instanceof Error ? e.message : 'Не удалось вернуться на предыдущий шаг'
      return false
    } finally {
      submitting.value = false
    }
  }

  async function submitProficiencies(signal?: AbortSignal): Promise<boolean> {
    if (!sessionId.value) return false
    const campaignId = useActiveCampaignStore().campaignId
    if (!campaignId) return false

    submitting.value = true
    lastError.value = null
    try {
      await postCharacterProficiencies(
        campaignId,
        buildProficienciesBody(sessionId.value, proficiencySelections.value),
        signal
      )
      return true
    } catch (e) {
      lastError.value = e instanceof Error ? e.message : 'Ошибка выбора владений'
      return false
    } finally {
      submitting.value = false
    }
  }

  async function finish(avatarLink?: string, signal?: AbortSignal): Promise<string | null> {
    if (!sessionId.value) return null
    const campaignId = useActiveCampaignStore().campaignId
    if (!campaignId) return null

    submitting.value = true
    lastError.value = null
    try {
      const link = avatarLink?.trim()
      const res = await completeCharacterCreation(
        campaignId,
        {
          sessionId: sessionId.value,
          ...(link ? { avatar_link: link } : {}),
        },
        signal
      )
      const characterId = res.characterId
      reset()
      return characterId
    } catch (e) {
      lastError.value = e instanceof Error ? e.message : 'Не удалось завершить создание'
      return null
    } finally {
      submitting.value = false
    }
  }

  function toggleProficiency(groupId: string, optionIndex: string, maxChoose: number): void {
    const cur = [...(proficiencySelections.value[groupId] ?? [])]
    const i = cur.indexOf(optionIndex)
    if (i >= 0) {
      cur.splice(i, 1)
    } else if (cur.length < maxChoose) {
      cur.push(optionIndex)
    }
    proficiencySelections.value = { ...proficiencySelections.value, [groupId]: cur }
  }

  function proficienciesValid(): boolean {
    if (!proficiencyGroups.value.length) return true
    return proficiencyGroups.value.every((g) => (proficiencySelections.value[g.id]?.length ?? 0) === g.choose)
  }

  function asiPointsSpent(): number {
    return asiAllocations.value.reduce((sum, a) => sum + a.points, 0)
  }

  function asiValid(): boolean {
    if (!needsAsiStep.value) return true
    return asiPointsSpent() === totalAsiPoints.value
  }

  return {
    apiActive,
    sessionId,
    draftCharacterId,
    raceOptions,
    classOptions,
    proficiencyGroups,
    needsAsiStep,
    totalAsiPoints,
    asiAllocations,
    proficiencySelections,
    submitting,
    lastError,
    hasSession,
    reset,
    begin,
    submitBasicInfo,
    submitPointBuy,
    submitAsi,
    rewindToWizardStep,
    submitProficiencies,
    finish,
    toggleProficiency,
    proficienciesValid,
    asiPointsSpent,
    asiValid,
  }
})
