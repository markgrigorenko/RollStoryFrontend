<script setup lang="ts">
import { computed, inject, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'

import notFoundIconUrl from '@/assets/icons/not-found-icon.svg'
import InlineSectionLoader from '@/shared/ui/InlineSectionLoader.vue'
import { campaignLocationsMapBridgeKey } from '@/shared/lib/campaignLocationsMapBridge'
import { useCampaignQuestsStore } from '@/stores/campaignQuests'
import type { CampaignLocationListItem, LocationSheet } from '@/types/location-campaign'
import type { QuestLocationLink, QuestSheet } from '@/types/quest-campaign'

const props = defineProps<{
  locationList: CampaignLocationListItem[]
  locationSheets: Record<string, LocationSheet>
}>()

const emit = defineEmits<{
  (e: 'open-location', locationId: string): void
}>()

const questsStore = useCampaignQuestsStore()
const mapBridge = inject(campaignLocationsMapBridgeKey)
const { questList, questSheets, listLoading, loadedFromApi, lastError } = storeToRefs(questsStore)

const viewMode = ref<'browse' | 'create'>('browse')
const browsePhase = ref<'list' | 'detail'>('list')
const selectedId = ref(questList.value[0]?.id ?? '')
const searchQuery = ref('')

const createDraft = ref({ title: '', description: '' })
const createLoading = ref(false)
const attachLocationOpen = ref(false)
const attachLocationLoading = ref(false)

function watchQuestList() {
  if (questList.value.length > 0 && !questList.value.some((q) => q.id === selectedId.value)) {
    selectedId.value = questList.value[0]!.id
  }
}

watch(questList, watchQuestList, { immediate: true })

watch(
  () => mapBridge?.pendingDetailQuestId?.value ?? null,
  (id) => {
    if (!id || viewMode.value === 'create') return
    if (!questSheets.value[id]) return
    selectedId.value = id
    browsePhase.value = 'detail'
    if (mapBridge) mapBridge.pendingDetailQuestId.value = null
  }
)

onMounted(() => {
  void questsStore.loadFromApi()
})

const sheet = computed(() => {
  const s = questSheets.value[selectedId.value]
  if (s) return s
  return questList.value[0] ? questSheets.value[questList.value[0]!.id] : undefined
})

const filteredList = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return questList.value
  return questList.value.filter((item) => {
    const sh = questSheets.value[item.id]
    const hay = [
      item.listName,
      sh?.displayTitle ?? '',
      sh?.listSubtitle ?? '',
      sh?.description ?? '',
      ...(sh?.locationLinks.map((l) => l.locationTitle) ?? []),
    ]
      .join(' ')
      .toLowerCase()
    return hay.includes(q)
  })
})

const cardRows = computed(() =>
  filteredList.value.map((item) => ({
    item,
    sheet: questSheets.value[item.id],
  }))
)

const isSearchEmpty = computed(
  () => searchQuery.value.trim().length > 0 && filteredList.value.length === 0
)

function cardLocationVisible(sheet: NonNullable<(typeof cardRows.value)[0]['sheet']>): {
  visible: QuestLocationLink[]
  more: number
} {
  const links = sheet.locationLinks
  const max = 3
  if (links.length <= max) return { visible: links, more: 0 }
  return { visible: links.slice(0, max), more: links.length - max }
}

function detailLocationVisible(questSheet: QuestSheet): { visible: QuestLocationLink[]; more: number } {
  const links = questSheet.locationLinks
  const max = 2
  if (links.length <= max) return { visible: links, more: 0 }
  return { visible: links.slice(0, max), more: links.length - max }
}

function cardExcerptPlain(sheet: NonNullable<(typeof cardRows.value)[0]['sheet']>): string {
  return sheet.description.replace(/\s+/g, ' ').trim()
}

function onAddQuest() {
  browsePhase.value = 'list'
  viewMode.value = 'create'
  createDraft.value = { title: '', description: '' }
  lastError.value = null
}

function exitCreateMode() {
  viewMode.value = 'browse'
}

