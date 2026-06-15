<script setup lang="ts">
import { computed, inject, onMounted, onUnmounted, ref, useTemplateRef, watch } from 'vue'
import { storeToRefs } from 'pinia'

import notFoundIconUrl from '@/assets/icons/not-found-icon.svg'
import InlineSectionLoader from '@/shared/ui/InlineSectionLoader.vue'
import {
  createQuest,
  deleteLocation,
  getLocationDetail,
  linkCharacterToLocation,
  linkQuestToLocation,
  unlinkCharacterFromLocation,
  updateLocation,
  uploadFile,
} from '@/shared/api'
import { campaignLocationsMapBridgeKey } from '@/shared/lib/campaignLocationsMapBridge'
import {
  findCharacterIdByTitle,
  findQuestIdByTitle as findQuestIdByTitleInStore,
} from '@/shared/lib/entityNavigation'
import { applyLocationDetailToSheet } from '@/shared/lib/locationMappers'
import {
  canLinkCampaignLocations,
  canPickCampaignLocationFromList,
  filterAttachableCampaignLocationIds,
  sanitizeDetailRelatedLocations,
} from '@/shared/lib/locationHierarchy'
import { patchLocationHierarchyEntry } from '@/shared/lib/locationHierarchyStorage'
import { readQuestMetadata, resolveQuestDisplay, writeQuestMetadata } from '@/shared/lib/questMappers'
import { useActiveCampaignStore } from '@/stores/activeCampaign'
import { useCampaignCharactersStore } from '@/stores/campaignCharacters'
import { useCampaignQuestsStore } from '@/stores/campaignQuests'
import { DEMO_QUEST_LIST, isLocalOnlyQuestId, type CampaignQuestListItem, type QuestSheet } from '@/types/quest-campaign'
import {
  DEFAULT_LOCATION_CARD_IMAGE_URL,
  DEMO_LOCATION_FALLBACK_ID,
  DEMO_LOCATION_LIST,
  DEMO_LOCATION_SHEETS,
  MAIN_CAMPAIGN_MAP_CANVAS_ID,
  type CampaignLocationListItem,
  type LocationDetailLinkedItem,
  type LocationSheet,
} from '@/types/location-campaign'

const LOCAL_LOCATION_ID_PREFIX = 'map-loc-'
const DEMO_QUEST_IDS = new Set(DEMO_QUEST_LIST.map((q) => q.id))
const DEMO_LOCATION_IDS = new Set([
  ...DEMO_LOCATION_LIST.map((l) => l.id),
  DEMO_LOCATION_FALLBACK_ID,
])

const props = withDefaults(
  defineProps<{
    /** Запасной растр главной кампании, если своей иллюстрации нет даже региональной по умолчанию */
    fallbackImageUrl?: string
    /** Текущий холст карты — фильтр списка и соответствие пинам */
    activeMapCanvasId: string
    loading?: boolean
  }>(),
  { fallbackImageUrl: '', loading: false }
)

const emit = defineEmits<{
  (e: 'open-location-map', payload: { imageUrl: string; title: string; locationId: string }): void
}>()

const locationList = defineModel<CampaignLocationListItem[]>('locationList', { required: true })
const locationSheets = defineModel<Record<string, LocationSheet>>('locationSheets', { required: true })

const mapBridge = inject(campaignLocationsMapBridgeKey)
const activeCampaignStore = useActiveCampaignStore()
const charactersStore = useCampaignCharactersStore()
const questsStore = useCampaignQuestsStore()
const { characterList, characterSheets: campaignCharacterSheets } = storeToRefs(charactersStore)
const { questList, questSheets, loadedFromApi: questsLoadedFromApi } = storeToRefs(questsStore)
const questAttachLoading = ref(false)

const imageFileInput = useTemplateRef<HTMLInputElement>('imageFileInput')
const imageUploading = ref(false)
const locationActionError = ref<string | null>(null)

const viewMode = ref<'browse' | 'create'>('browse')
const browsePhase = ref<'list' | 'detail'>('list')
const selectedId = ref(locationList.value[0]?.id ?? DEMO_LOCATION_FALLBACK_ID)
const searchQuery = ref('')

watch(
  () => mapBridge?.pendingDetailLocationId?.value ?? null,
  (id) => {
    if (!id || viewMode.value === 'create') return
    const sh = locationSheets.value[id]
    if (!sh) return
    selectedId.value = id
    browsePhase.value = 'detail'
    if (mapBridge) mapBridge.pendingDetailLocationId.value = null
  }
)

watch(
  () => props.activeMapCanvasId,
  () => {
    browsePhase.value = 'list'
  }
)

const sheet = computed((): LocationSheet => {
  const s = locationSheets.value[selectedId.value]
  if (s) return s
  return DEMO_LOCATION_SHEETS[DEMO_LOCATION_FALLBACK_ID]!
})

function visibleOnCurrentCanvas(locId: string): boolean {
  const sh = locationSheets.value[locId]
  if (!sh) return false
  const canvas = props.activeMapCanvasId
  if (sh.mapCanvasId === canvas) return true
  if (canvas !== MAIN_CAMPAIGN_MAP_CANVAS_ID && locId === canvas) return true
  return false
}

const filteredList = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  const scoped = locationList.value.filter((loc) => visibleOnCurrentCanvas(loc.id))
  if (!q) return scoped
  return scoped.filter((loc) => {
    const sh = locationSheets.value[loc.id]
    const rel = [...(sh?.detailRelatedLocations ?? []), ...(sh?.detailRelatedQuests ?? []), ...(sh?.detailRelatedCharacters ?? [])]
      .map((x) => `${x.title} ${x.description ?? ''}`)
      .join(' ')
    const hay = [
      loc.listName,
      sh?.displayTitle ?? '',
      sh?.listSubtitle ?? '',
      sh?.linkedCharacter ?? '',
      ...(sh?.quests ?? []),
      sh?.description ?? '',
      rel,
    ]
      .join(' ')
      .toLowerCase()
    return hay.includes(q)
  })
})

const cardRows = computed(() =>
  filteredList.value.map((item) => ({
    item,
    sheet: locationSheets.value[item.id] ?? DEMO_LOCATION_SHEETS[DEMO_LOCATION_FALLBACK_ID]!,
  }))
)

const isSearchEmpty = computed(
  () => searchQuery.value.trim().length > 0 && filteredList.value.length === 0
)

function detailQuestVisible(s: LocationSheet): { visible: string[]; more: number } {
  const max = 2
  const labels = s.quests
  if (s.detailMoreCount != null) {
    return { visible: labels.slice(0, max), more: s.detailMoreCount }
  }
  if (labels.length <= max) return { visible: labels, more: 0 }
  return { visible: labels.slice(0, max), more: labels.length - max }
}

function cardQuestVisible(s: LocationSheet): { visible: string[]; more: number } {
  const labels = s.quests
  const max = 3
  if (labels.length <= max) return { visible: labels, more: 0 }
  return { visible: labels.slice(0, max), more: labels.length - max }
}

function detailMetaLine(s: LocationSheet): string {
  return s.linkedCharacter?.trim() || s.listSubtitle?.trim() || 'Локация'
}

