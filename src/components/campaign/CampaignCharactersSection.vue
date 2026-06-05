<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'

import CharacterCreateWizard from '@/components/campaign/CharacterCreateWizard.vue'
import CharacterSheetSummaryPanel from '@/components/campaign/CharacterSheetSummaryPanel.vue'
import notFoundIconUrl from '@/assets/icons/not-found-icon.svg'
import InlineSectionLoader from '@/shared/ui/InlineSectionLoader.vue'
import { useCampaignCharactersStore } from '@/stores/campaignCharacters'
import {
  createCharacterSheetFromDraft,
  defaultCharacterCreateDraft,
  DEMO_CHARACTER_SHEETS,
  resolveCharacterPortraitUrl,
  type CharacterCreateDraft,
  type CharacterSheet,
} from '@/types/character-campaign'

const props = withDefaults(
  defineProps<{
    /** true = полноэкранное меню кампании (полный лист); false = док-сайдбар (кратко как локация) */
    campaignFullscreen?: boolean
  }>(),
  { campaignFullscreen: false }
)

const charactersStore = useCampaignCharactersStore()
const { characterList, characterSheets, listLoading, loadedFromApi } = storeToRefs(charactersStore)

const viewMode = ref<'browse' | 'create'>('browse')
/** Список карточек ↔ лист персонажа */
const browsePhase = ref<'list' | 'detail'>('list')
const createDraft = ref<CharacterCreateDraft>(defaultCharacterCreateDraft())
const lastCreateError = ref<string | null>(null)

const selectedId = ref<string>('gleff')

watch(
  characterList,
  (list) => {
    if (list.length > 0 && !list.some((c) => c.id === selectedId.value)) {
      selectedId.value = list[0]!.id
    }
  },
  { immediate: true }
)

onMounted(() => {
  void charactersStore.loadFromApi()
})
const searchQuery = ref('')

const sheet = computed((): CharacterSheet => {
  const s = characterSheets.value[selectedId.value]
  if (s) return s
  return DEMO_CHARACTER_SHEETS.gleff
})

const filteredList = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return characterList.value
  return characterList.value.filter((c) => {
    const sheet = characterSheets.value[c.id]
    const hay = [
      c.listName,
      sheet?.displayTitle ?? '',
      sheet?.listSubtitle ?? '',
      ...(sheet?.questTags.map((t) => t.label) ?? []),
    ]
      .join(' ')
      .toLowerCase()
    return hay.includes(q)
  })
})

const cardRows = computed(() =>
  filteredList.value.map((item) => ({
    item,
    sheet: characterSheets.value[item.id] ?? DEMO_CHARACTER_SHEETS.gleff,
  }))
)

const isSearchEmpty = computed(
  () => searchQuery.value.trim().length > 0 && filteredList.value.length === 0
)

/** Оранжевый чип локации в карточке */
function cardLocationLabel(sheet: CharacterSheet): string | null {
  return (
    sheet.locationLabel ??
    sheet.questTags.find((t) => t.variant === 'orange')?.label ??
    sheet.breadcrumbTail ??
    null
  )
}

/** Подписи чипов квестов (без чипа, совпадающего с локацией из оранжевого тега) */
function cardQuestLabels(sheet: CharacterSheet): string[] {
  const orangeLoc = sheet.questTags.find((t) => t.variant === 'orange')?.label
  return sheet.questTags
    .filter((t) => {
      if (sheet.locationLabel) return t.variant !== 'orange'
      if (orangeLoc && t.variant === 'orange' && t.label === orangeLoc) return false
      return true
    })
    .map((t) => t.label)
}

function cardQuestVisible(sheet: CharacterSheet): { visible: string[]; more: number } {
  const labels = cardQuestLabels(sheet)
  const max = 3
  if (labels.length <= max) return { visible: labels, more: 0 }
  return { visible: labels.slice(0, max), more: labels.length - max }
}

