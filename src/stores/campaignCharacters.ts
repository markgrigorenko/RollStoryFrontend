import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getCharacterDetail, listCharacters } from '@/shared/api'
import {
  characterDetailToSheet,
  charactersListToState,
} from '@/shared/lib/characterMappers'
import {
  DEMO_CHARACTER_LIST,
  DEMO_CHARACTER_SHEETS,
  type CampaignCharacterListItem,
  type CharacterSheet,
} from '@/types/character-campaign'
import { useActiveCampaignStore } from '@/stores/activeCampaign'

function cloneDemoSheets(): Record<string, CharacterSheet> {
  const out: Record<string, CharacterSheet> = {}
  for (const key of Object.keys(DEMO_CHARACTER_SHEETS) as (keyof typeof DEMO_CHARACTER_SHEETS)[]) {
    const s = DEMO_CHARACTER_SHEETS[key]
    out[key] = {
      ...s,
      questTags: s.questTags.map((t) => ({ ...t })),
      abilities: s.abilities.map((col) => ({
        ...col,
        skills: col.skills.map((sk) => ({ ...sk })),
      })),
    }
  }
  return out
}

function syncListFieldsOntoSheet(
  sheet: CharacterSheet,
  listName: string,
  listSubtitle?: string
): CharacterSheet {
  return {
    ...sheet,
    displayTitle: listName,
    listSubtitle: listSubtitle ?? sheet.listSubtitle,
  }
}

export const useCampaignCharactersStore = defineStore('campaignCharacters', () => {
  const characterList = ref<CampaignCharacterListItem[]>([...DEMO_CHARACTER_LIST])
  const characterSheets = ref<Record<string, CharacterSheet>>(cloneDemoSheets())
  const loadedFromApi = ref(false)
  const listLoading = ref(false)
  const detailLoadingId = ref<string | null>(null)
  /** Персонажи с полным GET .../character/{id} — карточки списка берут history отсюда. */
  const detailLoadedIds = ref(new Set<string>(Object.keys(DEMO_CHARACTER_SHEETS)))

  async function loadCharacterDetail(
    campaignId: string,
    characterId: string,
    signal?: AbortSignal,
    trackLoading = false
  ): Promise<void> {
    if (detailLoadedIds.value.has(characterId)) return

    if (trackLoading) {
      detailLoadingId.value = characterId
    }
    try {
      const detail = await getCharacterDetail(campaignId, characterId, signal)
      characterSheets.value = {
        ...characterSheets.value,
        [characterId]: characterDetailToSheet(detail),
      }
      detailLoadedIds.value = new Set([...detailLoadedIds.value, characterId])
    } catch {
      /* оставляем краткий лист из списка */
    } finally {
      if (trackLoading && detailLoadingId.value === characterId) {
        detailLoadingId.value = null
      }
    }
  }

  async function hydrateAllCharacterDetails(signal?: AbortSignal): Promise<void> {
    const campaignId = useActiveCampaignStore().campaignId
    if (!campaignId) return

    const pending = characterList.value
      .map((c) => c.id)
      .filter((id) => !detailLoadedIds.value.has(id))

    if (!pending.length) return

    await Promise.allSettled(
      pending.map((id) => loadCharacterDetail(campaignId, id, signal))
    )
  }

  async function loadFromApi(signal?: AbortSignal): Promise<void> {
    const campaignId = await useActiveCampaignStore().ensureCampaignId(signal)
    if (!campaignId) return

    const isInitialLoad = !loadedFromApi.value
    if (isInitialLoad) {
      listLoading.value = true
    }

    try {
      const res = await listCharacters(campaignId, signal)
      const { list, sheets } = charactersListToState(res.characters)
      characterList.value = list

      const mergedSheets: Record<string, CharacterSheet> = {}
      const nextDetailLoaded = new Set<string>()

      for (const item of list) {
        const minimal = sheets[item.id]!
        const existing = characterSheets.value[item.id]
        if (existing && detailLoadedIds.value.has(item.id)) {
          mergedSheets[item.id] = syncListFieldsOntoSheet(
            existing,
            item.listName,
            minimal.listSubtitle
          )
          nextDetailLoaded.add(item.id)
        } else {
          mergedSheets[item.id] = minimal
        }
      }

      characterSheets.value = mergedSheets
      detailLoadedIds.value = nextDetailLoaded
      loadedFromApi.value = true

      await hydrateAllCharacterDetails(signal)
    } catch {
      /* демо остаётся */
    } finally {
      listLoading.value = false
    }
  }

  async function ensureDetailLoaded(characterId: string, signal?: AbortSignal): Promise<void> {
    if (detailLoadedIds.value.has(characterId)) return
    const campaignId = useActiveCampaignStore().campaignId
    if (!campaignId) return
    await loadCharacterDetail(campaignId, characterId, signal, true)
  }

  function invalidateCharacterDetail(characterId: string): void {
    if (!detailLoadedIds.value.has(characterId)) return
    const next = new Set(detailLoadedIds.value)
    next.delete(characterId)
    detailLoadedIds.value = next
  }

  function setCharacterPortraitUrl(characterId: string, portraitUrl: string): void {
    const sheet = characterSheets.value[characterId]
    if (!sheet) return
    characterSheets.value = {
      ...characterSheets.value,
      [characterId]: { ...sheet, portraitUrl },
    }
  }

  function upsertLocalCharacter(id: string, listName: string, sheet: CharacterSheet): void {
    characterSheets.value = { ...characterSheets.value, [id]: sheet }
    characterList.value = [...characterList.value, { id, listName }]
    detailLoadedIds.value = new Set([...detailLoadedIds.value, id])
  }

  function resetSession(): void {
    characterList.value = [...DEMO_CHARACTER_LIST]
    characterSheets.value = cloneDemoSheets()
    loadedFromApi.value = false
    listLoading.value = false
    detailLoadingId.value = null
    detailLoadedIds.value = new Set(Object.keys(DEMO_CHARACTER_SHEETS))
  }

  return {
    characterList,
    characterSheets,
    loadedFromApi,
    listLoading,
    detailLoadingId,
    loadFromApi,
    ensureDetailLoaded,
    invalidateCharacterDetail,
    setCharacterPortraitUrl,
    upsertLocalCharacter,
    resetSession,
  }
})
