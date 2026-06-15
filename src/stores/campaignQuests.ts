import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  createQuest,
  fetchCampaignLocationQuestDetails,
  linkQuestToLocation,
  unlinkQuestFromLocation,
  type QuestResponse,
} from '@/shared/api/questApi'
import {
  buildQuestStateFromLocationDetails,
  readQuestMetadata,
  writeQuestMetadata,
} from '@/shared/lib/questMappers'
import {
  DEMO_QUEST_LIST,
  isLocalOnlyQuestId,
  LOCAL_QUEST_ID_PREFIX,
  type CampaignQuestListItem,
  type QuestSheet,
} from '@/types/quest-campaign'
import { useActiveCampaignStore } from '@/stores/activeCampaign'

const DEMO_QUEST_IDS = new Set(DEMO_QUEST_LIST.map((q) => q.id))

export const useCampaignQuestsStore = defineStore('campaignQuests', () => {
  const questList = ref<CampaignQuestListItem[]>([])
  const questSheets = ref<Record<string, QuestSheet>>({})
  const loadedFromApi = ref(false)
  const listLoading = ref(false)
  const lastError = ref<string | null>(null)

  function applyMetadataToSheets(campaignId: string): void {
    const meta = readQuestMetadata(campaignId)
    questList.value = questList.value.map((item) => {
      const m = meta[item.id]
      if (!m?.title) return item
      return { ...item, listName: m.title }
    })
    const next: Record<string, QuestSheet> = { ...questSheets.value }
    for (const item of questList.value) {
      const m = meta[item.id]
      const sheet = next[item.id]
      if (!sheet) continue
      if (m?.title) {
        next[item.id] = { ...sheet, displayTitle: m.title }
      }
      if (m?.description !== undefined) {
        next[item.id] = { ...(next[item.id] ?? sheet), description: m.description }
      }
    }
    questSheets.value = next
  }

  async function loadFromApi(signal?: AbortSignal): Promise<void> {
    const campaignId = await useActiveCampaignStore().ensureCampaignId(signal)
    if (!campaignId) return

    const isInitialLoad = !loadedFromApi.value && questList.value.length === 0
    if (isInitialLoad) {
      listLoading.value = true
    }
    lastError.value = null
    try {
      const details = await fetchCampaignLocationQuestDetails(campaignId, signal)
      const meta = readQuestMetadata(campaignId)
      const localOnly = collectLocalOnlyQuests(questList.value, questSheets.value)
      const { list, sheets } = buildQuestStateFromLocationDetails(
        details.map((d) => ({ detail: d.detail })),
        meta,
        localOnly.sheets
      )
      const mergedList = [...list]
      const mergedSheets = { ...sheets }
      for (const item of localOnly.list) {
        if (!mergedSheets[item.id]) {
          mergedList.push(item)
          mergedSheets[item.id] = localOnly.sheets[item.id]!
        }
      }
      questList.value = mergedList
      questSheets.value = mergedSheets
      loadedFromApi.value = true
      applyMetadataToSheets(campaignId)
    } catch (e) {
      lastError.value = e instanceof Error ? e.message : 'Не удалось загрузить квесты'
    } finally {
      listLoading.value = false
    }
  }

  function collectLocalOnlyQuests(
    list: CampaignQuestListItem[],
    sheets: Record<string, QuestSheet>
  ): { list: CampaignQuestListItem[]; sheets: Record<string, QuestSheet> } {
    const localList: CampaignQuestListItem[] = []
    const localSheets: Record<string, QuestSheet> = {}
    for (const item of list) {
      if (isLocalOnlyQuestId(item.id) && sheets[item.id]) {
        localList.push(item)
        localSheets[item.id] = sheets[item.id]!
      }
    }
    return { list: localList, sheets: localSheets }
  }

  function createLocalQuest(title: string, description: string): string {
    const suffix =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : String(Date.now())
    const id = `${LOCAL_QUEST_ID_PREFIX}${suffix}`
    const displayTitle = title.trim() || 'Новый квест'
    const sheet: QuestSheet = {
      id,
      displayTitle,
      listSubtitle: 'Без локаций',
      description: description.trim(),
      imageUrl: null,
      locationLinks: [],
      isLocalOnly: true,
    }
    questSheets.value = { ...questSheets.value, [id]: sheet }
    questList.value = [...questList.value, { id, listName: displayTitle }]

    const campaignId = useActiveCampaignStore().campaignId
    if (campaignId) {
      const meta = readQuestMetadata(campaignId)
      meta[id] = { title: displayTitle, description: description.trim() }
      writeQuestMetadata(campaignId, meta)
    }
    return id
  }

  async function createQuestApi(
    title: string,
    description: string
  ): Promise<{ ok: boolean; questId: string | null }> {
    const displayTitle = title.trim()
    if (!displayTitle) return { ok: false, questId: null }

    lastError.value = null
    const campaignId = await useActiveCampaignStore().ensureCampaignId()
    if (!campaignId) {
      const id = createLocalQuest(title, description)
      return { ok: true, questId: id }
    }

    try {
      const created = await createQuest(campaignId, {
        title: displayTitle,
        ...(description.trim() ? { description: description.trim() } : {}),
      })
      const questId = created.id
      const meta = readQuestMetadata(campaignId)
      meta[questId] = {
        title: created.title?.trim() || displayTitle,
        description: created.description?.trim() || description.trim(),
      }
      writeQuestMetadata(campaignId, meta)

      const sheet: QuestSheet = {
        id: questId,
        displayTitle: meta[questId]!.title,
        listSubtitle: 'Без локаций',
        description: meta[questId]!.description,
        imageUrl: null,
        locationLinks: [],
      }
      questSheets.value = { ...questSheets.value, [questId]: sheet }
      questList.value = [...questList.value, { id: questId, listName: sheet.displayTitle }]
      loadedFromApi.value = true
      return { ok: true, questId }
    } catch (e) {
      lastError.value = e instanceof Error ? e.message : 'Не удалось создать квест'
      return { ok: false, questId: null }
    }
  }

  function updateQuestMeta(questId: string, title: string, description: string): void {
    const campaignId = useActiveCampaignStore().campaignId
    const displayTitle = title.trim() || questSheets.value[questId]?.displayTitle || 'Квест'
    const sheet = questSheets.value[questId]
    if (sheet) {
      questSheets.value = {
        ...questSheets.value,
        [questId]: { ...sheet, displayTitle, description: description.trim() },
      }
      const item = questList.value.find((q) => q.id === questId)
      if (item) item.listName = displayTitle
    }
    if (campaignId) {
      const meta = readQuestMetadata(campaignId)
      meta[questId] = { title: displayTitle, description: description.trim() }
      writeQuestMetadata(campaignId, meta)
    }
  }

  function promoteQuestIdInStore(oldId: string, newId: string, created: QuestResponse): void {
    const sheet = questSheets.value[oldId]
    if (!sheet) return

    const campaignId = useActiveCampaignStore().campaignId
    if (campaignId) {
      const meta = readQuestMetadata(campaignId)
      delete meta[oldId]
      meta[newId] = {
        title: created.title?.trim() || sheet.displayTitle,
        description: created.description?.trim() || sheet.description?.trim() || '',
      }
      writeQuestMetadata(campaignId, meta)
    }

    const newSheet: QuestSheet = {
      ...sheet,
      id: newId,
      isLocalOnly: undefined,
      displayTitle: created.title?.trim() || sheet.displayTitle,
      description: created.description?.trim() || sheet.description,
    }
    const nextSheets = { ...questSheets.value }
    delete nextSheets[oldId]
    nextSheets[newId] = newSheet
    questSheets.value = nextSheets
    questList.value = [
      ...questList.value.filter((q) => q.id !== oldId),
      { id: newId, listName: newSheet.displayTitle },
    ]
  }

  async function resolveBackendQuestId(questId: string, campaignId: string): Promise<string | null> {
    const sheet = questSheets.value[questId]
    if (!sheet) return null
    if (!isLocalOnlyQuestId(questId) && !DEMO_QUEST_IDS.has(questId)) return questId

    const created = await createQuest(campaignId, {
      title: sheet.displayTitle.trim() || 'Новый квест',
      description: sheet.description?.trim() || '',
    })
    promoteQuestIdInStore(questId, created.id, created)
    return created.id
  }

  async function linkQuestToLocationApi(
    questId: string,
    locationId: string,
    locationTitle: string
  ): Promise<{ ok: boolean; questId: string }> {
    lastError.value = null
    const campaignId = await useActiveCampaignStore().ensureCampaignId()
    if (!campaignId) {
      lastError.value = 'Не удалось определить кампанию'
      return { ok: false, questId }
    }

    let resolvedQuestId = questId
    try {
      if (isLocalOnlyQuestId(questId) || DEMO_QUEST_IDS.has(questId)) {
        const promoted = await resolveBackendQuestId(questId, campaignId)
        if (!promoted) {
          lastError.value = 'Не удалось создать квест на сервере'
          return { ok: false, questId }
        }
        resolvedQuestId = promoted
      }

      await linkQuestToLocation(campaignId, locationId, resolvedQuestId)
      linkQuestToLocationLocal(resolvedQuestId, locationId, locationTitle)
      return { ok: true, questId: resolvedQuestId }
    } catch (e) {
      lastError.value = e instanceof Error ? e.message : 'Не удалось привязать квест к локации'
      return { ok: false, questId: resolvedQuestId }
    }
  }

  async function unlinkQuestFromLocationApi(
    questId: string,
    locationId: string
  ): Promise<boolean> {
    const campaignId = await useActiveCampaignStore().ensureCampaignId()
    const sheet = questSheets.value[questId]
    if (!sheet) return false

    if (campaignId && !isLocalOnlyQuestId(questId) && !DEMO_QUEST_IDS.has(questId)) {
      lastError.value = null
      try {
        await unlinkQuestFromLocation(campaignId, locationId, questId)
      } catch (e) {
        lastError.value = e instanceof Error ? e.message : 'Не удалось отвязать квест'
      }
    }

    questSheets.value = {
      ...questSheets.value,
      [questId]: {
        ...sheet,
        locationLinks: sheet.locationLinks.filter((l) => l.locationId !== locationId),
      },
    }
    return true
  }

  function linkQuestToLocationLocal(
    questId: string,
    locationId: string,
    locationTitle: string
  ): boolean {
    const sheet = questSheets.value[questId]
    if (!sheet) return false
    if (sheet.locationLinks.some((l) => l.locationId === locationId)) return true
    questSheets.value = {
      ...questSheets.value,
      [questId]: {
        ...sheet,
        locationLinks: [...sheet.locationLinks, { locationId, locationTitle }],
        listSubtitle: undefined,
      },
    }
    return true
  }

  function upsertSheet(questId: string, patch: Partial<QuestSheet>): void {
    const cur = questSheets.value[questId]
    if (!cur) return
    questSheets.value = { ...questSheets.value, [questId]: { ...cur, ...patch } }
  }

  function resetSession(): void {
    questList.value = []
    questSheets.value = {}
    loadedFromApi.value = false
    listLoading.value = false
    lastError.value = null
  }

  return {
    questList,
    questSheets,
    loadedFromApi,
    listLoading,
    lastError,
    loadFromApi,
    createLocalQuest,
    createQuestApi,
    updateQuestMeta,
    linkQuestToLocationApi,
    unlinkQuestFromLocationApi,
    upsertSheet,
    resetSession,
  }
})
