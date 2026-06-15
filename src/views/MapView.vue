<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, provide, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

import mapImageUrl from '@/assets/maps/map.jpg'
import IconMenu from '@/components/icons/IconMenu.vue'
import chatIconUrl from '@/assets/icons/chat.svg'
import layoutIconUrl from '@/assets/icons/layout.svg'
import castleIconUrl from '@/assets/icons/castle.svg'
import arrowUpIconUrl from '@/assets/icons/arrow-up.svg'
import newMarkIconUrl from '@/assets/icons/new-mark.svg'
import writeDownIconUrl from '@/assets/icons/write-down.svg'
import MapSidebarPanel, { type SidebarTab } from '@/components/MapSidebarPanel.vue'
import { campaignLocationsMapBridgeKey } from '@/shared/lib/campaignLocationsMapBridge'
import { needsCampaignBootstrap, runCampaignBootstrap } from '@/shared/lib/campaignBootstrap'
import { logoutAndResetSession } from '@/shared/lib/resetCampaignSession'
import AppToast from '@/shared/ui/AppToast.vue'
import CampaignInitOverlay from '@/shared/ui/CampaignInitOverlay.vue'
import {
  createCampaignLocationsBootstrap,
  DEFAULT_LOCATION_CARD_IMAGE_URL,
  MAIN_CAMPAIGN_MAP_CANVAS_ID,
  type CampaignLocationListItem,
  type LocationSheet,
} from '@/types/location-campaign'
import { createLocation, listLocations } from '@/shared/api'
import {
  latLngToApiCoords,
  locationResponseToListItem,
  locationResponseToSheet,
  locationsListToCampaignState,
} from '@/shared/lib/locationMappers'
import {
  applyLocationHierarchyRecord,
  patchLocationHierarchyEntry,
  readLocationHierarchyRecord,
} from '@/shared/lib/locationHierarchyStorage'
import { useActiveCampaignStore } from '@/stores/activeCampaign'
import { useCampaignCharactersStore } from '@/stores/campaignCharacters'
import { useCampaignQuestsStore } from '@/stores/campaignQuests'

const router = useRouter()
const activeCampaignStore = useActiveCampaignStore()
const { campaignId: activeCampaignId } = storeToRefs(activeCampaignStore)
const campaignCharactersStore = useCampaignCharactersStore()
const campaignQuestsStore = useCampaignQuestsStore()
const mapContainer = ref<HTMLElement | null>(null)
let map: L.Map | null = null
let imageOverlayLayer: L.ImageOverlay | null = null
/** Зум, при котором весь растр влезает в вид (опорный для % и для `computeCappedMaxZoom`). Считается при временно поднятом `maxZoom`. */
let mapFitZoom = 0
let mapBounds: L.LatLngBounds | null = null

const zoomPercent = ref(100)
const markers: L.Marker[] = []
let markerGradientId = 0
/** Метка, увеличенная при открытой панели после клика по пину */
let sidebarEnlargedMarker: L.Marker | null = null

const isAddMarkerMode = ref(false)

const isSidebarDocked = ref(false)
const isSidebarFullscreen = ref(false)
const sidebarTab = ref<SidebarTab>('locations')
/** Просмотр карты локации: после «Открыть карту» показываем крошки и заменяем растр Leaflet */
const locationMapBreadcrumb = ref<{ title: string } | null>(null)
/** Привязка пинов и списка локаций к текущему растру: главная карта кампании или id родительской локации */
const mapCanvasAttachmentId = ref<string>(MAIN_CAMPAIGN_MAP_CANVAS_ID)
const pendingDetailLocationId = ref<string | null>(null)
const pendingDetailCharacterId = ref<string | null>(null)
const pendingDetailQuestId = ref<string | null>(null)
const isCampaignBootstrapping = ref(false)
const isMapRasterLoading = ref(true)
let mapRasterLoadCount = 0
const locationsLoading = ref(false)
const locationsLoadedFromApi = ref(false)
const initToast = ref<{ message: string; variant: 'success' | 'error' } | null>(null)

function dockSidebarForEntityNavigation(): void {
  if (!isSidebarDocked.value && !isSidebarFullscreen.value) {
    isSidebarDocked.value = true
  }
}

function onOpenLocationFromSidebar(locationId: string) {
  sidebarTab.value = 'locations'
  dockSidebarForEntityNavigation()
  void nextTick(() => {
    pendingDetailLocationId.value = locationId
  })
}

function onOpenCharacterFromSidebar(characterId: string) {
  sidebarTab.value = 'characters'
  dockSidebarForEntityNavigation()
  void nextTick(() => {
    pendingDetailCharacterId.value = characterId
  })
}

function onOpenQuestFromSidebar(questId: string) {
  sidebarTab.value = 'quests'
  dockSidebarForEntityNavigation()
  void nextTick(() => {
    pendingDetailQuestId.value = questId
  })
}

provide(campaignLocationsMapBridgeKey, {
  pendingDetailLocationId,
  pendingDetailCharacterId,
  pendingDetailQuestId,
  openLocation: onOpenLocationFromSidebar,
  openCharacter: onOpenCharacterFromSidebar,
  openQuest: onOpenQuestFromSidebar,
  removeLocationPin: () => {
    restorePinsFromLocationSheets()
  },
})

const campaignLocationsBootstrap = createCampaignLocationsBootstrap()
const campaignLocationList = ref<CampaignLocationListItem[]>(campaignLocationsBootstrap.list)
const campaignLocationSheets = ref<Record<string, LocationSheet>>(campaignLocationsBootstrap.sheets)

const MAP_PINS_LOG = '[map-pins]'

function mapPinsLog(message: string, detail?: Record<string, unknown>): void {
  if (detail !== undefined) {
    console.info(MAP_PINS_LOG, message, detail)
  } else {
    console.info(MAP_PINS_LOG, message)
  }
}

/** Док-панель справа: ширина перетаскиванием за левый край, пиксели. */
const DOCKED_SIDEBAR_MIN = 600
const DOCKED_SIDEBAR_MAX = 1200

function clampDockedSidebarWidth(w: number): number {
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1920
  const cap = Math.max(200, vw - 32)
  const lo = Math.min(DOCKED_SIDEBAR_MIN, cap)
  const hi = Math.min(DOCKED_SIDEBAR_MAX, cap)
  return Math.min(hi, Math.max(lo, Math.round(w)))
}

function initialDockedSidebarWidth(): number {
  if (typeof window === 'undefined') return 720
  return clampDockedSidebarWidth(Math.min(window.innerWidth * 0.44, 900))
}

const dockedSidebarWidthPx = ref(initialDockedSidebarWidth())

const mapViewCssVars = computed(() => ({
  '--map-docked-sidebar-w': `${clampDockedSidebarWidth(dockedSidebarWidthPx.value)}px`,
}))

let dockResizeActive = false
let dockResizeStartX = 0
let dockResizeStartW = 0