function cardExcerptPlain(s: LocationSheet): string {
  return s.description.replace(/\s+/g, ' ').trim()
}

const detailImageSrc = computed(
  () =>
    sheet.value.imageUrl?.trim() ||
    DEFAULT_LOCATION_CARD_IMAGE_URL ||
    props.fallbackImageUrl.trim() ||
    undefined
)

function exitCreateMode() {
  viewMode.value = 'browse'
}

async function refreshLocationDetail(locationId: string) {
  const campaignId = await activeCampaignStore.ensureCampaignId()
  if (!campaignId) return
  try {
    const detail = await getLocationDetail(campaignId, locationId)
    const prev = locationSheets.value[locationId]
    const questMeta = readQuestMetadata(campaignId)
    locationSheets.value = {
      ...locationSheets.value,
      [locationId]: applyLocationDetailToSheet(
        prev ?? { id: locationId, displayTitle: detail.location.title, quests: [], description: '', imageUrl: null, mapCanvasId: MAIN_CAMPAIGN_MAP_CANVAS_ID, pinLatLng: null },
        detail,
        (characterId) => {
          const sh = campaignCharacterSheets.value[characterId]
          const item = characterList.value.find((c) => c.id === characterId)
          return sh?.displayTitle ?? item?.listName
        },
        (questId) => resolveQuestDisplay(questId, questMeta, questSheets.value)
      ),
    }
  } catch {
    /* локальное состояние */
  }
}

async function openLocationDetail(id: string) {
  if (viewMode.value === 'create') return
  if (!locationSheets.value[id]) return
  selectedId.value = id
  browsePhase.value = 'detail'
  locationActionError.value = null
  await refreshLocationDetail(id)
}

function openLinkedQuest(questId: string) {
  mapBridge?.openQuest(questId)
}

function openLinkedCharacter(characterId: string) {
  mapBridge?.openCharacter(characterId)
}

function resolveQuestIdForTitle(title: string): string | null {
  const normalized = title.trim().toLowerCase()
  const fromRelations = (sheet.value.detailRelatedQuests ?? []).find(
    (row) => row.title.trim().toLowerCase() === normalized
  )
  if (fromRelations?.attachedQuestId) return fromRelations.attachedQuestId
  const campaignId = activeCampaignStore.campaignId
  if (campaignId) {
    const fromMeta = findQuestIdByTitle(title, campaignId)
    if (fromMeta) return fromMeta
  }
  return findQuestIdByTitleInStore(title, questList.value, questSheets.value)
}

function tryOpenQuestByTitle(title: string) {
  const questId = resolveQuestIdForTitle(title)
  if (questId) openLinkedQuest(questId)
}

function tryOpenCharacterByTitle(title: string) {
  const normalized = title.trim().toLowerCase()
  const fromRelations = (sheet.value.detailRelatedCharacters ?? []).find(
    (row) => row.title.trim().toLowerCase() === normalized
  )
  if (fromRelations?.attachedCharacterId) {
    openLinkedCharacter(fromRelations.attachedCharacterId)
    return
  }
  const characterId = findCharacterIdByTitle(title, characterList.value, campaignCharacterSheets.value)
  if (characterId) openLinkedCharacter(characterId)
}

function backToLocationCards() {
  browsePhase.value = 'list'
}

function openLocationSheetOnMap() {
  const url = (
    sheet.value.imageUrl?.trim() ||
    DEFAULT_LOCATION_CARD_IMAGE_URL ||
    props.fallbackImageUrl ||
    ''
  ).trim()
  if (!url) return
  emit('open-location-map', {
    imageUrl: url,
    title: sheet.value.displayTitle,
    locationId: sheet.value.id,
  })
}

type AttachKind = 'location' | 'quest' | 'character'

interface QuestSuggestion {
  title: string
  description?: string
}

function collectQuestSuggestions(sheets: Record<string, LocationSheet>): QuestSuggestion[] {
  const seen = new Set<string>()
  const out: QuestSuggestion[] = []
  function add(title: string, description?: string) {
    const t = title.trim()
    if (!t) return
    const key = t.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    out.push({ title: t, description: description?.trim() || undefined })
  }
  for (const sh of Object.values(sheets)) {
    for (const q of sh.quests ?? []) add(q)
    for (const row of sh.detailRelatedQuests ?? []) add(row.title, row.description)
  }
  return out
}

const attachKind = ref<AttachKind | null>(null)
const attachPoiDraft = ref({ title: '', description: '' })
const questManualDraft = ref({ title: '', description: '' })

const attachDialogHeading = computed(() => {
  switch (attachKind.value) {
    case 'location':
      return 'Привязать локацию'
    case 'quest':
      return 'Привязать квест'
    case 'character':
      return 'Привязать персонажа'
    default:
      return ''
  }
})

const relationLocationsList = computed(() =>
  sanitizeDetailRelatedLocations(sheet.value.detailRelatedLocations, sheet.value, locationSheets.value)
)
const canAttachCampaignLocationsFromList = computed(() => canPickCampaignLocationFromList(sheet.value))
const relationQuestsList = computed(() => sheet.value.detailRelatedQuests ?? [])
const relationCharactersList = computed(() => sheet.value.detailRelatedCharacters ?? [])

const attachableCampaignLocations = computed(() => {
  const self = selectedId.value
  const cur = locationSheets.value[self]
  if (!cur) return []
  const linkedIds = new Set(
    (cur.detailRelatedLocations ?? []).map((x) => x.targetLocationId).filter(Boolean) as string[]
  )
  const ids = filterAttachableCampaignLocationIds(
    cur,
    locationList.value.map((l) => l.id),
    locationSheets.value,
    linkedIds
  )
  return locationList.value.filter((l) => ids.includes(l.id))
})

const attachableCampaignCharacters = computed(() => {
  const used = new Set(
    (sheet.value.detailRelatedCharacters ?? []).map((x) => x.attachedCharacterId).filter(Boolean) as string[]
  )
  return characterList.value.filter((c) => !used.has(c.id)).map((c) => {
    const sh = campaignCharacterSheets.value[c.id]
    return {
      id: c.id,
      listName: c.listName,
      displayTitle: sh?.displayTitle ?? c.listName,
      subtitle: sh?.listSubtitle ?? '',
    }
  })
})

function collectAttachableCampaignQuests(
  curLocationId: string,
  quests: CampaignQuestListItem[],
  sheets: Record<string, QuestSheet>,
  alreadyLinkedTitles: Set<string>,
  alreadyLinkedIds: Set<string>
): QuestSuggestion[] {
  const out: QuestSuggestion[] = []
  const seen = new Set<string>()
  for (const item of quests) {
    const sh = sheets[item.id]
    if (!sh) continue
    if (alreadyLinkedIds.has(item.id)) continue
    if (sh.locationLinks.some((l) => l.locationId === curLocationId)) continue
    const title = (sh.displayTitle ?? item.listName).trim()
    if (!title) continue
    const key = title.toLowerCase()
    if (seen.has(key) || alreadyLinkedTitles.has(key)) continue
    seen.add(key)
    out.push({ title, description: sh.description?.trim() || undefined })
  }
  return out
}

