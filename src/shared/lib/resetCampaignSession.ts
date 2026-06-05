import { clearAuthSession } from '@/shared/lib/authSession'
import { useActiveCampaignStore } from '@/stores/activeCampaign'
import { useCampaignCharactersStore } from '@/stores/campaignCharacters'
import { useCampaignQuestsStore } from '@/stores/campaignQuests'
import { useCharacterCreationSessionStore } from '@/stores/characterCreationSession'

/** Сброс кампании и Pinia-данных (без токенов). После входа другим пользователем. */
export function resetCampaignSessionState(): void {
  useActiveCampaignStore().resetSession()
  useCampaignCharactersStore().resetSession()
  useCampaignQuestsStore().resetSession()
  useCharacterCreationSessionStore().reset()
}

/** Полный выход: токены + кампания + сторы. */
export function logoutAndResetSession(): void {
  clearAuthSession()
  resetCampaignSessionState()
}