function onDockResizeMove(e: MouseEvent) {
  if (!dockResizeActive) return
  const dx = dockResizeStartX - e.clientX
  dockedSidebarWidthPx.value = clampDockedSidebarWidth(dockResizeStartW + dx)
  map?.invalidateSize()
}

function onDockResizeEnd() {
  window.removeEventListener('mousemove', onDockResizeMove)
  window.removeEventListener('mouseup', onDockResizeEnd)
  document.body.style.removeProperty('cursor')
  document.body.style.removeProperty('user-select')
  dockResizeActive = false
  invalidateMapLayout()
}

function onDockResizeStart(e: MouseEvent) {
  if (!isSidebarDocked.value || isSidebarFullscreen.value) return
  e.preventDefault()
  dockResizeActive = true
  dockResizeStartX = e.clientX
  dockResizeStartW = dockedSidebarWidthPx.value
  window.addEventListener('mousemove', onDockResizeMove)
  window.addEventListener('mouseup', onDockResizeEnd)
  document.body.style.cursor = 'ew-resize'
  document.body.style.userSelect = 'none'
}

function onWindowResizeMapAndSidebar() {
  dockedSidebarWidthPx.value = clampDockedSidebarWidth(dockedSidebarWidthPx.value)
  applyMinZoom()
}

/** Теоретический верх зума (как при `maxZoom: 6`). Фактический максимум ниже — см. `computeCappedMaxZoom`. */
const MAP_ZOOM_CEILING = 6
/**
 * Технический нижний предел для расчётов (`CRS.Simple`, scale = 2^zoom).
 * В рантайме фактический `minZoom` карты выставляется равным `mapFitZoom`,
 * чтобы при минимальном зуме растр был виден ЦЕЛИКОМ.
 */
const MAP_ZOOM_PROBE_FLOOR = -10

function readMapImageSize(url: string): Promise<{ mw: number; mh: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const mw = img.naturalWidth || 1
      const mh = img.naturalHeight || 1
      resolve({ mw, mh })
    }
    img.onerror = () => reject(new Error('Не удалось загрузить изображение карты'))
    img.src = url
  })
}

function waitForLeafletImageOverlay(layer: L.ImageOverlay): Promise<void> {
  return new Promise((resolve) => {
    const el = layer.getElement() as HTMLImageElement | null
    if (!el) {
      resolve()
      return
    }
    if (el.complete && el.naturalWidth > 0) {
      resolve()
      return
    }
    const done = () => resolve()
    el.addEventListener('load', done, { once: true })
    el.addEventListener('error', done, { once: true })
  })
}

async function withMapRasterLoading<T>(fn: () => Promise<T>): Promise<T> {
  mapRasterLoadCount += 1
  isMapRasterLoading.value = true
  try {
    return await fn()
  } finally {
    mapRasterLoadCount = Math.max(0, mapRasterLoadCount - 1)
    if (mapRasterLoadCount === 0) {
      isMapRasterLoading.value = false
    }
  }
}

function computeCappedMaxZoom(fitZoom: number): number {
  const halfToCeiling = Math.max(
    fitZoom,
    Math.round(fitZoom + (MAP_ZOOM_CEILING - fitZoom) * 0.5)
  )
  /** Максимум — уровень, который на прежней шкале [fit → halfToCeiling] был «50%»; в UI это теперь 100%. */
  return Math.max(
    fitZoom,
    Math.round(fitZoom + (halfToCeiling - fitZoom) * 0.5)
  )
}

function applyMinZoom() {
  if (!map || !mapBounds) return
  map.invalidateSize()
  /** Расширяем диапазон перед расчётом, иначе `getBoundsZoom` упирается в текущие границы. */
  map.setMinZoom(MAP_ZOOM_PROBE_FLOOR)
  map.setMaxZoom(24)
  /**
   * `inside = true` → возвращает минимальный зум, при котором КАРТА ПОКРЫВАЕТ окно (без тёмных полей).
   * `inside = false` показывал бы всю карту «вписанную в окно» и оставлял рамки по короткой стороне.
   */
  const rawFit = map.getBoundsZoom(mapBounds, true)
  mapFitZoom = Number.isFinite(rawFit) ? rawFit : 0
  const cappedMax = computeCappedMaxZoom(mapFitZoom)
  /** Минимум = `mapFitZoom` — отдалять дальше нельзя, иначе появятся пустые поля по бокам. */
  map.setMinZoom(mapFitZoom)
  map.setMaxZoom(cappedMax)
  const z = map.getZoom()
  if (z > cappedMax) map.setZoom(cappedMax)
  if (z < mapFitZoom) map.setZoom(mapFitZoom)
  updateZoomPercent()
}

/** Полный охват текущего растра: центр и минимальный зум (как после первой загрузки). */
function snapMapToDefaultExtent() {
  if (!map || !mapBounds) return
  map.invalidateSize()
  applyMinZoom()
  map.setView(mapBounds.getCenter(), mapFitZoom, { animate: false })
  updateZoomPercent()
}

function enforceZoomBounds() {
  if (!map) return
  const min = map.getMinZoom()
  const max = map.getMaxZoom()
  const z = map.getZoom()
  if (z < min) map.setZoom(min)
  else if (z > max) map.setZoom(max)
  updateZoomPercent()
}

function updateZoomPercent() {
  if (!map || !mapBounds) return
  const max = map.getMaxZoom()
  const z = map.getZoom()
  if (max <= mapFitZoom) {
    zoomPercent.value = 100
    return
  }
  const t = (z - mapFitZoom) / (max - mapFitZoom)
  zoomPercent.value = Math.round(Math.max(0, Math.min(1, t)) * 100)
}

function zoomIn() {
  map?.zoomIn()
}
function zoomOut() {
  map?.zoomOut()
}

function toggleAddMarkerMode() {
  isAddMarkerMode.value = !isAddMarkerMode.value
  if (!isAddMarkerMode.value) map?.closePopup()
}

function invalidateMapLayout() {
  nextTick(() => {
    map?.invalidateSize()
    applyMinZoom()
  })
}

function clearMarkersForImagerySwap() {
  clearAllMapPins()
}

function clearAllMapPins() {
  if (!map) return
  map.closePopup()
  clearMarkerSidebarEnlarged()
  markers.forEach((m) => m.remove())
  markers.length = 0
}

/** Пины из реестра локаций для текущего холста */
function syncMapPinsFromCampaignSheets() {
  if (!map) {
    mapPinsLog('syncMapPins: пропуск — карта не инициализирована')
    return
  }
  clearAllMapPins()
  const canvas = mapCanvasAttachmentId.value
  let added = 0
  const skipped: Array<{ id: string; reason: string }> = []
  for (const sheet of Object.values(campaignLocationSheets.value)) {
    if (!sheet.pinLatLng) {
      skipped.push({ id: sheet.id, reason: 'нет pinLatLng' })
      continue
    }
    if (sheet.mapCanvasId !== canvas) {
      skipped.push({
        id: sheet.id,
        reason: `mapCanvasId=${sheet.mapCanvasId}, ожидался ${canvas}`,
      })
      continue
    }
    addOrRestoreLocationPin(L.latLng(sheet.pinLatLng.lat, sheet.pinLatLng.lng), sheet.displayTitle, sheet.id, false)
    added++
  }
  mapPinsLog('syncMapPins: готово', { canvas, added, skipped: skipped.length, skippedSample: skipped.slice(0, 8) })
}