/** В док-сайдбаре — как у локации: две синие плашки +N */
function detailQuestVisible(sheet: CharacterSheet): { visible: string[]; more: number } {
  const labels = cardQuestLabels(sheet)
  const max = 2
  if (labels.length <= max) return { visible: labels, more: 0 }
  return { visible: labels.slice(0, max), more: labels.length - max }
}

function detailMetaLine(sheet: CharacterSheet): string {
  return sheet.listSubtitle?.trim() || sheet.breadcrumbTail?.trim() || 'Персонаж'
}

function cardBioPlain(sheet: CharacterSheet): string {
  return sheet.history.replace(/\s+/g, ' ').trim()
}

function onAddCharacter() {
  browsePhase.value = 'list'
  viewMode.value = 'create'
  createDraft.value = defaultCharacterCreateDraft()
  lastCreateError.value = null
}

function exitCreateMode() {
  viewMode.value = 'browse'
}

function openCharacterDetail(id: string) {
  if (viewMode.value === 'create') return
  selectedId.value = id
  browsePhase.value = 'detail'
  void charactersStore.ensureDetailLoaded(id)
}

function backToCharacterCards() {
  browsePhase.value = 'list'
}

const sheetJumpSections = [
  'Основное',
  'Навыки',
  'История',
  'Связи',
  'Инвентарь',
  'Умения',
  'Оружие',
] as const

function crumbTitle(s: CharacterSheet): string {
  const t = s.displayTitle
  return t.length > 28 ? `${t.slice(0, 27)}…` : t
}

async function onCreateComplete(payload?: {
  characterId?: string
  avatarUploadError?: string
  avatarUrl?: string
}) {
  lastCreateError.value = payload?.avatarUploadError ?? null

  if (payload?.characterId) {
    charactersStore.invalidateCharacterDetail(payload.characterId)
    await charactersStore.loadFromApi()
    await charactersStore.ensureDetailLoaded(payload.characterId)
    if (payload.avatarUrl) {
      charactersStore.setCharacterPortraitUrl(payload.characterId, payload.avatarUrl)
    }
    selectedId.value = payload.characterId
    viewMode.value = 'browse'
    browsePhase.value = 'detail'
    return
  }

  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `new-${Date.now()}`
  const draft = { ...createDraft.value }
  const listName = draft.name.trim() || 'Новый персонаж'
  const portraitUrl = draft.pendingAvatarFile ? URL.createObjectURL(draft.pendingAvatarFile) : undefined
  charactersStore.upsertLocalCharacter(id, listName, createCharacterSheetFromDraft(id, draft, portraitUrl))
  selectedId.value = id
  viewMode.value = 'browse'
  browsePhase.value = 'detail'
}

</script>