const questSuggestionsForAttach = computed((): QuestSuggestion[] => {
  const curId = selectedId.value
  const currentTitles = new Set(relationQuestsList.value.map((x) => x.title.trim().toLowerCase()))
  const currentQuestIds = new Set(
    relationQuestsList.value.map((x) => x.attachedQuestId).filter(Boolean) as string[]
  )

  const fromCampaign = collectAttachableCampaignQuests(
    curId,
    questList.value,
    questSheets.value,
    currentTitles,
    currentQuestIds
  )

  const seen = new Set(fromCampaign.map((s) => s.title.toLowerCase()))
  const fromLocations = collectQuestSuggestions(locationSheets.value).filter((s) => {
    const key = s.title.toLowerCase()
    return !currentTitles.has(key) && !seen.has(key)
  })

  return [...fromCampaign, ...fromLocations]
})

watch(attachKind, (k) => {
  if (!k) return
  attachPoiDraft.value = { title: '', description: '' }
  questManualDraft.value = { title: '', description: '' }
})

function openAttachDialog(kind: AttachKind) {
  locationActionError.value = null
  attachKind.value = kind
}

function closeAttachDialog() {
  attachKind.value = null
  questAttachLoading.value = false
}

async function persistLocationRelations(locationId: string, detailRelatedLocations: LocationDetailLinkedItem[]) {
  const campaignId = await activeCampaignStore.ensureCampaignId()
  if (!campaignId) return
  patchLocationHierarchyEntry(campaignId, locationId, { detailRelatedLocations })
}

function attachCampaignLocation(targetId: string) {
  const curId = selectedId.value
  if (targetId === curId) return
  const cur = locationSheets.value[curId]
  const targetSheet = locationSheets.value[targetId]
  if (!cur || !targetSheet) return
  if (!canLinkCampaignLocations(cur, targetSheet)) return
  const prev = cur.detailRelatedLocations ?? []
  if (prev.some((x) => x.targetLocationId === targetId)) return
  const title =
    targetSheet.displayTitle?.trim() || locationList.value.find((l) => l.id === targetId)?.listName || targetId
  const row: LocationDetailLinkedItem = { title, linked: true, targetLocationId: targetId }
  const detailRelatedLocations = sanitizeDetailRelatedLocations([...prev, row], cur, locationSheets.value)
  locationSheets.value[curId] = { ...cur, detailRelatedLocations }
  void persistLocationRelations(curId, detailRelatedLocations)
  closeAttachDialog()
}

function attachLocationPoi() {
  const title = attachPoiDraft.value.title.trim()
  if (!title) return
  const curId = selectedId.value
  const cur = locationSheets.value[curId]
  if (!cur) return
  const prev = cur.detailRelatedLocations ?? []
  const desc = attachPoiDraft.value.description.trim()
  const row: LocationDetailLinkedItem = {
    title,
    ...(desc ? { description: desc } : {}),
    linked: false,
  }
  const detailRelatedLocations = sanitizeDetailRelatedLocations([...prev, row], cur, locationSheets.value)
  locationSheets.value[curId] = { ...cur, detailRelatedLocations }
  void persistLocationRelations(curId, detailRelatedLocations)
  closeAttachDialog()
}

function isBackendQuestId(questId: string): boolean {
  return !isLocalOnlyQuestId(questId) && !DEMO_QUEST_IDS.has(questId)
}

function isApiBackedLocationId(locationId: string): boolean {
  if (locationId.startsWith(LOCAL_LOCATION_ID_PREFIX)) return false
  if (DEMO_LOCATION_IDS.has(locationId)) return false
  return true
}

function findQuestIdByTitle(title: string, campaignId: string): string | null {
  const norm = title.trim().toLowerCase()
  if (questsLoadedFromApi.value) {
    for (const item of questList.value) {
      if (!isBackendQuestId(item.id)) continue
      const sh = questSheets.value[item.id]
      const candidate = (sh?.displayTitle ?? item.listName).trim().toLowerCase()
      if (candidate === norm) return item.id
    }
  }
  const meta = readQuestMetadata(campaignId)
  for (const [id, entry] of Object.entries(meta)) {
    if (!isBackendQuestId(id)) continue
    if (entry.title.trim().toLowerCase() === norm) return id
  }
  return null
}

function applyQuestAttachmentLocal(curId: string, payload: QuestSuggestion) {
  const cur = locationSheets.value[curId]
  if (!cur) return
  const title = payload.title.trim()
  if (!title) return
  const prev = cur.detailRelatedQuests ?? []
  if (prev.some((x) => x.title.trim().toLowerCase() === title.toLowerCase())) return
  const row: LocationDetailLinkedItem = {
    title,
    ...(payload.description ? { description: payload.description } : {}),
    linked: true,
  }
  const chips = [...(cur.quests ?? [])]
  if (!chips.some((q) => q.trim().toLowerCase() === title.toLowerCase())) chips.push(title)
  locationSheets.value[curId] = { ...cur, detailRelatedQuests: [...prev, row], quests: chips }
}

async function attachQuest(payload: QuestSuggestion) {
  const title = payload.title.trim()
  if (!title || questAttachLoading.value) return
  const curId = selectedId.value
  const cur = locationSheets.value[curId]
  if (!cur) return

  const existing = (cur.detailRelatedQuests ?? []).find(
    (x) => x.title.trim().toLowerCase() === title.toLowerCase()
  )
  if (existing?.attachedQuestId) {
    closeAttachDialog()
    return
  }

  const campaignId = await activeCampaignStore.ensureCampaignId()
  locationActionError.value = null

  if (!campaignId) {
    applyQuestAttachmentLocal(curId, payload)
    closeAttachDialog()
    return
  }

  if (!isApiBackedLocationId(curId)) {
    locationActionError.value = 'Эта локация ещё не сохранена на сервере — привязка квеста недоступна.'
    return
  }

  questAttachLoading.value = true
  try {
    if (!questsLoadedFromApi.value) {
      await questsStore.loadFromApi()
    }

    let questId = findQuestIdByTitle(title, campaignId)
    if (!questId) {
      const created = await createQuest(campaignId, {
        title,
        ...(payload.description?.trim() ? { description: payload.description.trim() } : {}),
      })
      questId = created.id
      const meta = readQuestMetadata(campaignId)
      meta[questId] = {
        title: created.title?.trim() || title,
        description: created.description?.trim() || payload.description?.trim() || '',
      }
      writeQuestMetadata(campaignId, meta)
    }

    await linkQuestToLocation(campaignId, curId, questId)
    await refreshLocationDetail(curId)
    await questsStore.loadFromApi()
    closeAttachDialog()
  } catch (e) {
    locationActionError.value = e instanceof Error ? e.message : 'Не удалось привязать квест'
  } finally {
    questAttachLoading.value = false
  }
}

function attachQuestSuggestion(s: QuestSuggestion) {
  void attachQuest(s)
}

function attachQuestManual() {
  const title = questManualDraft.value.title.trim()
  if (!title) return
  void attachQuest({
    title,
    ...(questManualDraft.value.description.trim() ? { description: questManualDraft.value.description.trim() } : {}),
  })
}

