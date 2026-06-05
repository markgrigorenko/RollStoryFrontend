import sampleLocationRegionMapUrl from '@/assets/maps/additional-map.png'

/** Региональная карта-иллюстрация по умолчанию для локаций («вторая» карта) */
export const DEFAULT_LOCATION_CARD_IMAGE_URL = sampleLocationRegionMapUrl

/** Общая карта кампании (map.jpg и т.п.) vs регион конкретной локации (id этой локации) */
export const MAIN_CAMPAIGN_MAP_CANVAS_ID = 'campaign-main' as const

/** Элемент связанных списков на деталке локации (макет: список, синие «ссылки», описание курсивом) */
export interface LocationDetailLinkedItem {
  title: string
  description?: string
  /** Если true — стиль интерактивной синей ссылки */
  linked?: boolean
  /** При клике открывается другая локация по id */
  targetLocationId?: string
  /** Связка с записью персонажа кампании (демо/`CampaignCharacterListItem.id`) */
  attachedCharacterId?: string
  /** Связка с квестом кампании (`questId` с бэка) */
  attachedQuestId?: string
}

/** Позиция в списке локаций кампании */
export interface CampaignLocationListItem {
  id: string
  /** Короткое имя в списке */
  listName: string
}

export interface LocationSheet {
  id: string
  displayTitle: string
  /** Подзаголовок в карточке (регион, тип места) */
  listSubtitle?: string
  /** Связанный персонаж / NPC — зелёный чип в деталке */
  linkedCharacter?: string
  /** Квесты, синие чипы */
  quests: string[]
  /** Число для чипа +N в деталке (если не задано — max(0, quests.length − 2)) */
  detailMoreCount?: number
  description: string
  /** Своя картинка; null или пусто — в интерфейсе подставится DEFAULT_LOCATION_CARD_IMAGE_URL */
  imageUrl: string | null
  /**
   * К какому холсту карты относится локация:
   * `MAIN_CAMPAIGN_MAP_CANVAS_ID` или id локации, чей регион сейчас открыт на карте.
   */
  mapCanvasId: string
  /** Координаты пина Leaflet CRS.Simple после постановки с карты */
  pinLatLng?: { lat: number; lng: number } | null
  /** Подлокации / точки интереса */
  detailRelatedLocations?: LocationDetailLinkedItem[]
  /** Связанные квесты со строкой описания */
  detailRelatedQuests?: LocationDetailLinkedItem[]
  /** Связанные персонажи */
  detailRelatedCharacters?: LocationDetailLinkedItem[]
}

/** Первая демо-локация для fallback в UI, если лист пуст. */
export const DEMO_LOCATION_FALLBACK_ID = 'liaren' as const

export const DEMO_LOCATION_LIST: CampaignLocationListItem[] = [
  { id: 'liaren', listName: 'Лиарен-Кал' },
  { id: 'dowid-castle', listName: 'Замок Доуида' },
  { id: 'grey-ridges', listName: 'Серые Кряжи' },
]

