import { DEFAULT_LOCATION_CARD_IMAGE_URL } from '@/types/location-campaign'

export interface CampaignQuestListItem {
  id: string
  listName: string
}

export interface QuestLocationLink {
  locationId: string
  locationTitle: string
}

export interface QuestSheet {
  id: string
  displayTitle: string
  listSubtitle?: string
  description: string
  imageUrl: string | null
  locationLinks: QuestLocationLink[]
  /** Локальный квест (ещё не подтверждён на бэке) */
  isLocalOnly?: boolean
}

export const LOCAL_QUEST_ID_PREFIX = 'map-quest-'

export function isLocalOnlyQuestId(id: string): boolean {
  return id.startsWith(LOCAL_QUEST_ID_PREFIX)
}

export const DEMO_QUEST_LIST: CampaignQuestListItem[] = [
  { id: 'a1b2c3d4-e5f6-4789-a012-3456789abcde', listName: 'Помощь бедняку Джо' },
  { id: 'b2c3d4e5-f6a7-4890-b123-456789abcdef0', listName: 'Замок Доуида' },
  { id: 'c3d4e5f6-a7b8-4901-c234-56789abcdef1', listName: 'Набат на закате' },
]

const descJoe = `Джо просит разобраться с пропажей скота у старого моста. Награда скромная, но деревня готова укрыть от дождя и поделиться слухами о Серых Кряжах.`

export const DEMO_QUEST_SHEETS: Record<string, QuestSheet> = {
  'a1b2c3d4-e5f6-4789-a012-3456789abcde': {
    id: 'a1b2c3d4-e5f6-4789-a012-3456789abcde',
    displayTitle: 'Помощь бедняку Джо',
    listSubtitle: 'Сюжетная линия',
    description: descJoe,
    imageUrl: DEFAULT_LOCATION_CARD_IMAGE_URL,
    locationLinks: [
      { locationId: 'liaren', locationTitle: 'Лиарен-Кал' },
      { locationId: 'dowid-castle', locationTitle: 'Замок Доуида' },
    ],
  },
  'b2c3d4e5-f6a7-4890-b123-456789abcdef0': {
    id: 'b2c3d4e5-f6a7-4890-b123-456789abcdef0',
    displayTitle: 'Замок Доуида',
    listSubtitle: 'Осада',
    description:
      'Гарнизон замка ищет отряд для разведки подступов. В награду — ночлег, провизия и право выкупа пленного торговца.',
    imageUrl: DEFAULT_LOCATION_CARD_IMAGE_URL,
    locationLinks: [{ locationId: 'dowid-castle', locationTitle: 'Замок Доуида' }],
  },
  'c3d4e5f6-a7b8-4901-c234-56789abcdef1': {
    id: 'c3d4e5f6-a7b8-4901-c234-56789abcdef1',
    displayTitle: 'Набат на закате',
    listSubtitle: 'Тревога',
    description:
      'С колокольни Лиарен-Кал снова донёсся набат. Нужно выяснить, кто поднимает тревогу и зачем.',
    imageUrl: DEFAULT_LOCATION_CARD_IMAGE_URL,
    locationLinks: [{ locationId: 'liaren', locationTitle: 'Лиарен-Кал' }],
  },
}

export function createQuestBootstrap(): {
  list: CampaignQuestListItem[]
  sheets: Record<string, QuestSheet>
} {
  return {
    list: DEMO_QUEST_LIST.map((item) => ({ ...item })),
    sheets: Object.fromEntries(
      Object.entries(DEMO_QUEST_SHEETS).map(([id, sheet]) => [id, { ...sheet, locationLinks: sheet.locationLinks.map((l) => ({ ...l })) }])
    ),
  }
}