async function attachCampaignCharacter(characterId: string) {
  const curId = selectedId.value
  const campaignId = await activeCampaignStore.ensureCampaignId()
  locationActionError.value = null

  if (campaignId) {
    try {
      await linkCharacterToLocation(campaignId, curId, characterId)
      await refreshLocationDetail(curId)
      closeAttachDialog()
      return
    } catch (e) {
      locationActionError.value = e instanceof Error ? e.message : 'Не удалось привязать персонажа'
    }
  }

  const cur = locationSheets.value[curId]
  if (!cur) return
  const prev = cur.detailRelatedCharacters ?? []
  if (prev.some((x) => x.attachedCharacterId === characterId)) return
  const sh = campaignCharacterSheets.value[characterId]
  const listItem = characterList.value.find((c) => c.id === characterId)
  const title = sh?.displayTitle ?? listItem?.listName ?? characterId
  const historyLine = sh?.history.replace(/\s+/g, ' ').trim().slice(0, 170)
  const description = sh?.listSubtitle?.trim() || historyLine || undefined
  const row: LocationDetailLinkedItem = {
    title,
    ...(description ? { description } : {}),
    linked: true,
    attachedCharacterId: characterId,
  }
  locationSheets.value[curId] = { ...cur, detailRelatedCharacters: [...prev, row] }
  closeAttachDialog()
}

async function detachCampaignCharacter(characterId: string) {
  const curId = selectedId.value
  const campaignId = await activeCampaignStore.ensureCampaignId()
  locationActionError.value = null

  if (campaignId) {
    try {
      await unlinkCharacterFromLocation(campaignId, curId, characterId)
      await refreshLocationDetail(curId)
      return
    } catch (e) {
      locationActionError.value = e instanceof Error ? e.message : 'Не удалось отвязать персонажа'
    }
  }

  const cur = locationSheets.value[curId]
  if (!cur) return
  locationSheets.value[curId] = {
    ...cur,
    detailRelatedCharacters: (cur.detailRelatedCharacters ?? []).filter(
      (x) => x.attachedCharacterId !== characterId
    ),
  }
}

function promptLocationImageUpload() {
  imageFileInput.value?.click()
}

async function onLocationImageSelected(ev: Event) {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  const locationId = selectedId.value
  const campaignId = await activeCampaignStore.ensureCampaignId()
  if (!campaignId) return

  imageUploading.value = true
  locationActionError.value = null
  try {
    const { url } = await uploadFile({
      campaignId,
      kind: 'location',
      locationId,
      file,
    })
    await updateLocation(campaignId, locationId, { image_url: url })
    const cur = locationSheets.value[locationId]
    if (cur) {
      locationSheets.value = { ...locationSheets.value, [locationId]: { ...cur, imageUrl: url } }
    }
  } catch (e) {
    locationActionError.value = e instanceof Error ? e.message : 'Не удалось загрузить изображение'
  } finally {
    imageUploading.value = false
  }
}

async function removeCurrentLocation() {
  const locationId = selectedId.value
  const campaignId = await activeCampaignStore.ensureCampaignId()
  locationActionError.value = null

  if (campaignId) {
    try {
      await deleteLocation(campaignId, locationId)
    } catch (e) {
      locationActionError.value = e instanceof Error ? e.message : 'Не удалось удалить локацию'
      return
    }
  }

  const nextList = locationList.value.filter((l) => l.id !== locationId)
  const nextSheets = { ...locationSheets.value }
  delete nextSheets[locationId]
  locationList.value = nextList
  locationSheets.value = nextSheets
  mapBridge?.removeLocationPin?.(locationId)
  browsePhase.value = 'list'
  if (nextList[0]) {
    selectedId.value = nextList[0].id
  }
}

function onAttachEscape(e: KeyboardEvent) {
  if (e.key === 'Escape' && attachKind.value) {
    e.preventDefault()
    closeAttachDialog()
  }
}

onMounted(() => {
  document.addEventListener('keydown', onAttachEscape)
  void charactersStore.loadFromApi()
  void questsStore.loadFromApi()
})
onUnmounted(() => document.removeEventListener('keydown', onAttachEscape))

</script>