export const DEMO_LOCATION_SHEETS: Record<string, LocationSheet> = {
  liaren: {
    id: 'liaren',
    displayTitle: 'Лиарен-Кал',
    listSubtitle: 'Город-призрак',
    linkedCharacter: 'Безымянный страж колокольни',
    quests: ['Набат на закате', 'Кузнечные молоты'],
    description: `Город-призрак Лиарен-Кал лежит в туманной долине у подножия Серых Кряжей. Когда-то здесь шумели рынки и звонили кузнечные молоты, но после «Ночи Беззвёздной Луны» улицы опустели, а в окнах больше не горит свет.

Странники рассказывают, что на закате из колокольни слышен едва различимый набат — хотя верёвка колокола давно сгнила. Местные обходят долину стороной; те немногие, кто заходил в город на рассвете, находили на площади свежие следы — будто кто-то танцевал босиком по мокрому камню.`,
    imageUrl: DEFAULT_LOCATION_CARD_IMAGE_URL,
    mapCanvasId: MAIN_CAMPAIGN_MAP_CANVAS_ID,
    detailRelatedLocations: [
      { title: 'Пустырь бывшего рынка', description: 'Павильоны давно проданы на дрова.' },
      {
        title: 'Тракт к Серым Кряжам',
        description: 'Граница долины; камни мокры от тумана.',
        linked: true,
        targetLocationId: 'grey-ridges',
      },
    ],
    detailRelatedQuests: [
      { title: 'Свет в верхнем окне', description: 'Подняться после заката и не потерять путь назад.', linked: true },
      { title: 'Кузница без огня', description: 'Молоты стоят, но по ночам слышен стук.', linked: true },
    ],
    detailRelatedCharacters: [
      { title: 'Безымянный страж', description: 'Дежурит у колокольни; лица почти не видно.', linked: true },
      { title: 'Купец-хронист', description: 'Вёл записи до «Ночи»; книгу спрятал в подвале.', linked: true },
    ],
  },
  'dowid-castle': {
    id: 'dowid-castle',
    displayTitle: 'Замок Доуида',
    listSubtitle: 'Королевство Лихолесье',
    linkedCharacter: 'Король Доуид',
    quests: ['Помощь бедняку Джо', 'Совет в тронном зале', 'Осада', 'Бегство из подземелья'],
    description:
      'Высокие башни и узкие мостки над пропастью. В зале тронный залит полденным светом; стража редко пускает гостей без письма от канцлера.',
    imageUrl: DEFAULT_LOCATION_CARD_IMAGE_URL,
    mapCanvasId: MAIN_CAMPAIGN_MAP_CANVAS_ID,
    detailRelatedLocations: [
      { title: 'Тронный зал', description: 'Письмо от канцлера — почти обязательно.' },
      { title: 'Стены с сторожевыми дорожками', description: 'Ветер с пропасти сбивает шаг.', linked: true, targetLocationId: 'grey-ridges' },
    ],
    detailRelatedQuests: [
      { title: 'Совет при свечах', description: 'Король ждёт ответ по делу Джо.', linked: true },
      { title: 'Осада — старый план', description: 'Найти чертёж потайного хода в архиве.', linked: true },
    ],
    detailRelatedCharacters: [
      { title: 'Король Доуид', description: 'Не любит двусмысленных обещаний.', linked: true },
      { title: 'Джо-бедняк', description: 'Подал прошение; пропал после аудиенции.', linked: true },
    ],
  },
  'grey-ridges': {
    id: 'grey-ridges',
    displayTitle: 'Серые Кряжи',
    listSubtitle: 'Хребет',
    quests: ['Перевал', 'Снежная буря'],
    description:
      'Каменистые склоны и редкий кустарник. Тропы путаются в тумане; проводники берут плату заранее и не дают обещаний вернуться вовремя.',
    imageUrl: DEFAULT_LOCATION_CARD_IMAGE_URL,
    mapCanvasId: MAIN_CAMPAIGN_MAP_CANVAS_ID,
    detailRelatedLocations: [
      { title: 'Перевал Вороньего ключа', description: 'Туман стелется выше колена; метки старых караванов едва видны.' },
      { title: 'Дорога в Лихолесье', description: 'К замку Доуида — если не сорвётесь с обрыва.', linked: true, targetLocationId: 'dowid-castle' },
    ],
    detailRelatedQuests: [
      { title: 'Снежная буря', description: 'Дождаться проводника или идти вслепую.', linked: true },
    ],
    detailRelatedCharacters: [
      { title: 'Проводник Мара', description: 'Берёт серебро вперёд; не обещает сроков.', linked: true },
    ],
  },
}

function cloneDetailLinkedItems(items?: LocationDetailLinkedItem[]): LocationDetailLinkedItem[] | undefined {
  return items?.map((i) => ({ ...i }))
}

/** Клон демо-данных под реактивное состояние (MapView + сайдбар) */
export function createCampaignLocationsBootstrap(): {
  list: CampaignLocationListItem[]
  sheets: Record<string, LocationSheet>
} {
  const sheets: Record<string, LocationSheet> = {}
  for (const key of Object.keys(DEMO_LOCATION_SHEETS)) {
    const s = DEMO_LOCATION_SHEETS[key]!
    sheets[key] = {
      ...s,
      quests: [...s.quests],
      detailRelatedLocations: cloneDetailLinkedItems(s.detailRelatedLocations),
      detailRelatedQuests: cloneDetailLinkedItems(s.detailRelatedQuests),
      detailRelatedCharacters: cloneDetailLinkedItems(s.detailRelatedCharacters),
    }
  }
  return {
    list: DEMO_LOCATION_LIST.map((item) => ({ ...item })),
    sheets,
  }
}