async function setMapRasterImageUrl(url: string): Promise<boolean> {
  if (!map) return false
  return withMapRasterLoading(async () => {
    try {
      const { mw, mh } = await readMapImageSize(url)
      if (!map) return false
      const bounds = L.latLngBounds(L.latLng(0, 0), L.latLng(mh, mw))
      clearMarkersForImagerySwap()
      if (imageOverlayLayer) {
        map.removeLayer(imageOverlayLayer)
        imageOverlayLayer = null
      }
      imageOverlayLayer = L.imageOverlay(url, bounds).addTo(map)
      await waitForLeafletImageOverlay(imageOverlayLayer)
      mapBounds = bounds
      map.setMaxBounds(bounds)
      snapMapToDefaultExtent()
      syncMapPinsFromCampaignSheets()
      return true
    } catch {
      return false
    }
  })
}

async function restoreMainCampaignMapCanvas() {
  if (!locationMapBreadcrumb.value) return
  const canvasBeforeRestore = mapCanvasAttachmentId.value
  mapCanvasAttachmentId.value = MAIN_CAMPAIGN_MAP_CANVAS_ID
  const ok = await setMapRasterImageUrl(mapImageUrl)
  if (!ok) {
    mapCanvasAttachmentId.value = canvasBeforeRestore
    return
  }
  locationMapBreadcrumb.value = null
  /** Крошки исчезают — один кадр позже пересчитываем размер и отдаляем на «весь лист». */
  await nextTick()
  requestAnimationFrame(() => {
    snapMapToDefaultExtent()
    syncMapPinsFromCampaignSheets()
  })
}

function onOpenLocationMapCanvas(payload: { imageUrl: string; title: string; locationId: string }) {
  const canvasBefore = mapCanvasAttachmentId.value
  mapCanvasAttachmentId.value = payload.locationId
  mapPinsLog('openLocationMap: смена холста', {
    locationId: payload.locationId,
    title: payload.title,
    canvasBefore,
    imageUrlPrefix: payload.imageUrl.slice(0, 80),
  })
  void (async () => {
    const ok = await setMapRasterImageUrl(payload.imageUrl)
    if (!ok) {
      mapCanvasAttachmentId.value = canvasBefore
      return
    }
    locationMapBreadcrumb.value = { title: payload.title }
  })()
}

/** После окончания CSS-transition панели: не дергать Leaflet в первый кадр анимации (рывок при первом открытии). */
function afterSidebarPanelTransition() {
  nextTick(() => {
    map?.invalidateSize()
    requestAnimationFrame(() => applyMinZoom())
  })
}

function onSidebarBeforeEnter(el: Element) {
  void (el as HTMLElement).offsetHeight
}

function closeCampaignPanel() {
  isSidebarDocked.value = false
  isSidebarFullscreen.value = false
  invalidateMapLayout()
}

function toggleFullscreenCampaignMenu() {
  if (isSidebarFullscreen.value) {
    isSidebarFullscreen.value = false
  } else {
    isSidebarDocked.value = false
    isSidebarFullscreen.value = true
  }
  invalidateMapLayout()
}

function toggleDockedSidebar() {
  if (isSidebarDocked.value) {
    isSidebarDocked.value = false
  } else {
    isSidebarFullscreen.value = false
    isSidebarDocked.value = true
  }
  invalidateMapLayout()
}

function openSidebarToLocations() {
  sidebarTab.value = 'locations'
  isSidebarFullscreen.value = false
  isSidebarDocked.value = true
  invalidateMapLayout()
}

function handleLogout() {
  logoutAndResetSession()
  closeCampaignPanel()
  router.push({ name: 'login' })
}

function handleGlobalKeyDown(e: KeyboardEvent) {
  if (e.key !== 'Escape') return
  if (isSidebarFullscreen.value) {
    isSidebarFullscreen.value = false
    invalidateMapLayout()
  }
}

function createMarkerFormContent(latlng: L.LatLng): HTMLElement {
  const bar = document.createElement('div')
  bar.className = 'marker-form-bar'
  bar.innerHTML = `
    <span class="marker-form-icon-wrap" aria-hidden="true">
      <img src="${castleIconUrl}" alt="" class="marker-form-icon" />
    </span>
    <input type="text" class="marker-form-input" placeholder="Название локации" autocomplete="off" />
    <button type="button" class="marker-form-submit" aria-label="Добавить метку">
      <img src="${arrowUpIconUrl}" alt="" class="marker-form-submit-icon" />
    </button>
  `
  const input = bar.querySelector('.marker-form-input') as HTMLInputElement
  const submitBtn = bar.querySelector('.marker-form-submit') as HTMLButtonElement

  const submit = () => {
    const name = (input?.value?.trim() || 'Локация').slice(0, 100)
    void createCampaignLocationFromMapPin(latlng, name)
    map?.closePopup()
  }

  submitBtn?.addEventListener('click', submit)
  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submit()
  })
  setTimeout(() => input?.focus(), 50)
  return bar
}

function clearLocationMarkers() {
  markers.forEach((m) => m.remove())
  markers.length = 0
  clearMarkerSidebarEnlarged()
}

function restorePinsFromLocationSheets() {
  if (!map) {
    mapPinsLog('restorePins: пропуск — карта не инициализирована')
    return
  }
  if (mapCanvasAttachmentId.value !== MAIN_CAMPAIGN_MAP_CANVAS_ID) {
    mapPinsLog('restorePins: пропуск — не главный холст', {
      mapCanvasAttachmentId: mapCanvasAttachmentId.value,
      expected: MAIN_CAMPAIGN_MAP_CANVAS_ID,
    })
    return
  }
  clearLocationMarkers()
  let added = 0
  const skipped: Array<{ id: string; title: string; reason: string }> = []
  for (const sheet of Object.values(campaignLocationSheets.value)) {
    if (sheet.mapCanvasId !== MAIN_CAMPAIGN_MAP_CANVAS_ID) {
      skipped.push({ id: sheet.id, title: sheet.displayTitle, reason: `mapCanvasId=${sheet.mapCanvasId}` })
      continue
    }
    if (!sheet.pinLatLng) {
      skipped.push({ id: sheet.id, title: sheet.displayTitle, reason: 'нет pinLatLng' })
      continue
    }
    addOrRestoreLocationPin(
      L.latLng(sheet.pinLatLng.lat, sheet.pinLatLng.lng),
      sheet.displayTitle,
      sheet.id,
      false
    )
    added++
  }
  mapPinsLog('restorePins: готово', {
    sheetsTotal: Object.keys(campaignLocationSheets.value).length,
    added,
    leafletMarkers: markers.length,
    skippedSample: skipped.slice(0, 12),
  })
}

