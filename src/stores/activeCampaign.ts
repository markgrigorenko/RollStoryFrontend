import { defineStore } from 'pinia'
import { ref } from 'vue'
import { createCampaign, listCampaigns } from '@/shared/api'
import {
  normalizeCampaignList,
  normalizeCreateCampaignId,
  type CampaignListItem,
} from '@/shared/lib/campaignMappers'

const STORAGE_KEY = 'rs_active_campaign_id'
const ACTIVE_CAMPAIGN_LOG = '[active-campaign]'
const DEFAULT_CAMPAIGN_TITLE = 'Моя кампания'

export type { CampaignListItem }

function isDuplicateCampaignTitleError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  return (
    error.message.includes('uq_campaign_owner_title') ||
    error.message.includes('duplicate key value violates unique constraint')
  )
}

export const useActiveCampaignStore = defineStore('activeCampaign', () => {
  const campaignId = ref<string | null>(
    typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
  )
  const campaigns = ref<CampaignListItem[]>([])
  const loading = ref(false)
  const resolveError = ref<string | null>(null)
  let ensureCampaignIdInFlight: Promise<string | null> | null = null

  function setCampaignId(id: string): void {
    campaignId.value = id
    localStorage.setItem(STORAGE_KEY, id)
  }

  function clearCampaignId(): void {
    campaignId.value = null
    localStorage.removeItem(STORAGE_KEY)
  }

  /** Сброс при логауте / входе под другим пользователем. */
  function resetSession(): void {
    clearCampaignId()
    campaigns.value = []
    resolveError.value = null
    loading.value = false
    ensureCampaignIdInFlight = null
  }

  function pickCampaignIdFromList(
    list: CampaignListItem[],
    preferred: string | null
  ): string | null {
    if (preferred && list.some((c) => c.id === preferred)) return preferred
    return list[0]?.id ?? null
  }

  async function fetchCampaignList(signal?: AbortSignal): Promise<CampaignListItem[]> {
    const res = await listCampaigns(signal)
    return normalizeCampaignList(res)
  }

  async function createDefaultCampaign(signal?: AbortSignal): Promise<string | null> {
    try {
      const created = await createCampaign(
        { title: DEFAULT_CAMPAIGN_TITLE, description: '' },
        signal
      )
      const id = normalizeCreateCampaignId(created)
      if (!id) return null
      const item: CampaignListItem = {
        id,
        title: DEFAULT_CAMPAIGN_TITLE,
        description: '',
        createdAt: new Date().toISOString(),
      }
      campaigns.value = [item]
      setCampaignId(id)
      console.info(ACTIVE_CAMPAIGN_LOG, 'создана кампания по умолчанию', { campaignId: id })
      return id
    } catch (error) {
      if (!isDuplicateCampaignTitleError(error)) throw error
      console.info(ACTIVE_CAMPAIGN_LOG, 'кампания по умолчанию уже есть — читаем список')
      const list = await fetchCampaignList(signal)
      campaigns.value = list
      const id = pickCampaignIdFromList(list, null)
      if (!id) return null
      setCampaignId(id)
      return id
    }
  }

  async function ensureCampaignIdOnce(signal?: AbortSignal): Promise<string | null> {
    loading.value = true
    resolveError.value = null
    try {
      const list = await fetchCampaignList(signal)
      campaigns.value = list
      const preferred = campaignId.value ?? localStorage.getItem(STORAGE_KEY)
      console.info(ACTIVE_CAMPAIGN_LOG, 'listCampaigns', {
        rawCount: list.length,
        ids: list.map((c) => c.id),
        preferred,
      })
      const fromList = pickCampaignIdFromList(list, preferred)
      if (preferred && fromList !== preferred) {
        console.info(ACTIVE_CAMPAIGN_LOG, 'сброс кампании — нет в списке текущего пользователя', {
          preferred,
        })
        clearCampaignId()
      }
      if (fromList) {
        setCampaignId(fromList)
        return fromList
      }
      if (list.length === 0) {
        console.info(ACTIVE_CAMPAIGN_LOG, 'список пуст — создаём кампанию по умолчанию')
        const createdId = await createDefaultCampaign(signal)
        if (createdId) return createdId
        resolveError.value = 'Не удалось создать кампанию'
        return null
      }
      resolveError.value = 'Кампании есть, но не удалось определить id (формат ответа API)'
      return null
    } catch (e) {
      resolveError.value = e instanceof Error ? e.message : 'Не удалось загрузить кампании'
      console.error(ACTIVE_CAMPAIGN_LOG, e)
      return null
    } finally {
      loading.value = false
    }
  }

  /** Возвращает кампанию текущего пользователя; чужой id из localStorage сбрасывается. */
  function ensureCampaignId(signal?: AbortSignal): Promise<string | null> {
    if (ensureCampaignIdInFlight) return ensureCampaignIdInFlight
    ensureCampaignIdInFlight = ensureCampaignIdOnce(signal).finally(() => {
      ensureCampaignIdInFlight = null
    })
    return ensureCampaignIdInFlight
  }

  async function reloadCampaigns(signal?: AbortSignal): Promise<void> {
    loading.value = true
    resolveError.value = null
    try {
      campaigns.value = await fetchCampaignList(signal)
      const preferred = campaignId.value
      const fromList = pickCampaignIdFromList(campaigns.value, preferred)
      if (preferred && fromList !== preferred) {
        clearCampaignId()
      }
      if (fromList && campaignId.value !== fromList) {
        setCampaignId(fromList)
      }
    } catch (e) {
      resolveError.value = e instanceof Error ? e.message : 'Не удалось загрузить кампании'
    } finally {
      loading.value = false
    }
  }

  return {
    campaignId,
    campaigns,
    loading,
    resolveError,
    setCampaignId,
    clearCampaignId,
    resetSession,
    ensureCampaignId,
    reloadCampaigns,
  }
})