<template>
  <div class="cl" aria-label="Локации кампании">
    <div
      class="cl__grid"
      :class="{
        'cl__grid--create': viewMode === 'create',
        'cl__grid--browse-detail': viewMode === 'browse' && browsePhase === 'detail',
      }"
    >
      <template v-if="viewMode === 'browse' && browsePhase === 'list'">
        <div class="cl-cards">
          <div class="cl-cards__toolbar">
            <div class="cl__search-wrap cl-cards__search">
              <svg class="cl__search-icon" width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm9 2-4.35-4.35"
                  stroke="currentColor"
                  stroke-width="1.75"
                  stroke-linecap="round"
                />
              </svg>
              <input v-model="searchQuery" type="search" class="cl__search" placeholder="Поиск" autocomplete="off" />
            </div>
          </div>
          <div class="cl-cards__body">
            <InlineSectionLoader v-if="loading" />
            <template v-else>
            <div v-if="isSearchEmpty" class="cl-cards__empty" role="status">
              <div class="cl-cards__empty-icon-wrap">
                <img :src="notFoundIconUrl" alt="" class="cl-cards__empty-icon" width="64" height="40" />
              </div>
              <p class="cl-cards__empty-text">
                <span class="cl-cards__empty-line">По вашему запросу</span>
                <span class="cl-cards__empty-line">ничего не найдено</span>
              </p>
            </div>
            <ul v-else class="cl-cards__list" aria-label="Список локаций">
              <li v-for="({ item: loc, sheet: ls }) in cardRows" :key="loc.id" class="cl-cards__item">
                <button type="button" class="cl-card" @click="openLocationDetail(loc.id)">
                  <div class="cl-card__title">{{ ls.displayTitle }}</div>
                  <div class="cl-card__tags">
                    <span v-if="ls.listSubtitle" class="cl-card__tag cl-card__tag--loc">{{ ls.listSubtitle }}</span>
                    <span
                      v-for="(ql, qi) in cardQuestVisible(ls).visible"
                      :key="qi"
                      class="cl-card__tag cl-card__tag--accent cl-card__tag--link"
                      role="button"
                      tabindex="0"
                      @click.stop="tryOpenQuestByTitle(ql)"
                      @keydown.enter.stop.prevent="tryOpenQuestByTitle(ql)"
                      @keydown.space.stop.prevent="tryOpenQuestByTitle(ql)"
                      >{{ ql }}</span>
                    <span
                      v-if="cardQuestVisible(ls).more > 0"
                      class="cl-card__tag cl-card__tag--accent"
                      >+{{ cardQuestVisible(ls).more }}</span>
                  </div>
                  <p class="cl-card__excerpt">{{ cardExcerptPlain(ls) }}</p>
                </button>
              </li>
            </ul>
            </template>
          </div>
        </div>
      </template>

      <template v-else-if="viewMode === 'browse' && browsePhase === 'detail'">
        <div class="cl-sidebar-detail">
          <div class="map-sidebar__subnav">
            <button type="button" class="map-sidebar__back" @click="backToLocationCards">
              <svg class="map-sidebar__back-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M19 12H5M12 19l-7-7 7-7"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
              <span>Все локации</span>
            </button>
            <button type="button" class="map-sidebar__link" @click="openLocationSheetOnMap">Открыть карту</button>
            <button
              type="button"
              class="map-sidebar__link"
              :disabled="imageUploading"
              @click="promptLocationImageUpload"
            >
              {{ imageUploading ? 'Загрузка…' : 'Сменить иллюстрацию' }}
            </button>
            <button type="button" class="map-sidebar__link map-sidebar__link--danger" @click="removeCurrentLocation">
              Удалить
            </button>
          </div>
          <input
            ref="imageFileInput"
            type="file"
            accept="image/*"
            class="cl__file-input"
            tabindex="-1"
            aria-hidden="true"
            @change="onLocationImageSelected"
          />

          <p v-if="locationActionError" class="cl__action-error" role="alert">{{ locationActionError }}</p>

          <h1 class="map-sidebar__title">{{ sheet.displayTitle }}</h1>
          <div class="map-sidebar__tags">
            <button
              v-if="sheet.linkedCharacter"
              type="button"
              class="map-sidebar__tag map-sidebar__tag--char map-sidebar__tag--clickable"
              @click="tryOpenCharacterByTitle(sheet.linkedCharacter)"
            >
              {{ sheet.linkedCharacter }}
            </button>
            <span v-else class="map-sidebar__tag map-sidebar__tag--char">{{ detailMetaLine(sheet) }}</span>
            <button
              v-for="(ql, qi) in detailQuestVisible(sheet).visible"
              :key="qi"
              type="button"
              class="map-sidebar__tag map-sidebar__tag--quest map-sidebar__tag--clickable"
              @click="tryOpenQuestByTitle(ql)"
            >
              {{ ql }}
            </button>
            <span
              v-if="detailQuestVisible(sheet).more > 0"
              class="map-sidebar__tag map-sidebar__tag--more"
              >+{{ detailQuestVisible(sheet).more }}</span>
          </div>
          <div v-if="detailImageSrc" class="map-sidebar__media">
            <img :src="detailImageSrc" alt="" class="map-sidebar__media-img" />
          </div>
          <h2 class="map-sidebar__section-title">Описание</h2>
          <p class="map-sidebar__desc">{{ sheet.description }}</p>

          <div class="cl-detail-extra">
            <section class="cl-detail-block">
              <h2 class="map-sidebar__section-title cl-detail-block__heading">Локации</h2>
              <p v-if="!relationLocationsList.length" class="cl-detail-block__empty-clue">
                Связанных локаций и точек интереса пока нет.
              </p>
              <ul v-else class="cl-detail-block__list">
                <li v-for="(row, ri) in relationLocationsList" :key="'dl-' + ri" class="cl-detail-block__li">
                  <button
                    v-if="row.linked && row.targetLocationId"
                    type="button"
                    class="cl-detail-block__link"
                    @click="openLocationDetail(row.targetLocationId!)"
                  >
                    {{ row.title }}
                  </button>
                  <button v-else-if="row.linked" type="button" class="cl-detail-block__link">{{ row.title }}</button>
                  <span v-else class="cl-detail-block__plain">{{ row.title }}</span>
                  <p v-if="row.description" class="cl-detail-block__sub">{{ row.description }}</p>
                </li>
              </ul>
              <button type="button" class="cl-detail-block__add" @click="openAttachDialog('location')">
                <span class="cl-detail-block__add-plus" aria-hidden="true">+</span>
                Добавить локацию
              </button>
            </section>

            <section class="cl-detail-block">
              <h2 class="map-sidebar__section-title cl-detail-block__heading">Квесты</h2>
              <p v-if="!relationQuestsList.length" class="cl-detail-block__empty-clue">К этой локации квестов пока не привязано.</p>
              <ul v-else class="cl-detail-block__list">
                <li v-for="(row, qi) in relationQuestsList" :key="'dq-' + qi" class="cl-detail-block__li">
                  <button
                    v-if="row.attachedQuestId"
                    type="button"
                    class="cl-detail-block__link"
                    @click="openLinkedQuest(row.attachedQuestId)"
                  >
                    {{ row.title }}
                  </button>
                  <button
                    v-else-if="row.linked"
                    type="button"
                    class="cl-detail-block__link"
                    @click="tryOpenQuestByTitle(row.title)"
                  >
                    {{ row.title }}
                  </button>
                  <span v-else class="cl-detail-block__plain">{{ row.title }}</span>
                  <p v-if="row.description" class="cl-detail-block__sub">{{ row.description }}</p>
                </li>
              </ul>
              <button type="button" class="cl-detail-block__add" @click="openAttachDialog('quest')">
                <span class="cl-detail-block__add-plus" aria-hidden="true">+</span>
                Добавить квест
              </button>
            </section>

            <section class="cl-detail-block">
              <h2 class="map-sidebar__section-title cl-detail-block__heading">Персонажи</h2>
              <p v-if="!relationCharactersList.length" class="cl-detail-block__empty-clue">Персонажей к локации пока не добавлено.</p>
              <ul v-else class="cl-detail-block__list">
                <li v-for="(row, ci) in relationCharactersList" :key="'dc-' + ci" class="cl-detail-block__li">
                  <div class="cl-detail-block__row">
                    <button
                      v-if="row.attachedCharacterId"
                      type="button"
                      class="cl-detail-block__link"
                      @click="openLinkedCharacter(row.attachedCharacterId)"
                    >
                      {{ row.title }}
                    </button>
                    <button
                      v-else-if="row.linked"
                      type="button"
                      class="cl-detail-block__link"
                      @click="tryOpenCharacterByTitle(row.title)"
                    >
                      {{ row.title }}
                    </button>
                    <span v-else class="cl-detail-block__plain">{{ row.title }}</span>
                    <button
                      v-if="row.attachedCharacterId"
                      type="button"
                      class="cl-detail-block__detach"
                      aria-label="Отвязать персонажа"
                      @click="detachCampaignCharacter(row.attachedCharacterId!)"
                    >
                      <svg class="cl-detail-block__detach-icon" viewBox="0 0 16 16" aria-hidden="true">
                        <path
                          d="M4 4l8 8M12 4L4 12"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="1.75"
                          stroke-linecap="round"
                        />
                      </svg>
                    </button>
                  </div>
                  <p v-if="row.description" class="cl-detail-block__sub">{{ row.description }}</p>
                </li>
              </ul>
              <button type="button" class="cl-detail-block__add" @click="openAttachDialog('character')">
                <span class="cl-detail-block__add-plus" aria-hidden="true">+</span>
                Добавить персонажа
              </button>
            </section>
          </div>
        </div>
      </template>

      <template v-else>
        <div class="cl-create">
          <nav class="cl__crumbs" aria-label="Навигация">
            <span class="cl__crumb">Локации</span>
            <span class="cl__crumb-sep" aria-hidden="true">/</span>
            <span class="cl__crumb cl__crumb--accent">Новая локация</span>
          </nav>
          <div class="cl-create__placeholder">
            <p class="cl-create__muted">Мастер создания локации появится здесь.</p>
            <button type="button" class="cl-create__back" @click="exitCreateMode">Вернуться к списку</button>
          </div>
        </div>
      </template>
    </div>

    <Teleport to="body">
      <div v-if="attachKind" class="cl-attach-overlay" aria-hidden="false">
        <div class="cl-attach-overlay__shade" aria-hidden="true" @click="closeAttachDialog"></div>
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="cl-attach-heading"
          class="cl-attach-overlay__sheet"
          tabindex="-1"
          @click.stop
        >
          <header class="cl-attach-overlay__toolbar">
            <h2 id="cl-attach-heading" class="cl-attach-overlay__title">{{ attachDialogHeading }}</h2>
            <button type="button" class="cl-attach-overlay__dismiss" aria-label="Закрыть" @click="closeAttachDialog">
              ×
            </button>
          </header>

          <div class="cl-attach-overlay__body">
            <p v-if="locationActionError" class="cl-attach-overlay__error" role="alert">{{ locationActionError }}</p>
            <!-- Локация -->
            <div v-if="attachKind === 'location'" class="cl-attach-overlay__pane">
              <p class="cl-attach-overlay__hint">
                <template v-if="canAttachCampaignLocationsFromList">
                  Привяжите другую локацию верхнего уровня (с главной карты) или добавьте точку интереса на этой
                  карточке.
                </template>
                <template v-else>
                  Подлокация не может ссылаться на другие локации кампании — добавьте точку интереса внутри этого
                  региона.
                </template>
              </p>
              <template v-if="canAttachCampaignLocationsFromList">
                <h3 class="cl-attach-overlay__subheading">Из списка кампании</h3>
                <ul v-if="attachableCampaignLocations.length" class="cl-attach-overlay__choices">
                  <li v-for="loc in attachableCampaignLocations" :key="loc.id">
                    <button type="button" class="cl-attach-overlay__choice" @click="attachCampaignLocation(loc.id)">
                      <span class="cl-attach-overlay__choice-title">{{ locationSheets[loc.id]?.displayTitle ?? loc.listName }}</span>
                      <span v-if="locationSheets[loc.id]?.listSubtitle" class="cl-attach-overlay__choice-meta">{{
                        locationSheets[loc.id]!.listSubtitle
                      }}</span>
                    </button>
                  </li>
                </ul>
                <p v-else class="cl-attach-overlay__muted-inline">Больше нет локаций верхнего уровня для привязки.</p>
              </template>

              <h3
                class="cl-attach-overlay__subheading"
                :class="{ 'cl-attach-overlay__subheading--divider': canAttachCampaignLocationsFromList }"
              >
                Точка интереса
              </h3>
              <label class="cl-attach-overlay__label">
                Название
                <input
                  v-model="attachPoiDraft.title"
                  type="text"
                  class="cl-attach-overlay__input"
                  maxlength="140"
                  autocomplete="off"
                  placeholder="Например, колодец на площади"
                  @keydown.enter.prevent="attachLocationPoi"
                />
              </label>
              <label class="cl-attach-overlay__label">
                Описание
                <textarea
                  v-model="attachPoiDraft.description"
                  class="cl-attach-overlay__textarea"
                  rows="3"
                  maxlength="560"
                  placeholder="Курсивным под текстом названия."
                ></textarea>
              </label>
              <div class="cl-attach-overlay__actions-row">
                <button
                  type="button"
                  class="cl-attach-overlay__ghost"
                  :disabled="!attachPoiDraft.title.trim()"
                  @click="attachLocationPoi"
                >
                  Добавить точку
                </button>
              </div>
            </div>

            <!-- Квест -->
            <div v-if="attachKind === 'quest'" class="cl-attach-overlay__pane">
              <h3 class="cl-attach-overlay__subheading">Квесты кампании</h3>
              <ul v-if="questSuggestionsForAttach.length" class="cl-attach-overlay__choices">
                <li v-for="(qx, qi) in questSuggestionsForAttach" :key="'qs-' + qi">
                  <button type="button" class="cl-attach-overlay__choice" @click="attachQuestSuggestion(qx)">
                    <span class="cl-attach-overlay__choice-title">{{ qx.title }}</span>
                    <span v-if="qx.description" class="cl-attach-overlay__choice-meta">{{ qx.description }}</span>
                  </button>
                </li>
              </ul>
              <p v-else class="cl-attach-overlay__muted-inline">Нет доступных квестов — создайте новый ниже.</p>

              <h3 class="cl-attach-overlay__subheading cl-attach-overlay__subheading--divider">Новый квест</h3>
              <form class="cl-attach-overlay__form" @submit.prevent="attachQuestManual">
                <label class="cl-attach-overlay__label">
                  Название
                  <input
                    v-model="questManualDraft.title"
                    type="text"
                    class="cl-attach-overlay__input"
                    maxlength="140"
                    autocomplete="off"
                    placeholder="Название квеста"
                  />
                </label>
                <label class="cl-attach-overlay__label">
                  Описание
                  <textarea
                    v-model="questManualDraft.description"
                    class="cl-attach-overlay__textarea"
                    rows="3"
                    maxlength="560"
                    placeholder="Подсказка для игроков — курсив под названием."
                  ></textarea>
                </label>
                <div class="cl-attach-overlay__actions-row">
                  <button
                    type="submit"
                    class="cl-attach-overlay__ghost"
                    :disabled="!questManualDraft.title.trim() || questAttachLoading"
                    :aria-busy="questAttachLoading"
                  >
                    {{ questAttachLoading ? 'Привязка…' : 'Привязать квест' }}
                  </button>
                </div>
              </form>
            </div>

            <!-- Персонаж -->
            <div v-if="attachKind === 'character'" class="cl-attach-overlay__pane">
              <p v-if="attachableCampaignCharacters.length" class="cl-attach-overlay__hint">
                Выберите персонажа кампании для привязки к локации.
              </p>
              <ul v-if="attachableCampaignCharacters.length" class="cl-attach-overlay__choices">
                <li v-for="cp in attachableCampaignCharacters" :key="cp.id">
                  <button type="button" class="cl-attach-overlay__choice" @click="attachCampaignCharacter(cp.id)">
                    <span class="cl-attach-overlay__choice-title">{{ cp.displayTitle }}</span>
                    <span v-if="cp.subtitle" class="cl-attach-overlay__choice-meta">{{ cp.subtitle }}</span>
                  </button>
                </li>
              </ul>
              <p v-else class="cl-attach-overlay__muted-inline">Все доступные персонажи уже привязаны к этой локации.</p>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.cl__file-input {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.cl__action-error {
  margin: 0 0 0.75rem;
  font-size: 0.8125rem;
  color: #f87171;
}

.cl-detail-block__row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.cl-detail-block__detach {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.08);
  color: #a3a3a3;
  cursor: pointer;
  transition: color 0.15s, background 0.15s;
}