const LOCAL_LOCATION_ID_PREFIX = 'map-loc-'

function isLocalOnlyLocationId(id: string): boolean {
  return id.startsWith(LOCAL_LOCATION_ID_PREFIX)
}

/** Локальные метки (не сохранённые на бэке) — не затираем при sync с API. */
function collectLocalOnlyLocations(
  list: CampaignLocationListItem[],
  sheets: Record<string, LocationSheet>
): { list: CampaignLocationListItem[]; sheets: Record<string, LocationSheet> } {
  const localList = list.filter((item) => isLocalOnlyLocationId(item.id))
  const localSheets: Record<string, LocationSheet> = {}
  for (const item of localList) {
    const sheet = sheets[item.id]
    if (sheet) localSheets[item.id] = sheet
  }
  return { list: localList, sheets: localSheets }
}

function persistLocalLocationPin(latlng: L.LatLng, displayTitle: string): string {
  const canvas = mapCanvasAttachmentId.value
  const id = `${LOCAL_LOCATION_ID_PREFIX}${Date.now()}`
  const sheet: LocationSheet = {
    id,
    displayTitle,
    quests: [],
    description: '',
    imageUrl: DEFAULT_LOCATION_CARD_IMAGE_URL,
    mapCanvasId: canvas,
    pinLatLng: { lat: latlng.lat, lng: latlng.lng },
    detailRelatedLocations: [],
    detailRelatedQuests: [],
    detailRelatedCharacters: [],
  }
  campaignLocationSheets.value = { ...campaignLocationSheets.value, [id]: sheet }
  campaignLocationList.value = [...campaignLocationList.value, { id, listName: displayTitle }]
  addOrRestoreLocationPin(latlng, displayTitle, id, true)
  return id
}

async function loadCampaignDataFromApi() {
  await loadCampaignLocationsFromApi()
  await campaignCharactersStore.loadFromApi()
  await campaignQuestsStore.loadFromApi()
}

/** @returns true, если выполнялась первичная инициализация пустой кампании */
async function bootstrapCampaignIfNeeded(): Promise<boolean> {
  initToast.value = null
  const shouldBootstrap = await needsCampaignBootstrap()
  if (!shouldBootstrap) return false

  isCampaignBootstrapping.value = true
  try {
    const result = await runCampaignBootstrap()
    if (result.ran && result.success) {
      initToast.value = {
        message: 'Кампания готова: созданы демо-локации, персонажи и квесты',
        variant: 'success',
      }
    } else if (result.ran) {
      initToast.value = {
        message: result.error ?? 'Не удалось подготовить демо-кампанию',
        variant: 'error',
      }
    }
    return result.ran
  } finally {
    isCampaignBootstrapping.value = false
  }
}

async function loadCampaignLocationsFromApi() {
  mapPinsLog('loadLocations: старт')
  const campaignId = await activeCampaignStore.ensureCampaignId()
  if (!campaignId) {
    mapPinsLog('loadLocations: пропуск — нет campaignId', {
      resolveError: activeCampaignStore.resolveError,
      storedCampaignId: activeCampaignId.value,
      campaignsInStore: activeCampaignStore.campaigns.length,
      campaignIds: activeCampaignStore.campaigns.map((c) => c.id),
    })
    return
  }
  const isInitialLoad = !locationsLoadedFromApi.value
  if (isInitialLoad) {
    locationsLoading.value = true
  }
  mapPinsLog('loadLocations: campaignId', { campaignId })
  try {
    const { locations } = await listLocations(campaignId)
    mapPinsLog('loadLocations: ответ API', {
      count: locations?.length ?? 0,
      locations: (locations ?? []).map((loc) => ({
        id: loc.id,
        title: loc.title,
        x: loc.x,
        y: loc.y,
      })),
    })
    const hierarchyRecord = readLocationHierarchyRecord(campaignId)
    const { list, sheets } = locationsListToCampaignState(locations)
    const mergedApiSheets = applyLocationHierarchyRecord(
      sheets,
      hierarchyRecord,
      campaignLocationSheets.value
    )
    const localOnly = collectLocalOnlyLocations(campaignLocationList.value, campaignLocationSheets.value)
    mapPinsLog('loadLocations: маппинг в state', {
      apiList: list.length,
      apiSheets: Object.keys(mergedApiSheets).length,
      localOnly: localOnly.list.length,
      sheetsWithPin: Object.values(mergedApiSheets).filter((s) => s.pinLatLng).length,
    })
    campaignLocationList.value = [...list, ...localOnly.list]
    campaignLocationSheets.value = { ...mergedApiSheets, ...localOnly.sheets }
    restorePinsFromLocationSheets()
    locationsLoadedFromApi.value = true
  } catch (e) {
    mapPinsLog('loadLocations: ошибка', {
      message: e instanceof Error ? e.message : String(e),
      name: e instanceof Error ? e.name : undefined,
    })
    console.error(MAP_PINS_LOG, e)
    /* демо-данные остаются, если API недоступен */
  } finally {
    if (isInitialLoad) {
      locationsLoading.value = false
    }
  }
}

async function createCampaignLocationFromMapPin(latlng: L.LatLng, rawName: string) {
  const displayTitle = (rawName?.trim() || 'Локация').slice(0, 100)
  const canvas = mapCanvasAttachmentId.value

  try {
    const campaignId = await activeCampaignStore.ensureCampaignId()
    if (campaignId) {
      const { x, y } = latLngToApiCoords(latlng.lat, latlng.lng)
      const created = await createLocation(campaignId, { title: displayTitle, x, y })
      const sheet = locationResponseToSheet(created, canvas)
      patchLocationHierarchyEntry(campaignId, created.id, { mapCanvasId: canvas })
      campaignLocationSheets.value = { ...campaignLocationSheets.value, [created.id]: sheet }
      campaignLocationList.value = [
        ...campaignLocationList.value,
        locationResponseToListItem(created),
      ]
      addOrRestoreLocationPin(latlng, displayTitle, created.id, true)
      return
    }
  } catch {
    /* бэк недоступен или ошибка — локальная метка ниже */
  }

  const id = persistLocalLocationPin(latlng, displayTitle)
  const campaignId = activeCampaignStore.campaignId
  if (campaignId) {
    patchLocationHierarchyEntry(campaignId, id, { mapCanvasId: mapCanvasAttachmentId.value })
  }
}

function clearNewMarkerHighlight(m: L.Marker) {
  m.getElement()?.classList.remove('marker-form-marker-icon--new')
}

function clearMarkerSidebarEnlarged() {
  sidebarEnlargedMarker?.getElement()?.classList.remove('marker-form-marker-icon--sidebar-active')
  sidebarEnlargedMarker = null
}