function openQuestDetail(id: string) {
  if (viewMode.value === 'create') return
  if (!questSheets.value[id]) return
  selectedId.value = id
  browsePhase.value = 'detail'
}

function backToQuestCards() {
  browsePhase.value = 'list'
}

async function submitCreate() {
  const title = createDraft.value.title.trim()
  if (!title || createLoading.value) return
  createLoading.value = true
  try {
    const result = await questsStore.createQuestApi(title, createDraft.value.description)
    if (!result.ok || !result.questId) return
    selectedId.value = result.questId
    viewMode.value = 'browse'
    browsePhase.value = 'detail'
  } finally {
    createLoading.value = false
  }
}

const attachableLocations = computed(() => {
  const cur = sheet.value
  if (!cur) return []
  const linked = new Set(cur.locationLinks.map((l) => l.locationId))
  return props.locationList
    .filter((loc) => !linked.has(loc.id))
    .map((loc) => ({
      id: loc.id,
      title: props.locationSheets[loc.id]?.displayTitle ?? loc.listName,
    }))
})

function openAttachLocationDialog() {
  lastError.value = null
  attachLocationOpen.value = true
}

async function attachLocation(locationId: string) {
  const cur = sheet.value
  if (!cur || attachLocationLoading.value) return
  const title = props.locationSheets[locationId]?.displayTitle ?? locationId
  attachLocationLoading.value = true
  try {
    const result = await questsStore.linkQuestToLocationApi(cur.id, locationId, title)
    if (result.questId !== cur.id) {
      selectedId.value = result.questId
    }
    if (result.ok) {
      attachLocationOpen.value = false
    }
  } finally {
    attachLocationLoading.value = false
  }
}

async function detachLocation(locationId: string) {
  const cur = sheet.value
  if (!cur) return
  await questsStore.unlinkQuestFromLocationApi(cur.id, locationId)
}

function openLinkedLocation(locationId: string) {
  if (mapBridge) {
    mapBridge.openLocation(locationId)
    return
  }
  emit('open-location', locationId)
}
</script>

