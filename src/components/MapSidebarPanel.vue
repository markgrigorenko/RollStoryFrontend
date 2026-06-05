<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { storeToRefs } from 'pinia'

import CampaignCharactersSection from '@/components/campaign/CampaignCharactersSection.vue'
import CampaignLocationsSection from '@/components/campaign/CampaignLocationsSection.vue'
import CampaignQuestsSection from '@/components/campaign/CampaignQuestsSection.vue'
import { useActiveCampaignStore } from '@/stores/activeCampaign'
import type { CampaignLocationListItem, LocationSheet } from '@/types/location-campaign'

export type SidebarTab = 'characters' | 'quests' | 'locations' | 'sessions'

const props = withDefaults(
  defineProps<{
    activeTab: SidebarTab
    /** Картинка для блока локации (по умолчанию — та же, что карта) */
    locationImageUrl?: string
    /** Меню кампании на весь экран — для персонажей показываем полный лист, в доке — как локация */
    campaignFullscreen?: boolean
    /** Привязка списка локаций и пинов к текущему холсту карты */
    activeMapCanvasId: string
    locationsLoading?: boolean
  }>(),
  { locationImageUrl: '', campaignFullscreen: false, locationsLoading: false }
)

const emit = defineEmits<{
  (e: 'update:activeTab', tab: SidebarTab): void
  (e: 'open-location-map', payload: { imageUrl: string; title: string; locationId: string }): void
  (e: 'campaign-changed'): void
  (e: 'open-location', locationId: string): void
}>()

const activeCampaignStore = useActiveCampaignStore()
const { campaigns, campaignId } = storeToRefs(activeCampaignStore)

const showCampaignPicker = computed(() => campaigns.value.length > 1)

onMounted(() => {
  void (async () => {
    const id = await activeCampaignStore.ensureCampaignId()
    if (id) emit('campaign-changed')
  })()
})

function onCampaignSelect(ev: Event) {
  const id = (ev.target as HTMLSelectElement).value
  if (!id || id === campaignId.value) return
  activeCampaignStore.setCampaignId(id)
  emit('campaign-changed')
}

const locationList = defineModel<CampaignLocationListItem[]>('locationList', { required: true })
const locationSheets = defineModel<Record<string, LocationSheet>>('locationSheets', { required: true })
const tabs: { id: SidebarTab; label: string; wip?: boolean }[] = [
  { id: 'characters', label: 'Персонажи' },
  { id: 'quests', label: 'Квесты' },
  { id: 'locations', label: 'Локации' },
  { id: 'sessions', label: 'Сессии', wip: true },
]

function setTab(tab: SidebarTab) {
  emit('update:activeTab', tab)
}
</script>

<template>
  <aside class="map-sidebar" aria-label="Панель кампании">
    <header class="map-sidebar__head">
      <label v-if="showCampaignPicker" class="map-sidebar__campaign">
        <span class="map-sidebar__campaign-lbl">Кампания</span>
        <select
          class="map-sidebar__campaign-select"
          :value="campaignId ?? ''"
          @change="onCampaignSelect"
        >
          <option v-for="c in campaigns" :key="c.id" :value="c.id">{{ c.title }}</option>
        </select>
      </label>
      <nav class="map-sidebar__tabs" aria-label="Разделы">
        <template v-for="t in tabs" :key="t.id">
          <span v-if="t.wip" class="map-sidebar__tab-wip">
            <button
              type="button"
              class="map-sidebar__tab"
              :aria-describedby="`sidebar-tab-wip-${t.id}`"
              disabled
            >
              {{ t.label }}
            </button>
            <span :id="`sidebar-tab-wip-${t.id}`" class="map-sidebar__tooltip" role="tooltip">
              Функция в разработке
            </span>
          </span>
          <button
            v-else
            type="button"
            class="map-sidebar__tab"
            :class="{ 'map-sidebar__tab--active': activeTab === t.id }"
            @click="setTab(t.id)"
          >
            {{ t.label }}
          </button>
        </template>
      </nav>
    </header>

    <div
      class="map-sidebar__body"
      :class="{
        'map-sidebar__body--characters':
          activeTab === 'characters' || activeTab === 'locations' || activeTab === 'quests',
      }"
    >
      <CampaignLocationsSection
        v-if="activeTab === 'locations'"
        v-model:location-list="locationList"
        v-model:location-sheets="locationSheets"
        :active-map-canvas-id="activeMapCanvasId"
        :fallback-image-url="locationImageUrl"
        :loading="locationsLoading"
        @open-location-map="emit('open-location-map', $event)"
      />

      <CampaignCharactersSection
        v-else-if="activeTab === 'characters'"
        :campaign-fullscreen="campaignFullscreen"
      />
      <CampaignQuestsSection
        v-else-if="activeTab === 'quests'"
        :location-list="locationList"
        :location-sheets="locationSheets"
        @open-location="emit('open-location', $event)"
      />
      <template v-else>
        <p class="map-sidebar__placeholder">Раздел «Сессии» — скоро.</p>
      </template>
    </div>
  </aside>