function setMarkerSidebarEnlarged(m: L.Marker) {
  clearMarkerSidebarEnlarged()
  sidebarEnlargedMarker = m
  m.getElement()?.classList.add('marker-form-marker-icon--sidebar-active')
}

function addOrRestoreLocationPin(latlng: L.LatLng, tooltipTitle: string, locationId: string, accentNew: boolean) {
  if (!map) return
  const gradId = `marker-teardrop-${++markerGradientId}`
  const newCls = accentNew ? ' marker-form-marker-icon--new' : ''
  const icon = L.divIcon({
    className: 'marker-form-marker-icon' + newCls,
    html: `
      <span class="marker-form-marker-icon__teardrop">
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="44" viewBox="0 0 32 44">
          <defs>
            <linearGradient id="${gradId}" x1="16" y1="0" x2="16" y2="44" gradientUnits="userSpaceOnUse">
              <stop stop-color="#f97316"/>
              <stop offset="1" stop-color="#c2410c"/>
            </linearGradient>
          </defs>
          <path fill="url(#${gradId})" d="M16 0C7.16 0 0 7.16 0 16c0 12 16 28 16 28s16-16 16-28C32 7.16 24.84 0 16 0z"/>
        </svg>
        <img src="${castleIconUrl}" alt="" class="marker-form-marker-icon__inner" />
      </span>
    `,
    iconSize: [32, 44],
    iconAnchor: [16, 44],
  })
  const marker = L.marker(latlng, { icon }).addTo(map)
  marker.bindTooltip(tooltipTitle, { permanent: false, direction: 'top', offset: [0, -48], className: 'marker-form-tooltip' })
  marker.on('click', () => {
    clearNewMarkerHighlight(marker)
    setMarkerSidebarEnlarged(marker)
    openSidebarToLocations()
    void nextTick(() => {
      pendingDetailLocationId.value = locationId
    })
  })
  markers.push(marker)
}

function openMarkerForm(e: L.LeafletMouseEvent) {
  if (!map) return
  const pane = map.getPane('popupPane')
  if (pane) pane.style.zIndex = '2000'
  const content = createMarkerFormContent(e.latlng)
  const popup = L.popup({ className: 'marker-form-popup', closeButton: false })
    .setLatLng(e.latlng)
    .setContent(content)
  popup.openOn(map)
}

function onMapZoomEnd() {
  enforceZoomBounds()
}

onMounted(() => {
  if (!mapContainer.value) return

  void withMapRasterLoading(async () => {
    let mw: number
    let mh: number
    try {
      ;({ mw, mh } = await readMapImageSize(mapImageUrl))
    } catch {
      return
    }
    if (!mapContainer.value) {
      return
    }

    const bounds = L.latLngBounds(L.latLng(0, 0), L.latLng(mh, mw))
    mapBounds = bounds

    /** Пока не выставлены min/max зум и центр, Leaflet кратко рисует «левый» кадр (поля по краям) — не показываем. */
    mapContainer.value.classList.add('map-container--initializing')

    map = L.map(mapContainer.value, {
      crs: L.CRS.Simple,
      /** Стартовые пределы широкие; `applyMinZoom` посчитает реальный `mapFitZoom` и сузит диапазон. */
      minZoom: MAP_ZOOM_PROBE_FLOOR,
      maxZoom: 24,
      /**
       * Зум колесом / трекпадом ближе к Google Maps: больше пикселей прокрутки на один шаг зума
       * (у Leaflet по умолчанию 60; раньше здесь было 30 — слишком резко).
       * Кнопки +/− по-прежнему меняют ровно на `zoomDelta` (1 уровень).
       */
      zoomDelta: 1,
      zoomSnap: 1,
      wheelPxPerZoomLevel: 120,
      wheelDebounceTime: 55,
      zoomControl: false,
    })

    imageOverlayLayer = L.imageOverlay(mapImageUrl, bounds).addTo(map)
    await waitForLeafletImageOverlay(imageOverlayLayer)
    map.attributionControl.setPrefix('')
    map.setMaxBounds(bounds)
    map.fitBounds(bounds)

    await new Promise<void>((resolve) => {
      map!.whenReady(() => {
        map!.invalidateSize()
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            try {
              applyMinZoom()
              /** Центрируем растр в окне на минимальном зуме — без `fitBounds`, чтобы не вернуть тёмные поля. */
              map!.setView(mapBounds!.getCenter(), map!.getMinZoom(), { animate: false })
              updateZoomPercent()
              mapPinsLog('map.whenReady: инициализация и загрузка данных кампании')
              void (async () => {
                await bootstrapCampaignIfNeeded()
                await loadCampaignDataFromApi()
              })()
            } finally {
              mapContainer.value?.classList.remove('map-container--initializing')
            }
            resolve()
          })
        })
      })
    })

    // Клик по карте открывает форму только в режиме постановки метки
    map.on('click', (e) => {
      if (!isAddMarkerMode.value) return
      openMarkerForm(e)
    })
    map.on('dragstart', () => {
      if (mapContainer.value) mapContainer.value.style.cursor = 'grabbing'
    })
    map.on('dragend', () => {
      if (mapContainer.value) mapContainer.value.style.cursor = ''
    })
    map.on('zoomend', onMapZoomEnd)
    map.on('resize', applyMinZoom)
    window.addEventListener('resize', onWindowResizeMapAndSidebar)
    window.addEventListener('keydown', handleGlobalKeyDown)
  })
})

onUnmounted(() => {
  window.removeEventListener('resize', onWindowResizeMapAndSidebar)
  window.removeEventListener('keydown', handleGlobalKeyDown)
  if (map) {
    map.off('click')
    map.off('dragstart')
    map.off('dragend')
    map.off('zoomend', onMapZoomEnd)
    map.off('resize', applyMinZoom)
    clearMarkerSidebarEnlarged()
    markers.forEach((m) => m.remove())
    map.remove()
    map = null
  }
  mapBounds = null
  onDockResizeEnd()
})

watch([isSidebarDocked, isSidebarFullscreen], ([docked, fullscreen]) => {
  if (!docked && !fullscreen) {
    clearMarkerSidebarEnlarged()
  }
})

watch(activeCampaignId, (id, prev) => {
  if (id && id !== prev) {
    locationsLoadedFromApi.value = false
    void loadCampaignDataFromApi()
  }
})

function onActiveCampaignChanged() {
  void loadCampaignDataFromApi()
}

function onOpenLocationFromQuest(locationId: string) {
  onOpenLocationFromSidebar(locationId)
}
</script>