.cl-detail-block__detach-icon {
  width: 12px;
  height: 12px;
  display: block;
}

.cl-detail-block__detach:hover {
  color: #fafafa;
  background: rgba(248, 113, 113, 0.2);
}

.map-sidebar__link--danger {
  color: #f87171;
}

.cl {
  --cl-bg: #121212;
  --cl-panel: #1a1a1a;
  --cl-muted: #a3a3a3;
  --cl-text: #fafafa;
  --cl-accent: #f97316;
  --cl-line: rgba(255, 255, 255, 0.08);

  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: var(--cl-bg);
  color: var(--cl-text);
}

.cl__grid {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px 18px 20px;
  overflow: hidden;
}

.cl__grid--browse-detail {
  gap: 0;
  padding: 20px 24px 32px;
  overflow-y: auto;
}

.cl-cards {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.cl-cards__toolbar {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-shrink: 0;
}

.cl-cards__toolbar .cl-cards__search {
  flex: 1;
  min-width: 0;
}

.cl-cards__body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.cl-cards__empty {
  flex: 1;
  min-height: 140px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 28px 20px 40px;
  text-align: center;
}

.cl-cards__empty-icon-wrap {
  flex-shrink: 0;
  margin-bottom: 18px;
}

.cl-cards__empty-icon {
  display: block;
  width: 64px;
  height: auto;
  vertical-align: middle;
}

.cl-cards__empty-text {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.cl-cards__empty-line {
  display: block;
  font-size: 15px;
  line-height: 1.4;
  font-weight: 400;
  color: #888888;
  letter-spacing: -0.01em;
}

.cl-cards__list {
  list-style: none;
  margin: 0;
  padding: 0 2px 4px 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.cl-cards__item {
  margin: 0;
}

.cl-card {
  display: block;
  width: 100%;
  text-align: left;
  padding: 18px 18px 17px;
  border-radius: 14px;
  border: none;
  background: #2c2c2c;
  color: #fff;
  cursor: pointer;
  transition: background 0.15s;
}

.cl-card:hover {
  background: #353535;
}

.cl-card:focus-visible {
  outline: 2px solid rgba(249, 115, 22, 0.55);
  outline-offset: 2px;
}

.cl-card__title {
  margin: 0 0 12px;
  font-size: 19px;
  font-weight: 500;
  line-height: 1.25;
  letter-spacing: -0.02em;
  color: #fff;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cl-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-bottom: 12px;
}

.cl-card__tag {
  display: inline-block;
  max-width: 100%;
  padding: 6px 12px;
  border-radius: 9999px;
  font-size: 12px;
  font-weight: 500;
  line-height: 1.35;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cl-card__tag--loc {
  color: #ea580c;
  background: #fff2e8;
  border: 1.5px solid #fb923c;
}

.cl-card__tag--accent {
  color: #15803d;
  background: #f6ffed;
  border: 1.5px solid #4ade80;
}

.cl-card__excerpt {
  margin: 0;
  font-size: 14.5px;
  line-height: 1.48;
  font-weight: 400;
  color: #c4c4c4;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 4;
  line-clamp: 4;
  overflow: hidden;
}

.cl-sidebar-detail {
  flex: 1;
  min-height: 0;
  overflow-x: hidden;
  min-width: 0;
  --sidebar-muted: #a3a3a3;
  --sidebar-link: #60a5fa;
  --sidebar-tag-char-bg: #f6ffed;
  --sidebar-tag-quest-bg: #f0f5ff;
  --sidebar-tag-more-bg: rgba(115, 115, 115, 0.25);
}

.cl-sidebar-detail .map-sidebar__subnav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 22px;
  min-height: 28px;
}

.cl-sidebar-detail .map-sidebar__back {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 0;
  border: none;
  background: none;
  color: var(--sidebar-muted);
  font-size: 14px;
  cursor: pointer;
  transition: color 0.15s;
}

.cl-sidebar-detail .map-sidebar__back:hover {
  color: #e5e5e5;
}

.cl-sidebar-detail .map-sidebar__back-icon {
  flex-shrink: 0;
  opacity: 0.85;
}

.cl-sidebar-detail .map-sidebar__link {
  border: none;
  background: none;
  padding: 4px 0;
  font-size: 14px;
  font-weight: 500;
  color: var(--sidebar-link);
  cursor: pointer;
  transition: opacity 0.15s;
}

.cl-sidebar-detail .map-sidebar__link:hover {
  opacity: 0.88;
  text-decoration: underline;
}

.cl-sidebar-detail .map-sidebar__title {
  margin: 0 0 14px;
  font-size: 26px;
  font-weight: 600;
  line-height: 1.2;
  letter-spacing: -0.02em;
  color: #fafafa;
}

.cl-sidebar-detail .map-sidebar__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 20px;
}

.cl-sidebar-detail .map-sidebar__tag {
  display: inline-block;
  max-width: 100%;
  padding: 6px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;
  line-height: 1.35;
}

.cl-sidebar-detail .map-sidebar__tag--char {
  color: #389e0d;
  background: var(--sidebar-tag-char-bg);
  border: 1px solid #95de64;
}

.cl-sidebar-detail .map-sidebar__tag--quest {
  color: #2f54eb;
  background: var(--sidebar-tag-quest-bg);
  border: 1px solid #2f54eb;
}

.cl-sidebar-detail .map-sidebar__tag--more {
  color: #d4d4d4;
  background: var(--sidebar-tag-more-bg);
  border: 1px solid rgba(115, 115, 115, 0.4);
}

.map-sidebar__tag--clickable {
  appearance: none;
  border: none;
  cursor: pointer;
  font: inherit;
  transition: opacity 0.15s, transform 0.15s;
}

.map-sidebar__tag--clickable:hover {
  opacity: 0.88;
  transform: translateY(-1px);
}

.cl-card__tag--link {
  cursor: pointer;
}

.cl-card__tag--link:hover {
  filter: brightness(1.08);
}

.cl-sidebar-detail .map-sidebar__media {
  border-radius: 14px;
  overflow: hidden;
  margin-bottom: 24px;
  background: #0a0a0a;
}

.cl-sidebar-detail .map-sidebar__media-img {
  display: block;
  width: 100%;
  height: auto;
  max-height: 240px;
  object-fit: cover;
}

.cl-sidebar-detail .map-sidebar__section-title {
  margin: 0 0 12px;
  font-size: 21px;
  font-weight: 600;
  color: #fafafa;
}

.cl-sidebar-detail .map-sidebar__desc {
  margin: 0;
  font-size: 15.5px;
  line-height: 1.75;
  color: var(--sidebar-muted);
  white-space: pre-line;
}

.cl-detail-extra {
  margin-top: 4px;
}

.cl-detail-block {
  margin-top: 36px;
}

.cl-detail-block__heading {
  margin-bottom: 10px !important;
}

.cl-detail-block__list {
  margin: 0;
  padding: 4px 0 0 1.35rem;
  list-style: disc;
  color: rgba(255, 255, 255, 0.35);
}

.cl-detail-block__li {
  margin: 0;
  padding: 14px 0 0;
  line-height: 1.35;
}

.cl-detail-block__li:first-child {
  padding-top: 2px;
}

.cl-detail-block__plain {
  font-size: 15px;
  font-weight: 500;
  color: #fafafa;
}

.cl-detail-block__link {
  display: inline;
  padding: 0;
  margin: 0;
  border: none;
  background: none;
  font-family: inherit;
  font-size: 15px;
  font-weight: 500;
  line-height: inherit;
  color: var(--sidebar-link);
  cursor: pointer;
  text-align: left;
  text-decoration: none;
}

.cl-detail-block__link:hover {
  text-decoration: underline;
}

.cl-detail-block__link:focus-visible {
  outline: 2px solid rgba(96, 165, 250, 0.45);
  outline-offset: 2px;
}

.cl-detail-block__sub {
  margin: 4px 0 0;
  padding: 0;
  font-size: 13px;
  line-height: 1.5;
  font-style: italic;
  font-weight: 400;
  color: #8f8f8f;
  list-style: none;
}

.cl-detail-block__add {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-top: 18px;
  padding: 8px 16px;
  border: none;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.07);
  color: rgba(255, 255, 255, 0.55);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.cl-detail-block__add:hover {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.72);
}

.cl-detail-block__add-plus {
  font-size: 16px;
  font-weight: 400;
  line-height: 1;
  opacity: 0.7;
}

.cl-detail-block__empty-clue {
  margin: 0 0 12px;
  font-size: 13px;
  line-height: 1.5;
  color: rgba(255, 255, 255, 0.42);
}

.cl-create {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow: hidden;
}

.cl__crumbs {
  font-size: 12px;
  color: var(--cl-muted);
  line-height: 1.4;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.cl__crumb--accent {
  color: rgba(255, 255, 255, 0.75);
}

.cl__crumb-sep {
  opacity: 0.35;
}

.cl__search-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 14px;
  height: 42px;
  border-radius: 12px;
  background: var(--cl-panel);
  border: 1px solid var(--cl-line);
}

.cl__search-icon {
  flex-shrink: 0;
  color: var(--cl-muted);
  opacity: 0.85;
}

.cl__search {
  flex: 1;
  min-width: 0;
  border: none;
  background: transparent;
  color: var(--cl-text);
  font-size: 14px;
  outline: none;
}

.cl__search::placeholder {
  color: #737373;
}

.cl-cards__toolbar .cl-cards__search.cl__search-wrap {
  height: 40px;
  padding: 0 16px 0 14px;
  border-radius: 9999px;
  background: #2c2c2e;
  border: none;
  box-shadow:
    0 2px 6px rgba(0, 0, 0, 0.45),
    0 1px 2px rgba(0, 0, 0, 0.35);
}

.cl-cards__toolbar .cl-cards__search .cl__search-icon {
  color: #8e8e93;
  opacity: 1;
}

.cl-cards__toolbar .cl-cards__search .cl__search {
  font-size: 15px;
  font-weight: 400;
  letter-spacing: -0.01em;
}

.cl-cards__toolbar .cl-cards__search .cl__search::placeholder {
  color: #8e8e93;
}

.cl__grid--create {
  padding-top: 14px;
}

.cl-create__placeholder {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: 16px;
  padding: 8px 4px 24px;
}

.cl-create__muted {
  margin: 0;
  font-size: 15px;
  line-height: 1.5;
  color: var(--cl-muted);
}

.cl-create__back {
  appearance: none;
  border: none;
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
  font-size: 14px;
  font-weight: 500;
  padding: 10px 16px;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.15s;
}

.cl-create__back:hover {
  background: rgba(255, 255, 255, 0.12);
}

/* Модальное окно привязки сущностей (Teleport → body; scoped-атрибут наследует дочерние элементы) */
.cl-attach-overlay {
  position: fixed;
  inset: 0;
  z-index: 100000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px 16px;
  box-sizing: border-box;
}

.cl-attach-overlay__shade {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.62);
}