<template>
  <div class="cc" aria-label="Персонажи кампании">
    <div
      class="cc__grid"
      :class="{
        'cc__grid--browse-detail': viewMode === 'browse' && browsePhase === 'detail',
        'cc__grid--sheet': viewMode === 'browse' && browsePhase === 'detail' && campaignFullscreen,
      }"
    >
      <template v-if="viewMode === 'browse' && browsePhase === 'list'">
        <div class="cc-cards">
          <div class="cc-cards__toolbar">
            <div class="cc__search-wrap cc-cards__search">
              <svg class="cc__search-icon" width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm9 2-4.35-4.35"
                  stroke="currentColor"
                  stroke-width="1.75"
                  stroke-linecap="round"
                />
              </svg>
              <input v-model="searchQuery" type="search" class="cc__search" placeholder="Поиск" autocomplete="off" />
            </div>
            <button type="button" class="cc-cards__add" @click="onAddCharacter">
              Добавить<span class="cc-cards__add-plus" aria-hidden="true">+</span>
            </button>
          </div>
          <div class="cc-cards__body">
            <InlineSectionLoader v-if="listLoading && !loadedFromApi" />
            <template v-else>
            <div v-if="isSearchEmpty" class="cc-cards__empty" role="status">
              <div class="cc-cards__empty-icon-wrap">
                <img :src="notFoundIconUrl" alt="" class="cc-cards__empty-icon" width="64" height="40" />
              </div>
              <p class="cc-cards__empty-text">
                <span class="cc-cards__empty-line">По вашему запросу</span>
                <span class="cc-cards__empty-line">ничего не найдено</span>
              </p>
            </div>
            <ul v-else class="cc-cards__list" aria-label="Список персонажей">
              <li v-for="({ item: c, sheet: cs }) in cardRows" :key="c.id" class="cc-cards__item">
                <button type="button" class="cc-card" @click="openCharacterDetail(c.id)">
                  <div
                    class="cc-card__avatar"
                    :class="{ 'cc-card__avatar--empty': !resolveCharacterPortraitUrl(cs.portraitUrl) }"
                  >
                    <img
                      v-if="resolveCharacterPortraitUrl(cs.portraitUrl)"
                      :src="resolveCharacterPortraitUrl(cs.portraitUrl)!"
                      alt=""
                      class="cc-card__avatar-img"
                    />
                  </div>
                  <div class="cc-card__content">
                    <div class="cc-card__title">{{ cs.displayTitle }}</div>
                    <div class="cc-card__tags">
                      <span v-if="cardLocationLabel(cs)" class="cc-card__tag cc-card__tag--loc">{{ cardLocationLabel(cs) }}</span>
                      <span
                        v-for="(ql, qi) in cardQuestVisible(cs).visible"
                        :key="qi"
                        class="cc-card__tag cc-card__tag--accent"
                        >{{ ql }}</span
                      >
                      <span v-if="cardQuestVisible(cs).more > 0" class="cc-card__tag cc-card__tag--accent"
                        >+{{ cardQuestVisible(cs).more }}</span
                      >
                    </div>
                    <p class="cc-card__excerpt">{{ cardBioPlain(cs) }}</p>
                  </div>
                </button>
              </li>
            </ul>
            </template>
          </div>
        </div>
      </template>

      <template v-else-if="viewMode === 'browse' && browsePhase === 'detail' && !campaignFullscreen">
        <div class="cc-sidebar-detail">
          <div class="map-sidebar__subnav">
            <button type="button" class="map-sidebar__back" @click="backToCharacterCards">
              <svg class="map-sidebar__back-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M19 12H5M12 19l-7-7 7-7"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
              <span>Персонажи</span>
            </button>
          </div>

          <h1 class="map-sidebar__title">{{ sheet.displayTitle }}</h1>
          <div class="map-sidebar__tags">
            <span class="map-sidebar__tag map-sidebar__tag--char">{{ detailMetaLine(sheet) }}</span>
            <span
              v-for="(ql, qi) in detailQuestVisible(sheet).visible"
              :key="qi"
              class="map-sidebar__tag map-sidebar__tag--quest"
              >{{ ql }}</span
            >
            <span v-if="detailQuestVisible(sheet).more > 0" class="map-sidebar__tag map-sidebar__tag--more"
              >+{{ detailQuestVisible(sheet).more }}</span
            >
          </div>
          <div
            class="map-sidebar__media"
            :class="{ 'map-sidebar__media--empty': !resolveCharacterPortraitUrl(sheet.portraitUrl) }"
          >
            <img
              v-if="resolveCharacterPortraitUrl(sheet.portraitUrl)"
              :src="resolveCharacterPortraitUrl(sheet.portraitUrl)!"
              alt=""
              class="map-sidebar__media-img"
            />
          </div>
          <h2 class="map-sidebar__section-title">Описание</h2>
          <p class="map-sidebar__desc">{{ sheet.history }}</p>
        </div>
      </template>

      <template v-else-if="viewMode === 'browse' && browsePhase === 'detail' && campaignFullscreen">
        <aside class="cc-sheet-rail" aria-label="Список персонажей">
          <nav class="cc-sheet-rail__crumbs" aria-label="Крошки">
            <span class="cc-sheet-rail__crumb">Персонажи</span>
            <span class="cc-sheet-rail__sep" aria-hidden="true">/</span>
            <span class="cc-sheet-rail__crumb cc-sheet-rail__crumb--fade">{{ crumbTitle(sheet) }}</span>
            <span class="cc-sheet-rail__sep" aria-hidden="true">/</span>
            <span class="cc-sheet-rail__crumb">{{ sheet.breadcrumbTail }}</span>
          </nav>
          <div class="cc__search-wrap cc-sheet-rail__search">
            <svg class="cc__search-icon" width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm9 2-4.35-4.35"
                stroke="currentColor"
                stroke-width="1.75"
                stroke-linecap="round"
              />
            </svg>
            <input v-model="searchQuery" type="search" class="cc__search" placeholder="Персонаж" autocomplete="off" />
          </div>
          <button type="button" class="cc-sheet-rail__add" @click="onAddCharacter">
            <span class="cc-sheet-rail__add-plus" aria-hidden="true">+</span>
            Добавить персонажа
          </button>
          <ul class="cc-sheet-rail__names" aria-label="Имена">
            <li v-for="c in filteredList" :key="c.id" class="cc-sheet-rail__li">
              <button
                type="button"
                class="cc-sheet-rail__name"
                :class="{ 'cc-sheet-rail__name--active': c.id === selectedId }"
                @click="openCharacterDetail(c.id)"
              >
                <span
                  class="cc-sheet-rail__avatar"
                  :class="{ 'cc-sheet-rail__avatar--empty': !resolveCharacterPortraitUrl(characterSheets[c.id]?.portraitUrl) }"
                >
                  <img
                    v-if="resolveCharacterPortraitUrl(characterSheets[c.id]?.portraitUrl)"
                    :src="resolveCharacterPortraitUrl(characterSheets[c.id]?.portraitUrl)!"
                    alt=""
                    class="cc-sheet-rail__avatar-img"
                  />
                </span>
                <span class="cc-sheet-rail__label">
                  {{ characterSheets[c.id]?.displayTitle ?? c.listName }}
                </span>
              </button>
            </li>
          </ul>
        </aside>

        <div class="cc-sheet-main">
          <div class="cc-sheet-main__subnav">
            <button type="button" class="cc-sheet-main__back-link" @click="backToCharacterCards">
              <svg class="cc-sheet-main__back-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M19 12H5M12 19l-7-7 7-7"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
              <span>Все персонажи</span>
            </button>
          </div>
          <CharacterSheetSummaryPanel :sheet="sheet" />
        </div>

        <aside class="cc-sheet-jump" aria-label="По разделам">
          <span
            v-for="label in sheetJumpSections"
            :key="label"
            class="cc-sheet-jump__btn-wip"
          >
            <button
              type="button"
              class="cc-sheet-jump__btn"
              :aria-describedby="`cc-sheet-jump-wip-${label}`"
              disabled
            >
              {{ label }}
            </button>
            <span :id="`cc-sheet-jump-wip-${label}`" class="cc-sheet-jump__tooltip" role="tooltip">
              Функция в разработке
            </span>
          </span>
        </aside>
      </template>

      <template v-else>
        <div class="cc-create">
          <nav class="cc__crumbs" aria-label="Навигация">
            <span class="cc__crumb">Персонажи</span>
            <span class="cc__crumb-sep" aria-hidden="true">/</span>
            <span class="cc__crumb cc__crumb--accent">Новый персонаж</span>
          </nav>
          <div class="cc__main cc__main--wizard">
            <p v-if="lastCreateError" class="cc__create-error" role="alert">{{ lastCreateError }}</p>
            <CharacterCreateWizard
              v-model="createDraft"
              @cancel="exitCreateMode"
              @complete="onCreateComplete"
            />
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.cc__create-error {
  margin: 0 0 12px;
  padding: 0 4px;
  font-size: 0.8125rem;
  color: #f87171;
}