<template>
  <div class="cq" aria-label="Квесты кампании">
    <div
      class="cq__grid"
      :class="{
        'cq__grid--browse-detail': viewMode === 'browse' && browsePhase === 'detail',
      }"
    >
      <template v-if="viewMode === 'browse' && browsePhase === 'list'">
        <div class="cq-cards">
          <div class="cq-cards__toolbar">
            <div class="cq__search-wrap cq-cards__search">
              <svg class="cq__search-icon" width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm9 2-4.35-4.35"
                  stroke="currentColor"
                  stroke-width="1.75"
                  stroke-linecap="round"
                />
              </svg>
              <input v-model="searchQuery" type="search" class="cq__search" placeholder="Поиск" autocomplete="off" />
            </div>
            <button type="button" class="cq-cards__add" @click="onAddQuest">
              Добавить<span class="cq-cards__add-plus" aria-hidden="true">+</span>
            </button>
          </div>
          <div class="cq-cards__body">
            <InlineSectionLoader v-if="listLoading && !loadedFromApi" />
            <template v-else>
            <div v-if="isSearchEmpty" class="cq-cards__empty" role="status">
              <div class="cq-cards__empty-icon-wrap">
                <img :src="notFoundIconUrl" alt="" class="cq-cards__empty-icon" width="64" height="40" />
              </div>
              <p class="cq-cards__empty-text">
                <span class="cq-cards__empty-line">По вашему запросу</span>
                <span class="cq-cards__empty-line">ничего не найдено</span>
              </p>
            </div>
            <ul v-else class="cq-cards__list" aria-label="Список квестов">
              <li v-for="({ item, sheet: qs }) in cardRows" :key="item.id" class="cq-cards__item">
                <button v-if="qs" type="button" class="cq-card" @click="openQuestDetail(item.id)">
                  <div class="cq-card__title">{{ qs.displayTitle }}</div>
                  <div class="cq-card__tags">
                    <button
                      v-for="link in cardLocationVisible(qs).visible"
                      :key="link.locationId"
                      type="button"
                      class="cq-card__tag cq-card__tag--loc cq-card__tag--link"
                      @click.stop="openLinkedLocation(link.locationId)"
                    >
                      {{ link.locationTitle }}
                    </button>
                    <span v-if="cardLocationVisible(qs).more > 0" class="cq-card__tag cq-card__tag--accent"
                      >+{{ cardLocationVisible(qs).more }}</span
                    >
                    <span v-if="!qs.locationLinks.length" class="cq-card__tag cq-card__tag--muted">Без локаций</span>
                  </div>
                  <p class="cq-card__excerpt">{{ cardExcerptPlain(qs) }}</p>
                </button>
              </li>
            </ul>
            </template>
          </div>
        </div>
      </template>

      <template v-else-if="viewMode === 'browse' && browsePhase === 'detail' && sheet">
        <div class="cq-sidebar-detail">
          <div class="map-sidebar__subnav">
            <button type="button" class="map-sidebar__back" @click="backToQuestCards">
              <svg class="map-sidebar__back-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M19 12H5M12 19l-7-7 7-7"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
              <span>Все квесты</span>
            </button>
            <button type="button" class="map-sidebar__link" @click="openAttachLocationDialog">
              Привязать локацию
            </button>
          </div>

          <p v-if="lastError" class="cq__action-error" role="alert">{{ lastError }}</p>

          <h1 class="map-sidebar__title">{{ sheet.displayTitle }}</h1>
          <div class="map-sidebar__tags">
            <button
              v-for="link in detailLocationVisible(sheet).visible"
              :key="link.locationId"
              type="button"
              class="map-sidebar__tag map-sidebar__tag--char map-sidebar__tag--clickable"
              @click="openLinkedLocation(link.locationId)"
            >
              {{ link.locationTitle }}
            </button>
            <span v-if="detailLocationVisible(sheet).more > 0" class="map-sidebar__tag map-sidebar__tag--more"
              >+{{ detailLocationVisible(sheet).more }}</span
            >
            <span v-if="sheet.isLocalOnly" class="map-sidebar__tag map-sidebar__tag--more">только локально</span>
          </div>
          <h2 class="map-sidebar__section-title">Описание</h2>
          <p class="map-sidebar__desc">{{ sheet.description || 'Описание пока не заполнено.' }}</p>

          <section class="cq-detail-block">
            <h2 class="map-sidebar__section-title cq-detail-block__heading">Локации</h2>
            <p v-if="!sheet.locationLinks.length" class="cq-detail-block__empty">К квесту пока не привязано ни одной локации.</p>
            <ul v-else class="cq-detail-block__list">
              <li v-for="link in sheet.locationLinks" :key="link.locationId" class="cq-detail-block__li">
                <div class="cq-detail-block__row">
                  <button type="button" class="cq-detail-block__link" @click="openLinkedLocation(link.locationId)">
                    {{ link.locationTitle }}
                  </button>
                  <button
                    type="button"
                    class="cq-detail-block__detach"
                    aria-label="Отвязать локацию"
                    @click="detachLocation(link.locationId)"
                  >
                    ×
                  </button>
                </div>
              </li>
            </ul>
          </section>
        </div>
      </template>

      <template v-else-if="viewMode === 'create'">
        <div class="cq-create">
          <nav class="cq__crumbs" aria-label="Навигация">
            <span class="cq__crumb">Квесты</span>
            <span class="cq__crumb-sep" aria-hidden="true">/</span>
            <span class="cq__crumb cq__crumb--accent">Новый квест</span>
          </nav>
          <form class="cq-create__form" @submit.prevent="submitCreate">
            <h1 class="cq-create__title">Новый квест</h1>
            <label class="cq-create__field">
              <span class="cq-create__lbl">Название</span>
              <input v-model="createDraft.title" type="text" class="cq-create__input" required autocomplete="off" />
            </label>
            <label class="cq-create__field">
              <span class="cq-create__lbl">Описание</span>
              <textarea v-model="createDraft.description" class="cq-create__textarea" rows="6" />
            </label>
            <p v-if="lastError" class="cq-create__error" role="alert">{{ lastError }}</p>
            <p class="cq-create__hint">
              Квест сохранится в кампании. Привязку к локациям можно сделать на карточке квеста.
            </p>
            <div class="cq-create__actions">
              <button type="button" class="cq-create__ghost" :disabled="createLoading" @click="exitCreateMode">
                Отмена
              </button>
              <button
                type="submit"
                class="cq-create__submit"
                :disabled="!createDraft.title.trim() || createLoading"
                :aria-busy="createLoading"
              >
                {{ createLoading ? 'Создание…' : 'Создать' }}
              </button>
            </div>
          </form>
        </div>
      </template>
    </div>

    <Teleport to="body">
      <div v-if="attachLocationOpen && sheet" class="cq-attach-overlay" aria-hidden="false">
        <div class="cq-attach-overlay__shade" @click="attachLocationOpen = false"></div>
        <div role="dialog" aria-modal="true" class="cq-attach-overlay__sheet" @click.stop>
          <header class="cq-attach-overlay__toolbar">
            <h2 class="cq-attach-overlay__title">Привязать локацию</h2>
            <button type="button" class="cq-attach-overlay__dismiss" aria-label="Закрыть" @click="attachLocationOpen = false">
              ×
            </button>
          </header>
          <div class="cq-attach-overlay__body">
            <p v-if="lastError" class="cq-attach-overlay__error" role="alert">{{ lastError }}</p>
            <ul v-if="attachableLocations.length" class="cq-attach-overlay__choices">
              <li v-for="loc in attachableLocations" :key="loc.id">
                <button
                  type="button"
                  class="cq-attach-overlay__choice"
                  :disabled="attachLocationLoading"
                  @click="attachLocation(loc.id)"
                >
                  {{ attachLocationLoading ? 'Привязка…' : loc.title }}
                </button>
              </li>
            </ul>
            <p v-else class="cq-attach-overlay__muted">Нет доступных локаций для привязки.</p>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.cq {
  --cq-bg: #121212;
  --cq-panel: #1a1a1a;
  --cq-muted: #a3a3a3;
  --cq-text: #fafafa;
  --cq-accent: #f97316;
  --cq-line: rgba(255, 255, 255, 0.08);

  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: var(--cq-bg);
  color: var(--cq-text);
}

