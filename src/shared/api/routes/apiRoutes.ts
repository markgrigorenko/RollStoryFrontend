/** Относительные пути к `/v1` (см. `resolveApiUrl` в `apiBaseUrl`). */
export const API_ROUTES = {
  auth: {
    signin: '/auth/signin',
    login: '/auth/login',
    refresh: '/auth/refresh',
    verifyEmail: '/auth/verify-email',
  },
  db: {
    campaign: '/db/campaign',
    campaigns: '/db/campaigns',
    campaignById: (campaignId: string) => `/db/campaign/${campaignId}`,
    characters: (campaignId: string) => `/db/campaign/${campaignId}/character`,
    character: (campaignId: string, characterId: string) =>
      `/db/campaign/${campaignId}/character/${characterId}`,
    characterRelation: (campaignId: string) =>
      `/db/campaign/${campaignId}/character/relation`,
    characterCreate: {
      start: (campaignId: string) =>
        `/db/campaign/${campaignId}/character/create/start`,
      basicInfo: (campaignId: string) =>
        `/db/campaign/${campaignId}/character/create/basic_info`,
      pointBuy: (campaignId: string) =>
        `/db/campaign/${campaignId}/character/create/point_buy`,
      asi: (campaignId: string) => `/db/campaign/${campaignId}/character/create/asi`,
      proficiencies: (campaignId: string) =>
        `/db/campaign/${campaignId}/character/create/proficiencies`,
      rewind: (campaignId: string) =>
        `/db/campaign/${campaignId}/character/create/rewind`,
      complete: (campaignId: string) =>
        `/db/campaign/${campaignId}/character/create/complete`,
    },
    location: (campaignId: string) => `/db/campaign/${campaignId}/location`,
    locations: (campaignId: string) => `/db/campaign/${campaignId}/locations`,
    locationById: (campaignId: string, locationId: string) =>
      `/db/campaign/${campaignId}/location/${locationId}`,
    locationCharacter: (campaignId: string, locationId: string, characterId: string) =>
      `/db/campaign/${campaignId}/location/${locationId}/character/${characterId}`,
    quest: (campaignId: string) => `/db/campaign/${campaignId}/quest`,
    locationQuest: (campaignId: string, locationId: string, questId: string) =>
      `/db/campaign/${campaignId}/location/${locationId}/quest/${questId}`,
  },
  files: {
    upload: '/files/upload',
  },
  hc: {
    ping: '/hc/ping',
    ready: '/hc/ready',
  },
} as const