.cc {
  --cc-bg: #121212;
  --cc-panel: #1a1a1a;
  --cc-muted: #a3a3a3;
  --cc-text: #fafafa;
  --cc-accent: #f97316;
  --cc-line: rgba(255, 255, 255, 0.08);

  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: var(--cc-bg);
  color: var(--cc-text);
}

.cc__grid {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px 18px 20px;
  overflow: hidden;
}

.cc__grid--browse-detail {
  gap: 0;
  padding: 20px 24px 32px;
  overflow-y: auto;
}

.cc__grid--browse-detail.cc__grid--sheet {
  padding: 0;
  overflow: visible;
  display: grid;
  grid-template-columns: minmax(0, 240px) minmax(0, 1fr) minmax(0, 132px);
  grid-template-rows: 1fr;
  align-items: stretch;
  min-height: 0;
}

@media (max-width: 720px) {
  .cc__grid--browse-detail.cc__grid--sheet {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto 1fr;
  }

  .cc-sheet-jump {
    display: none;
  }

  .cc-sheet-rail {
    border-right: none;
    border-bottom: 1px solid var(--cc-line);
    max-height: 42vh;
  }
}

.cc-sheet-rail {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-height: 0;
  min-width: 0;
  padding: 14px 14px 12px;
  border-right: 1px solid var(--cc-line);
  background: rgba(0, 0, 0, 0.2);
  overflow: hidden;
}