.cq__grid {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px 18px 20px;
  overflow: hidden;
}

.cq__grid--browse-detail {
  gap: 0;
  padding: 20px 24px 32px;
  overflow-y: auto;
}

.cq__search-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 14px;
  height: 42px;
  border-radius: 12px;
  background: var(--cq-panel);
  border: 1px solid var(--cq-line);
}

.cq__search-icon {
  flex-shrink: 0;
  color: var(--cq-muted);
  opacity: 0.85;
}

.cq__search {
  flex: 1;
  min-width: 0;
  border: none;
  background: transparent;
  color: var(--cq-text);
  font-size: 14px;
  outline: none;
}

.cq__search::placeholder {
  color: #737373;
}

/* Поиск в списке квестов — как у персонажей и локаций */
.cq-cards__toolbar .cq-cards__search.cq__search-wrap {
  height: 40px;
  padding: 0 16px 0 14px;
  border-radius: 9999px;
  background: #2c2c2e;
  border: none;
  box-shadow:
    0 2px 6px rgba(0, 0, 0, 0.45),
    0 1px 2px rgba(0, 0, 0, 0.35);
}

.cq-cards__toolbar .cq-cards__search .cq__search-icon {
  color: #8e8e93;
  opacity: 1;
}

.cq-cards__toolbar .cq-cards__search .cq__search {
  font-size: 15px;
  font-weight: 400;
  letter-spacing: -0.01em;
}

.cq-cards__toolbar .cq-cards__search .cq__search::placeholder {
  color: #8e8e93;
}