<template>
  <main
    class="map-view"
    :class="{ 'map-view--with-sidebar': isSidebarDocked || isSidebarFullscreen }"
    :style="mapViewCssVars"
  >
    <div class="map-view__map-col">
      <div ref="mapContainer" class="map-container" />
    <div class="map-ui" :class="{ 'map-ui--sidebar-open': isSidebarDocked }">
      <button
        v-if="isSidebarDocked && !isSidebarFullscreen"
        type="button"
        class="map-ui__btn map-ui__btn--circle map-ui__dock-close"
        aria-label="Закрыть панель"
        @click="closeCampaignPanel"
      >
        <span class="map-ui__dock-close-x" aria-hidden="true">×</span>
      </button>
      <!-- Верхний левый угол: полноэкранное меню кампании -->
      <div class="map-ui__tl">
        <button
          type="button"
          class="map-ui__menu-toggle map-ui__menu-toggle--solo"
          aria-label="Меню кампании на весь экран"
          :aria-pressed="isSidebarFullscreen"
          @click="toggleFullscreenCampaignMenu"
        >
          <IconMenu />
        </button>
        <nav v-if="locationMapBreadcrumb" class="map-ui__breadcrumbs" aria-label="Переход между картами">
          <button type="button" class="map-ui__crumb map-ui__crumb--root" @click="restoreMainCampaignMapCanvas">
            Главная карта
          </button>
          <span class="map-ui__crumb-sep" aria-hidden="true">|</span>
          <span class="map-ui__crumb map-ui__crumb--current" :title="locationMapBreadcrumb.title" aria-current="page">{{
            locationMapBreadcrumb.title
          }}</span>
        </nav>
      </div>
      <!-- Верхний правый угол: панель кампании (иконка layout) -->
      <div class="map-ui__tr">
        <button
          type="button"
          class="map-ui__btn map-ui__btn--circle"
          aria-label="Панель кампании"
          :aria-pressed="isSidebarDocked"
          :class="{ 'map-ui__btn--dock-panel-on': isSidebarDocked }"
          @click="toggleDockedSidebar"
        >
          <img :src="layoutIconUrl" alt="" class="map-ui__icon-img" aria-hidden="true" />
        </button>
      </div>
      <!-- Нижний левый: write-down -->
      <div class="map-ui__bl">
        <span class="map-ui__btn-wip">
          <button
            type="button"
            class="map-ui__btn map-ui__btn--circle"
            aria-label="Записать"
            aria-describedby="map-write-wip-tooltip"
            disabled
          >
            <img :src="writeDownIconUrl" alt="" class="map-ui__icon-img" aria-hidden="true" />
          </button>
          <span id="map-write-wip-tooltip" class="map-ui__tooltip" role="tooltip">
            Функция в разработке
          </span>
        </span>
      </div>
      <!-- Нижний правый: зум (таблетка), метка, чат -->
      <div class="map-ui__br">
        <div class="map-ui__zoom-pill">
          <button type="button" class="map-ui__zoom-btn" aria-label="Увеличить" @click="zoomIn">
            <svg class="map-ui__zoom-icon" viewBox="0 0 16 16" aria-hidden="true">
              <rect x="7" y="3" width="2" height="10" rx="0.5" fill="currentColor" />
              <rect x="3" y="7" width="10" height="2" rx="0.5" fill="currentColor" />
            </svg>
          </button>
          <button type="button" class="map-ui__zoom-btn" aria-label="Уменьшить" @click="zoomOut">
            <svg class="map-ui__zoom-icon" viewBox="0 0 16 16" aria-hidden="true">
              <rect x="3" y="7" width="10" height="2" rx="0.5" fill="currentColor" />
            </svg>
          </button>
          
          <span class="map-ui__zoom-value">{{ zoomPercent }}%</span>
        </div>
        <button
          type="button"
          class="map-ui__btn map-ui__btn--circle"
          :class="{ 'map-ui__btn--active': isAddMarkerMode }"
          aria-label="Поставить метку"
          :aria-pressed="isAddMarkerMode"
          @click="toggleAddMarkerMode"
        >
          <img :src="newMarkIconUrl" alt="" class="map-ui__icon-img" aria-hidden="true" />
        </button>
        <span class="map-ui__btn-wip">
          <button
            type="button"
            class="map-ui__btn map-ui__btn--circle"
            aria-label="Чат"
            aria-describedby="map-chat-wip-tooltip"
            disabled
          >
            <img :src="chatIconUrl" alt="" class="map-ui__icon-img" aria-hidden="true" />
          </button>
          <span id="map-chat-wip-tooltip" class="map-ui__tooltip" role="tooltip">
            Функция в разработке
          </span>
        </span>
      </div>
    </div>
    </div>
    <transition
      name="sidebar-slide"
      @before-enter="onSidebarBeforeEnter"
      @after-enter="afterSidebarPanelTransition"
      @after-leave="afterSidebarPanelTransition"
    >
      <div
        v-if="isSidebarDocked || isSidebarFullscreen"
        class="map-view__sidebar-root"
        :class="{ 'map-view__sidebar-root--fullscreen': isSidebarFullscreen }"
      >
        <div
          v-if="isSidebarDocked && !isSidebarFullscreen"
          class="map-view__sidebar-resize"
          role="separator"
          aria-orientation="vertical"
          aria-label="Изменить ширину панели"
          @mousedown="onDockResizeStart"
        />
        <header v-if="isSidebarFullscreen" class="map-view__fullscreen-bar">
          <button
            type="button"
            class="map-ui__menu-toggle map-ui__menu-toggle--solo map-view__fullscreen-close"
            aria-label="Закрыть меню"
            @click="closeCampaignPanel"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M18 6L6 18M6 6l12 12"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
              />
            </svg>
          </button>
          <button type="button" class="map-view__fullscreen-logout" @click="handleLogout">Выйти</button>
        </header>
        <MapSidebarPanel
          v-model:active-tab="sidebarTab"
          v-model:location-list="campaignLocationList"
          v-model:location-sheets="campaignLocationSheets"
          :active-map-canvas-id="mapCanvasAttachmentId"
          class="map-view__sidebar-panel"
          :location-image-url="mapImageUrl"
          :campaign-fullscreen="isSidebarFullscreen"
          :locations-loading="locationsLoading"
          @open-location-map="onOpenLocationMapCanvas"
          @campaign-changed="onActiveCampaignChanged"
          @open-location="onOpenLocationFromQuest"
        />
      </div>
    </transition>
    <CampaignInitOverlay
      v-if="isMapRasterLoading"
      message="Загружаем карту…"
      hint="Подготавливаем изображение кампании"
    />
    <CampaignInitOverlay v-if="isCampaignBootstrapping" />
    <AppToast
      v-if="initToast"
      :message="initToast.message"
      :variant="initToast.variant"
      @close="initToast = null"
    />
  </main>
</template>

<style scoped>
.map-view {
  /* Общий стиль контролов карты (как `.map-ui__menu-toggle--solo`) */
  --map-ui-control-size: 52px;
  --map-ui-control-radius: 999px;
  --map-ui-control-bg: rgba(33, 33, 33, 0.96);
  --map-ui-control-shadow: 0 10px 24px rgba(0, 0, 0, 0.35);
  --map-ui-corner-inset: 12px;
  --map-ui-stack-gap: 8px;
  --map-ui-bg: #212121;
  --map-ui-bg-hover: rgb(75, 85, 99);
  --map-docked-sidebar-w: 720px;
  width: 100%;
  height: 100%;
  min-height: 0;
  position: relative;
}

