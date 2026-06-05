import type { InjectionKey, Ref } from 'vue'

/** Связь сайдбара локаций с картой (пины, удаление). */
export interface CampaignLocationsMapBridge {
  pendingDetailLocationId: Ref<string | null>
  /** Убрать пин с карты после DELETE локации на бэке */
  removeLocationPin?: (locationId: string) => void
}

export const campaignLocationsMapBridgeKey: InjectionKey<CampaignLocationsMapBridge> = Symbol(
  'campaignLocationsMapBridge',
)