.cl-attach-overlay__sheet {
  position: relative;
  width: min(100%, 400px);
  max-height: min(78vh, 640px);
  display: flex;
  flex-direction: column;
  border-radius: 14px;
  background: #1f1f23;
  color: #f5f5f5;
  box-shadow:
    0 24px 80px rgba(0, 0, 0, 0.55),
    0 0 0 1px rgba(255, 255, 255, 0.06);
}

.cl-attach-overlay__toolbar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  flex-shrink: 0;
}

.cl-attach-overlay__title {
  margin: 0;
  font-size: 17px;
  font-weight: 600;
  line-height: 1.35;
}

.cl-attach-overlay__dismiss {
  flex-shrink: 0;
  margin: -4px -4px 0 0;
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: rgba(255, 255, 255, 0.52);
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
}

.cl-attach-overlay__dismiss:hover {
  color: rgba(255, 255, 255, 0.86);
  background: rgba(255, 255, 255, 0.06);
}

.cl-attach-overlay__body {
  padding: 14px 16px 18px;
  overflow-y: auto;
  overscroll-behavior: contain;
  font-size: 14px;
  line-height: 1.45;
}

.cl-attach-overlay__error {
  margin: 0 0 12px;
  font-size: 0.8125rem;
  color: #f87171;
}