.map-view--with-sidebar {
  /* панель будет поверх карты — без flex-раскладки */
  pointer-events: auto;
}

.map-view__map-col {
  position: relative;
  height: 100%;
  /* Тот же фон, что у `.map-container`, пока карта скрыта на первом кадре инициализации */
  background: #1a1a2e;
}

.map-view__sidebar-root {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 1001;
  width: var(--map-docked-sidebar-w);
  display: flex;
  flex-direction: column;
  min-width: 0;
  /* полоска ресайза позиционируется от левого края */
  isolation: isolate;
}

.map-view__sidebar-resize {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  z-index: 1090;
  width: 10px;
  margin-left: -5px;
  cursor: ew-resize;
  touch-action: none;
  background: transparent;
}

.map-view__sidebar-resize:hover {
  background: rgba(255, 255, 255, 0.04);
}

.map-view__sidebar-root--fullscreen {
  position: fixed;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  width: 100%;
  max-width: none;
  z-index: 1100;
  background: #141414;
}

.map-view__fullscreen-bar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 16px 10px 12px;
  background: #1e1e1e;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.map-view__fullscreen-close {
  flex-shrink: 0;
}

.map-view__fullscreen-logout {
  appearance: none;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.88);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  padding: 8px 12px;
  border-radius: 8px;
  transition: color 0.15s, background 0.15s;
}

.map-view__fullscreen-logout:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.06);
}

.map-view__sidebar-panel {
  flex: 1;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
}