.cq-cards {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.cq-cards__toolbar {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-shrink: 0;
}

.cq-cards__toolbar .cq-cards__search {
  flex: 1;
  min-width: 0;
}

.cq-cards__add {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 8px 2px;
  margin: 0;
  border: none;
  background: none;
  color: #007aff;
  font-size: 15px;
  font-weight: 400;
  font-family: system-ui, -apple-system, 'SF Pro Text', 'Segoe UI', sans-serif;
  letter-spacing: -0.01em;
  cursor: pointer;
  white-space: nowrap;
  -webkit-tap-highlight-color: transparent;
}

.cq-cards__add:hover {
  opacity: 0.82;
}

.cq-cards__add:active {
  opacity: 0.65;
}

.cq-cards__add-plus {
  font-size: 17px;
  font-weight: 400;
  line-height: 1;
  margin-top: -1px;
}

.cq-cards__hint {
  margin: 0;
  font-size: 13px;
  color: var(--cq-muted);
}

.cq-cards__body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.cq-cards__empty {
  flex: 1;
  min-height: 140px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 28px 20px 40px;
  text-align: center;
}

.cq-cards__empty-icon-wrap {
  flex-shrink: 0;
  margin-bottom: 18px;
}

.cq-cards__empty-icon {
  display: block;
  width: 64px;
  height: auto;
  vertical-align: middle;
}

.cq-cards__empty-text {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.cq-cards__empty-line {
  display: block;
  font-size: 15px;
  line-height: 1.4;
  font-weight: 400;
  color: #888888;
  letter-spacing: -0.01em;
}

.cq-cards__list {
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

.cq-card {
  display: block;
  width: 100%;
  text-align: left;
  padding: 18px;
  border-radius: 14px;
  border: none;
  background: #2c2c2c;
  color: #fff;
  cursor: pointer;
  transition: background 0.15s;
}

.cq-card:hover {
  background: #353535;
}

.cq-card__title {
  margin: 0 0 12px;
  font-size: 19px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cq-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.cq-card__tag {
  display: inline-block;
  padding: 6px 12px;
  border-radius: 9999px;
  font-size: 12px;
  font-weight: 500;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cq-card__tag--loc {
  color: #ea580c;
  background: #fff2e8;
  border: 1.5px solid #fb923c;
}

.cq-card__tag--accent {
  color: #15803d;
  background: #f6ffed;
  border: 1.5px solid #4ade80;
}

.cq-card__tag--muted {
  color: #a3a3a3;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
}

.cq-card__tag--link,
.map-sidebar__tag--clickable {
  appearance: none;
  cursor: pointer;
  font: inherit;
  transition: opacity 0.15s, transform 0.15s;
}

.cq-card__tag--link:hover,
.map-sidebar__tag--clickable:hover {
  opacity: 0.88;
  transform: translateY(-1px);
}

.cq-card__excerpt {
  margin: 0;
  font-size: 14.5px;
  line-height: 1.48;
  color: #c4c4c4;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 4;
  line-clamp: 4;
  overflow: hidden;
}

.cq-sidebar-detail {
  flex: 1;
  min-height: 0;
  overflow-x: hidden;
  --sidebar-muted: #a3a3a3;
  --sidebar-link: #60a5fa;
  --sidebar-tag-char-bg: #f6ffed;
  --sidebar-tag-more-bg: rgba(115, 115, 115, 0.25);
}

.cq-sidebar-detail .map-sidebar__subnav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 22px;
}

.cq-sidebar-detail .map-sidebar__back {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 0;
  border: none;
  background: none;
  color: var(--sidebar-muted);
  font-size: 14px;
  cursor: pointer;
}

.cq-sidebar-detail .map-sidebar__link {
  border: none;
  background: none;
  color: var(--sidebar-link);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}

.cq-sidebar-detail .map-sidebar__title {
  margin: 0 0 14px;
  font-size: 26px;
  font-weight: 600;
}

.cq-sidebar-detail .map-sidebar__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 20px;
}

.cq-sidebar-detail .map-sidebar__tag {
  padding: 6px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;
}

.cq-sidebar-detail .map-sidebar__tag--char {
  color: #389e0d;
  background: var(--sidebar-tag-char-bg);
  border: 1px solid #95de64;
}

.cq-sidebar-detail .map-sidebar__section-title {
  margin: 0 0 12px;
  font-size: 21px;
  font-weight: 600;
}

.cq-sidebar-detail .map-sidebar__desc {
  margin: 0 0 24px;
  font-size: 15px;
  line-height: 1.55;
  color: #d4d4d4;
}

.cq__action-error {
  margin: 0 0 12px;
  font-size: 0.8125rem;
  color: #f87171;
}

.cq-detail-block__heading {
  margin-bottom: 12px;
}

.cq-detail-block__empty {
  margin: 0;
  font-size: 14px;
  color: var(--cq-muted);
}

.cq-detail-block__list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.cq-detail-block__row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.cq-detail-block__link {
  border: none;
  background: none;
  padding: 0;
  color: #60a5fa;
  font-size: 15px;
  cursor: pointer;
  text-align: left;
}

.cq-detail-block__detach {
  flex-shrink: 0;
  width: 1.5rem;
  height: 1.5rem;
  border: none;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.08);
  color: #a3a3a3;
  cursor: pointer;
}

.cq-create {
  flex: 1;
  min-height: 0;
  min-width: 0;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.cq-create__form {
  width: 100%;
  max-width: none;
  box-sizing: border-box;
}

.cq-create__title {
  margin: 0 0 20px;
  font-size: 24px;
}

.cq-create__field {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}

.cq-create__lbl {
  font-size: 13px;
  color: var(--cq-muted);
}

.cq-create__input,
.cq-create__textarea {
  width: 100%;
  padding: 12px 14px;
  border-radius: 10px;
  border: 1px solid var(--cq-line);
  background: var(--cq-panel);
  color: var(--cq-text);
  font: inherit;
}

.cq-create__error {
  margin: 0 0 12px;
  font-size: 0.8125rem;
  color: #f87171;
}

.cq-create__hint {
  margin: 0 0 20px;
  font-size: 13px;
  line-height: 1.45;
  color: var(--cq-muted);
}

.cq-create__actions {
  display: flex;
  gap: 12px;
}

.cq-create__ghost,
.cq-create__submit {
  padding: 10px 18px;
  border-radius: 10px;
  font-size: 14px;
  cursor: pointer;
}

.cq-create__ghost {
  border: 1px solid var(--cq-line);
  background: transparent;
  color: var(--cq-text);
}

.cq-create__submit {
  border: none;
  background: var(--cq-accent);
  color: #fff;
}

.cq-attach-overlay {
  position: fixed;
  inset: 0;
  z-index: 12000;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.cq-attach-overlay__shade {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
}

.cq-attach-overlay__sheet {
  position: relative;
  width: min(480px, 100%);
  max-height: 70vh;
  margin: 0 16px 24px;
  padding: 16px 18px 20px;
  border-radius: 16px;
  background: #1e1e1e;
  overflow-y: auto;
}

.cq-attach-overlay__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.cq-attach-overlay__title {
  margin: 0;
  font-size: 18px;
}

.cq-attach-overlay__dismiss {
  border: none;
  background: none;
  color: #fff;
  font-size: 24px;
  cursor: pointer;
}

.cq-attach-overlay__choices {
  list-style: none;
  margin: 0;
  padding: 0;
}

.cq-attach-overlay__choice {
  display: block;
  width: 100%;
  text-align: left;
  padding: 12px 10px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #fafafa;
  font-size: 15px;
  cursor: pointer;
}

.cq-attach-overlay__choice:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.06);
}

.cq-attach-overlay__choice:disabled {
  opacity: 0.7;
  cursor: wait;
}

.cq-attach-overlay__error {
  margin: 0 0 12px;
  font-size: 0.8125rem;
  color: #f87171;
}

.cq-attach-overlay__muted {
  margin: 0;
  color: var(--cq-muted);
  font-size: 14px;
}
</style>
