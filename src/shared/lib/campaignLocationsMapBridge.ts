import type { InjectionKey, Ref } from 'vue'

/** Связь сайдбара кампании с картой и кросс-вкладочной навигацией. */
export interface CampaignSidebarBridge {
  pendingDetailLocationId: Ref<string | null>
  pendingDetailCharacterId: Ref<string | null>
  pendingDetailQuestId: Ref<string | null>
  openLocation: (locationId: string) => void
  openCharacter: (characterId: string) => void
  openQuest: (questId: string) => void
  /** Убрать пин с карты после DELETE локации на бэке */
  removeLocationPin?: (locationId: string) => void
}

/** @deprecated Используйте `CampaignSidebarBridge` */
export type CampaignLocationsMapBridge = CampaignSidebarBridge

export const campaignSidebarBridgeKey: InjectionKey<CampaignSidebarBridge> = Symbol(
  'campaignSidebarBridge',
)

/** @deprecated Используйте `campaignSidebarBridgeKey` */
export const campaignLocationsMapBridgeKey = campaignSidebarBridgeKey