/* Слева от док-панели, на карте (как изначально) */
.map-ui__dock-close {
  position: absolute;
  top: var(--map-ui-corner-inset);
  right: calc(var(--map-docked-sidebar-w) + var(--map-ui-corner-inset));
  z-index: 1002;
  transition: right 260ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.map-ui__dock-close-x {
  display: block;
  margin-top: -3px;
  font-size: 26px;
  font-weight: 300;
  line-height: 1;
}

.map-ui__dock-close:focus-visible {
  outline: 2px solid rgba(255, 255, 255, 0.45);
  outline-offset: 3px;
}

.map-container {
  width: 100%;
  height: 100%;
  background: #1a1a2e;
  cursor: default;
}

.map-container.map-container--initializing {
  opacity: 0;
  pointer-events: none;
}

.map-container :deep(.leaflet-image-layer img) {
  will-change: transform;
}


.map-ui {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 1000;
}

.map-ui > * {
  pointer-events: auto;
}

.map-ui__tl {
  position: absolute;
  top: var(--map-ui-corner-inset);
  left: var(--map-ui-corner-inset);
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 14px;
  max-width: min(720px, calc(100vw - 200px));
  min-width: 0;
}

.map-ui__breadcrumbs {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  font-size: 15px;
  font-weight: 500;
  line-height: 1.25;
  letter-spacing: 0.01em;
  color: #fff;
  --map-bc-shadow: 0 1px 2px rgba(0, 0, 0, 0.75), 0 2px 12px rgba(0, 0, 0, 0.45);
  text-shadow: var(--map-bc-shadow);
}

.map-ui__crumb--root {
  flex-shrink: 0;
  appearance: none;
  border: none;
  padding: 0;
  margin: 0;
  background: none;
  font: inherit;
  font-weight: 500;
  color: #fff;
  cursor: pointer;
  text-shadow: var(--map-bc-shadow);
  text-decoration: none;
  text-underline-offset: 3px;
  transition: opacity 0.15s, text-decoration-color 0.15s;
}

.map-ui__crumb--root:hover {
  text-decoration: underline;
  text-decoration-color: rgba(255, 255, 255, 0.55);
}

.map-ui__crumb--root:focus-visible {
  outline: 2px solid rgba(255, 255, 255, 0.65);
  outline-offset: 3px;
  border-radius: 4px;
}

.map-ui__crumb-sep {
  flex-shrink: 0;
  opacity: 0.72;
  font-weight: 400;
  user-select: none;
  text-shadow: var(--map-bc-shadow);
}

.map-ui__crumb--current {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #fff;
  font-weight: 500;
}

.map-ui__menu-toggle {
  width: var(--map-ui-control-size);
  height: var(--map-ui-control-size);
  flex: 0 0 var(--map-ui-control-size);
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  cursor: pointer;
  background: transparent;
  color: #fff;
  transition: background 0.2s;
}

.map-ui__menu-toggle:hover {
  background: rgba(255, 255, 255, 0.06);
}

.map-ui__menu-toggle svg {
  stroke: #fff;
  width: 17px;
  height: 17px;
}

.map-ui__menu-toggle--solo {
  border-radius: var(--map-ui-control-radius);
  background: var(--map-ui-control-bg);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  box-shadow: var(--map-ui-control-shadow);
}

.map-ui__menu-toggle--solo[aria-pressed='true'] {
  box-shadow:
    0 0 0 2px rgba(249, 115, 22, 0.55),
    var(--map-ui-control-shadow);
}

.map-ui__menu-toggle--solo:focus-visible {
  outline: 2px solid rgba(255, 255, 255, 0.45);
  outline-offset: 3px;
}

.map-ui__tr {
  position: absolute;
  top: var(--map-ui-corner-inset);
  right: var(--map-ui-corner-inset);
  display: flex;
  gap: var(--map-ui-stack-gap);
  transition: right 260ms cubic-bezier(0.2, 0.8, 0.2, 1);
}
.map-ui--sidebar-open .map-ui__tr {
  right: 68px;
}

.map-ui__bl {
  position: absolute;
  bottom: var(--map-ui-corner-inset);
  left: var(--map-ui-corner-inset);
  display: flex;
  align-items: flex-end;
  gap: var(--map-ui-stack-gap);
}

.map-ui__br {
  position: absolute;
  bottom: var(--map-ui-corner-inset);
  right: var(--map-ui-corner-inset);
  display: flex;
  align-items: center;
  gap: var(--map-ui-stack-gap);
  transition: right 260ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.map-ui--sidebar-open .map-ui__br {
  right: calc(var(--map-docked-sidebar-w) + var(--map-ui-corner-inset));
}

.map-ui__btn {
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  cursor: pointer;
  color: #fff;
  background: var(--map-ui-control-bg);
  border-radius: var(--map-ui-control-radius);
  width: var(--map-ui-control-size);
  height: var(--map-ui-control-size);
  flex: 0 0 var(--map-ui-control-size);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  box-shadow: var(--map-ui-control-shadow);
  transition: background 0.2s;
}
.map-ui__btn svg {
  opacity: 1;
  stroke: #fff;
  width: 17px;
  height: 17px;
}

.map-ui__icon-img {
  width: 21px;
  height: 21px;
  display: block;
}
.map-ui__btn:hover {
  background: var(--map-ui-bg-hover);
}

.map-ui__btn:focus-visible {
  outline: 2px solid rgba(255, 255, 255, 0.45);
  outline-offset: 3px;
}

.map-ui__btn--active {
  background: #f97316;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

.map-ui__btn--active:hover {
  background: #ea580c;
}

.map-ui__btn--dock-panel-on {
  box-shadow:
    0 0 0 2px rgba(249, 115, 22, 0.55),
    var(--map-ui-control-shadow);
}

.map-ui__btn-wip {
  position: relative;
  display: inline-flex;
  flex: 0 0 var(--map-ui-control-size);
}

.map-ui__btn-wip .map-ui__btn:disabled {
  pointer-events: none;
}

.map-ui__btn-wip:hover {
  cursor: not-allowed;
}

.map-ui__bl .map-ui__tooltip {
  left: 0;
  right: auto;
}

.map-ui__tooltip {
  position: absolute;
  bottom: calc(100% + 10px);
  right: 0;
  z-index: 2;
  padding: 8px 12px;
  border-radius: 8px;
  background: var(--map-ui-control-bg);
  box-shadow: var(--map-ui-control-shadow);
  color: #fff;
  font-size: 13px;
  font-weight: 500;
  line-height: 1.3;
  white-space: nowrap;
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transform: translateY(4px);
  transition:
    opacity 0.15s ease,
    transform 0.15s ease,
    visibility 0.15s;
}

.map-ui__btn-wip:hover .map-ui__tooltip,
.map-ui__btn-wip:focus-within .map-ui__tooltip {
  opacity: 1;
  visibility: visible;
  transform: translateY(0);
}

.map-ui__scale {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  background: var(--map-ui-bg);
  border-radius: 8px;
  color: #fff;
  font-size: 12px;
}
.map-ui__scale-arrow { opacity: 0.8; }
.map-ui__scale-text { font-weight: 500; }

.map-ui__compass {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--map-ui-bg);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}
.map-ui__compass-rose {
  position: absolute;
  width: 24px;
  height: 24px;
  inset: 0;
  margin: auto;
  color: rgba(255,255,255,0.7);
}
.map-ui__compass-n {
  position: relative;
  z-index: 1;
  font-size: 14px;
  font-weight: 700;
}

.map-ui__zoom-pill {
  display: flex;
  align-items: center;
  min-height: var(--map-ui-control-size);
  box-sizing: border-box;
  background: var(--map-ui-control-bg);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  box-shadow: var(--map-ui-control-shadow);
  border-radius: var(--map-ui-control-radius);
  padding: 4px 10px 4px 6px;
  color: #fff;
  gap: 2px;
}
.map-ui__zoom-btn {
  width: 44px;
  height: 44px;
  border: none;
  background: transparent;
  color: #fff;
  cursor: pointer;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  transition: background 0.2s;
  opacity: 1;
}

.map-ui__zoom-icon {
  width: 16px;
  height: 16px;
  display: block;
  flex-shrink: 0;
}
.map-ui__zoom-btn:hover {
  background: rgba(255,255,255,0.15);
}

.map-ui__zoom-btn:focus-visible {
  outline: 2px solid rgba(255, 255, 255, 0.45);
  outline-offset: 1px;
}

.map-ui__zoom-value {
  min-width: 48px;
  text-align: center;
  font-size: 13px;
  font-weight: 500;
  opacity: 1;
  padding-right: 2px;
}

/* Попап и форма добавления метки (контент внутри Leaflet) — поднимаем над картой */
:deep(.marker-form-popup) {
  z-index: 2000 !important;
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
}
:deep(.marker-form-popup .leaflet-popup-content-wrapper) {
  padding: 0;
  background: transparent;
  border: none;
  box-shadow: none;
  z-index: 2000;
}
:deep(.marker-form-popup .leaflet-popup-content) {
  margin: 0;
}
:deep(.marker-form-popup .leaflet-popup-tip) {
  display: none;
}

/* Форма как на картинке: тёмно-серая капсула, иконка — инпут — кнопка */
:deep(.marker-form-bar) {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 280px;
  max-width: 380px;
  height: 52px;
  padding: 0 20px 0 24px;
  background: #363636;
  border-radius: 999px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
  box-sizing: border-box;
}
:deep(.marker-form-icon-wrap) {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  flex-shrink: 0;
  padding: 0 2px 0 0;
}
:deep(.marker-form-input) {
  flex: 1;
  min-width: 0;
  background: transparent;
  border: none;
  color: #fff;
  font-size: 14px;
  outline: none;
  text-align: left;
}
:deep(.marker-form-input::placeholder) {
  color: #a3a3a3;
}
:deep(.marker-form-submit) {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #4d4d4d;
  padding: 8px;
  box-sizing: border-box;
  border: none;
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background 0.2s, color 0.2s;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}
:deep(.marker-form-submit:hover) {
  background: #5a5a5a;
  color: #fff;
}

:deep(.marker-form-marker-icon) {
  background: none !important;
  border: none !important;
  pointer-events: auto !important;
}
:deep(.marker-form-marker-icon__teardrop) {
  display: block;
  filter: drop-shadow(0 2px 4px rgba(0,0,0,0.4));
  position: relative;
  pointer-events: auto;
  transform: scale(1);
  transform-origin: 50% 100%;
  transition: transform 0.22s cubic-bezier(0.2, 0.8, 0.2, 1);
}

:deep(.marker-form-marker-icon--sidebar-active .marker-form-marker-icon__teardrop) {
  transform: scale(1.58);
}

:deep(.marker-form-marker-icon--new .marker-form-marker-icon__teardrop) {
  filter:
    drop-shadow(0 0 2px #ffffff)
    drop-shadow(0 0 3px #ffffff)
    drop-shadow(0 0 1px #ffffff)
    drop-shadow(0 2px 4px rgba(0, 0, 0, 0.4));
}

:deep(.marker-form-marker-icon__inner) {
  position: absolute;
  left: 50%;
  top: calc(50% - 3px);
  transform: translate(-50%, -50%);
  width: 16px;
  height: 16px;
  display: block;
  filter: brightness(0) invert(1);
  opacity: 0.95;
  pointer-events: none;
}
:deep(.marker-form-tooltip) {
  background: #363636;
  border: none;
  color: #e5e5e5;
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 6px;
}

::deep(.marker-form-submit-icon) {
  width: 16px;
  height: 16px;
  display: block;
  filter: brightness(0) invert(1);
  opacity: 0.95;
}

::deep(.marker-form-icon) {
  width: 20px;
  height: 20px;
  display: block;
}
</style>

<style>
/* Анимация выезда панели */
.sidebar-slide-enter-active,
.sidebar-slide-leave-active {
  transition: transform 260ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity 200ms ease;
  will-change: transform, opacity;
}

.sidebar-slide-enter-from,
.sidebar-slide-leave-to {
  transform: translateX(100%);
  opacity: 0;
}

.sidebar-slide-enter-to,
.sidebar-slide-leave-from {
  transform: translateX(0);
  opacity: 1;
}
</style>