</template>

<style scoped>
.map-sidebar {
  --sidebar-bg: #141414;
  --sidebar-head: #1e1e1e;
  --sidebar-text: #fafafa;
  --sidebar-muted: #a3a3a3;
  --sidebar-accent: #f97316;
  --sidebar-link: #60a5fa;
  --sidebar-tag-char: #389e0d;
  --sidebar-tag-char-bg: #f6ffed;
  --sidebar-tag-quest: #2f54eb;
  --sidebar-tag-quest-bg: #f0f5ff;
  --sidebar-tag-more: #737373;
  --sidebar-tag-more-bg: rgba(115, 115, 115, 0.25);

  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  min-width: 0;
  background: var(--sidebar-bg);
  color: var(--sidebar-text);
  box-shadow: -12px 0 40px rgba(0, 0, 0, 0.45);
  z-index: 900;
}

.map-sidebar__head {
  position: relative;
  flex-shrink: 0;
  padding: 14px 20px 0;
  background: var(--sidebar-head);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  overflow: visible;
  z-index: 5;
}

.map-sidebar__campaign {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 10px;
  padding-right: 8px;
}

.map-sidebar__campaign-lbl {
  font-size: 0.6875rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--sidebar-muted);
}

.map-sidebar__campaign-select {
  width: 100%;
  max-width: 100%;
  padding: 6px 8px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(0, 0, 0, 0.25);
  color: var(--sidebar-text);
  font-size: 0.875rem;
}

.map-sidebar__tabs {
  display: flex;
  align-items: flex-end;
  gap: 22px;
  overflow: visible;
}

.map-sidebar__tab {
  appearance: none;
  border: none;
  background: none;
  padding: 10px 0 14px;
  font-size: 14px;
  font-weight: 500;
  color: var(--sidebar-muted);
  cursor: pointer;
  white-space: nowrap;
  position: relative;
  transition: color 0.15s;
}
.map-sidebar__tab:hover {
  color: rgba(255, 255, 255, 0.85);
}
.map-sidebar__tab--active {
  color: #fff;
}
.map-sidebar__tab--active::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 3px;
  background: var(--sidebar-accent);
  border-radius: 2px 2px 0 0;
}

.map-sidebar__tab-wip {
  position: relative;
  display: inline-flex;
}

.map-sidebar__tab-wip .map-sidebar__tab:disabled {
  pointer-events: none;
}

.map-sidebar__tab-wip:hover {
  cursor: not-allowed;
}

.map-sidebar__tooltip {
  position: absolute;
  top: calc(100% + 8px);
  left: 50%;
  z-index: 20;
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
  transform: translate(-50%, -4px);
  transition:
    opacity 0.15s ease,
    transform 0.15s ease,
    visibility 0.15s;
}

.map-sidebar__tab-wip:hover .map-sidebar__tooltip,
.map-sidebar__tab-wip:focus-within .map-sidebar__tooltip {
  opacity: 1;
  visibility: visible;
  transform: translate(-50%, 0);
}

.map-sidebar__body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 20px 24px 32px;
  -webkit-overflow-scrolling: touch;
}

.map-sidebar__body--characters {
  padding: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.map-sidebar__placeholder {
  margin: 24px 0 0;
  color: var(--sidebar-muted);
  font-size: 15px;
  line-height: 1.5;
}
</style>