.cc-sheet-rail__crumbs {
  font-size: 11px;
  line-height: 1.45;
  color: var(--cc-muted);
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.cc-sheet-rail__sep {
  opacity: 0.45;
}

.cc-sheet-rail__crumb--fade {
  color: rgba(255, 255, 255, 0.55);
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cc-sheet-rail__search.cc__search-wrap {
  flex-shrink: 0;
  height: 38px;
  padding: 0 12px 0 10px;
  border-radius: 10px;
  background: var(--cc-panel);
  border: 1px solid var(--cc-line);
}

.cc-sheet-rail__add {
  flex-shrink: 0;
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 0;
  margin: 0;
  border: none;
  background: none;
  color: #007aff;
  font-size: 14px;
  font-weight: 400;
  cursor: pointer;
  text-align: left;
}

.cc-sheet-rail__add:hover {
  opacity: 0.85;
}

.cc-sheet-rail__add-plus {
  font-size: 16px;
  font-weight: 500;
  line-height: 1;
}

.cc-sheet-rail__names {
  list-style: none;
  margin: 0;
  padding: 0 0 8px;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.cc-sheet-rail__name {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  text-align: left;
  padding: 8px 10px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: rgba(255, 255, 255, 0.88);
  font-size: 13px;
  font-weight: 500;
  line-height: 1.35;
  cursor: pointer;
  transition: background 0.12s;
}

.cc-sheet-rail__name--active {
  background: rgba(255, 255, 255, 0.08);
}

.cc-sheet-rail__avatar {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  overflow: hidden;
  background: #2a2a2a;
}

.cc-sheet-rail__avatar--empty {
  background: linear-gradient(145deg, #3a3a3a, #252525);
}

.cc-sheet-rail__avatar-img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cc-sheet-rail__label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cc-sheet-rail__name:hover {
  background: rgba(255, 255, 255, 0.06);
}

.cc-sheet-main {
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 12px 16px 16px;
}

.cc-sheet-main__subnav {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.cc-sheet-main__back-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: none;
  background: none;
  padding: 4px 0;
  font-size: 14px;
  font-weight: 500;
  color: var(--cc-muted);
  cursor: pointer;
  transition: color 0.15s;
}

.cc-sheet-main__back-icon {
  flex-shrink: 0;
  opacity: 0.85;
}

.cc-sheet-main__back-link:hover {
  color: #fff;
}

.cc-sheet-jump {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 4px;
  padding: 20px 12px 16px;
  border-left: 1px solid var(--cc-line);
  background: rgba(0, 0, 0, 0.12);
  overflow: visible;
  min-height: 0;
}

.cc-sheet-jump__btn {
  width: 100%;
  text-align: left;
  padding: 8px 6px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: rgba(255, 255, 255, 0.75);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: color 0.12s, background 0.12s;
}

.cc-sheet-jump__btn-wip {
  position: relative;
  display: block;
}

.cc-sheet-jump__btn-wip .cc-sheet-jump__btn:disabled {
  pointer-events: none;
}

.cc-sheet-jump__btn-wip:hover {
  cursor: not-allowed;
}

.cc-sheet-jump__tooltip {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  z-index: 30;
  padding: 8px 12px;
  border-radius: 8px;
  background: rgba(33, 33, 33, 0.96);
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.35);
  color: #fff;
  font-size: 13px;
  font-weight: 500;
  line-height: 1.3;
  white-space: nowrap;
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transform: translateY(-4px);
  transition:
    opacity 0.15s ease,
    transform 0.15s ease,
    visibility 0.15s;
}

.cc-sheet-jump__btn-wip:hover .cc-sheet-jump__tooltip,
.cc-sheet-jump__btn-wip:focus-within .cc-sheet-jump__tooltip {
  opacity: 1;
  visibility: visible;
  transform: translateY(0);
}

.cc-sheet-jump__btn:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.06);
}

.cc-cards {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.cc-cards__toolbar {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-shrink: 0;
}

.cc-cards__toolbar .cc-cards__search {
  flex: 1;
  min-width: 0;
}

.cc-cards__add {
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

.cc-cards__add:hover {
  opacity: 0.82;
}

.cc-cards__add:active {
  opacity: 0.65;
}

.cc-cards__add-plus {
  font-size: 17px;
  font-weight: 400;
  line-height: 1;
  margin-top: -1px;
}

.cc-cards__body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.cc-cards__empty {
  flex: 1;
  min-height: 140px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 28px 20px 40px;
  text-align: center;
}

.cc-cards__empty-icon-wrap {
  flex-shrink: 0;
  margin-bottom: 18px;
}

.cc-cards__empty-icon {
  display: block;
  width: 64px;
  height: auto;
  vertical-align: middle;
}

.cc-cards__empty-text {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.cc-cards__empty-line {
  display: block;
  font-size: 15px;
  line-height: 1.4;
  font-weight: 400;
  color: #888888;
  letter-spacing: -0.01em;
}

.cc-cards__list {
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

.cc-cards__item {
  margin: 0;
}

.cc-card {
  display: flex;
  align-items: stretch;
  gap: 14px;
  width: 100%;
  text-align: left;
  padding: 14px;
  border-radius: 14px;
  border: none;
  background: #2c2c2c;
  color: #fff;
  cursor: pointer;
  transition: background 0.15s;
}

.cc-card__avatar {
  flex: 0 0 88px;
  width: 88px;
  align-self: stretch;
  min-height: 88px;
  border-radius: 10px;
  overflow: hidden;
  background: #1f1f1f;
}

.cc-card__avatar--empty {
  background: linear-gradient(145deg, #3a3a3a, #252525);
}

.cc-card__avatar-img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cc-card__content {
  min-width: 0;
  flex: 1;
  padding: 0;
}

.cc-card:hover {
  background: #353535;
}

.cc-card:focus-visible {
  outline: 2px solid rgba(249, 115, 22, 0.55);
  outline-offset: 2px;
}

.cc-card__title {
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

.cc-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-bottom: 12px;
}

.cc-card__tag {
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

/* Локация: персиковый фон, оранжевая обводка и текст */
.cc-card__tag--loc {
  color: #ea580c;
  background: #fff2e8;
  border: 1.5px solid #fb923c;
}

/* Связанные персонажи / квесты в списке — мятно-зелёные чипы как на макете */
.cc-card__tag--accent {
  color: #15803d;
  background: #f6ffed;
  border: 1.5px solid #4ade80;
}

.cc-card__excerpt {
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

/* Док-сайдбар: деталка персонажа 1:1 с блоком локации (scoped) */
.cc-sidebar-detail {
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

.cc-sidebar-detail .map-sidebar__subnav {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 22px;
  min-height: 28px;
}

.cc-sidebar-detail .map-sidebar__back {
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

.cc-sidebar-detail .map-sidebar__back:hover {
  color: #e5e5e5;
}

.cc-sidebar-detail .map-sidebar__back-icon {
  flex-shrink: 0;
  opacity: 0.85;
}

.cc-sidebar-detail .map-sidebar__title {
  margin: 0 0 14px;
  font-size: 26px;
  font-weight: 600;
  line-height: 1.2;
  letter-spacing: -0.02em;
  color: #fafafa;
}

.cc-sidebar-detail .map-sidebar__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 20px;
}

.cc-sidebar-detail .map-sidebar__tag {
  display: inline-block;
  max-width: 100%;
  padding: 6px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;
  line-height: 1.35;
}

.cc-sidebar-detail .map-sidebar__tag--char {
  color: #389e0d;
  background: var(--sidebar-tag-char-bg);
  border: 1px solid #95de64;
}

.cc-sidebar-detail .map-sidebar__tag--quest {
  color: #2f54eb;
  background: var(--sidebar-tag-quest-bg);
  border: 1px solid #2f54eb;
}

.cc-sidebar-detail .map-sidebar__tag--more {
  color: #d4d4d4;
  background: var(--sidebar-tag-more-bg);
  border: 1px solid rgba(115, 115, 115, 0.4);
}

.cc-sidebar-detail .map-sidebar__media {
  border-radius: 14px;
  overflow: hidden;
  margin-bottom: 24px;
  background: #0a0a0a;
}

.cc-sidebar-detail .map-sidebar__media--empty {
  min-height: 160px;
  background: linear-gradient(145deg, #1e3a5f, #0f172a);
}

.cc-sidebar-detail .map-sidebar__media-img {
  display: block;
  width: 100%;
  height: auto;
  max-height: 240px;
  object-fit: cover;
}

.cc-sidebar-detail .map-sidebar__section-title {
  margin: 0 0 12px;
  font-size: 21px;
  font-weight: 600;
  color: #fafafa;
}

.cc-sidebar-detail .map-sidebar__desc {
  margin: 0;
  font-size: 15.5px;
  line-height: 1.75;
  color: var(--sidebar-muted);
  white-space: pre-line;
}

.cc-create {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow: hidden;
}

.cc-create .cc__crumbs {
  flex-shrink: 0;
}

.cc-create .cc__main--wizard {
  flex: 1;
  min-height: 0;
}

.cc__crumbs {
  font-size: 12px;
  color: var(--cc-muted);
  line-height: 1.4;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
}

.cc__crumb--fade {
  color: rgba(255, 255, 255, 0.45);
  max-width: 100%;
}

.cc__crumb--accent {
  color: rgba(255, 255, 255, 0.75);
}

.cc__crumb-sep {
  opacity: 0.35;
}

.cc__search-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 14px;
  height: 42px;
  border-radius: 12px;
  background: var(--cc-panel);
  border: 1px solid var(--cc-line);
}

.cc__search-icon {
  flex-shrink: 0;
  color: var(--cc-muted);
  opacity: 0.85;
}

.cc__search {
  flex: 1;
  min-width: 0;
  border: none;
  background: transparent;
  color: var(--cc-text);
  font-size: 14px;
  outline: none;
}

.cc__search::placeholder {
  color: #737373;
}

/* Поиск в списке персонажей — после базовых .cc__search-wrap */
.cc-cards__toolbar .cc-cards__search.cc__search-wrap {
  height: 40px;
  padding: 0 16px 0 14px;
  border-radius: 9999px;
  background: #2c2c2e;
  border: none;
  box-shadow:
    0 2px 6px rgba(0, 0, 0, 0.45),
    0 1px 2px rgba(0, 0, 0, 0.35);
}

.cc-cards__toolbar .cc-cards__search .cc__search-icon {
  color: #8e8e93;
  opacity: 1;
}

.cc-cards__toolbar .cc-cards__search .cc__search {
  font-size: 15px;
  font-weight: 400;
  letter-spacing: -0.01em;
}

.cc-cards__toolbar .cc-cards__search .cc__search::placeholder {
  color: #8e8e93;
}

.cc__main {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 4px;
  display: flex;
  flex-direction: column;
  gap: 28px;
}

.cc__main--wizard {
  display: flex;
  flex-direction: column;
}
</style>