.cl-attach-overlay__hint {
  margin: 0 0 12px;
  color: rgba(255, 255, 255, 0.45);
  font-size: 13px;
}

.cl-attach-overlay__subheading {
  margin: 0 0 8px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.38);
}

.cl-attach-overlay__subheading--divider {
  margin-top: 18px;
  padding-top: 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.cl-attach-overlay__muted-inline {
  margin: 0 0 12px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.4);
}

.cl-attach-overlay__choices {
  margin: 0 0 4px;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.cl-attach-overlay__choice {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  width: 100%;
  gap: 2px;
  padding: 10px 12px;
  margin: 0;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.04);
  cursor: pointer;
  text-align: left;
  color: inherit;
  font-family: inherit;
}

.cl-attach-overlay__choice:hover {
  background: rgba(255, 255, 255, 0.075);
}

.cl-attach-overlay__choice-title {
  font-size: 14px;
  font-weight: 600;
  color: #93c5fd;
}

.cl-attach-overlay__choice-meta {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.45);
}

.cl-attach-overlay__label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 12px;
  font-size: 12px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.55);
}

.cl-attach-overlay__input,
.cl-attach-overlay__textarea {
  width: 100%;
  box-sizing: border-box;
  margin: 0;
  padding: 9px 11px;
  border-radius: 9px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(0, 0, 0, 0.28);
  color: #fafafa;
  font-size: 14px;
  font-family: inherit;
  outline: none;
}

.cl-attach-overlay__input:focus-visible,
.cl-attach-overlay__textarea:focus-visible {
  border-color: rgba(249, 115, 22, 0.55);
}

.cl-attach-overlay__textarea {
  resize: vertical;
  min-height: 76px;
}

.cl-attach-overlay__actions-row {
  display: flex;
  justify-content: flex-end;
  margin-top: 4px;
}

.cl-attach-overlay__ghost {
  appearance: none;
  border: none;
  border-radius: 10px;
  padding: 9px 16px;
  font-size: 14px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  background: rgba(249, 115, 22, 0.18);
  color: #fdba74;
}

.cl-attach-overlay__ghost:hover:not(:disabled) {
  background: rgba(249, 115, 22, 0.26);
}

.cl-attach-overlay__ghost:disabled {
  opacity: 0.38;
  cursor: default;
}

.cl-attach-overlay__form {
  margin: 0;
}
</style>
