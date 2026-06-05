import type { components } from '@/shared/api/generated/schema'

export type CampaignListItem = components['schemas']['CampaignItem']

function pickString(obj: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const v = obj[key]
    if (typeof v === 'string' && v.length > 0) return v
  }
  return undefined
}

/** Нормализует элемент списка кампаний (camelCase / snake_case с бэка). */
export function normalizeCampaignListItem(raw: unknown): CampaignListItem | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const id = pickString(o, 'id', 'campaign_id', 'campaignId')
  if (!id) return null
  const title = pickString(o, 'title') ?? 'Без названия'
  const description = pickString(o, 'description') ?? ''
  const createdAt =
    pickString(o, 'createdAt', 'created_at') ?? new Date(0).toISOString()
  return { id, title, description, createdAt }
}

export function normalizeCampaignList(raw: unknown): CampaignListItem[] {
  if (!raw || typeof raw !== 'object') return []
  const campaigns = (raw as { campaigns?: unknown }).campaigns
  if (!Array.isArray(campaigns)) return []
  const out: CampaignListItem[] = []
  for (const item of campaigns) {
    const normalized = normalizeCampaignListItem(item)
    if (normalized) out.push(normalized)
  }
  return out
}

export function normalizeCreateCampaignId(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  return pickString(o, 'campaignId', 'campaign_id', 'id') ?? null
}
