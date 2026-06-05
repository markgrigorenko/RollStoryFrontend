import { uploadFile } from '@/shared/api/filesApi'
import { getDemoCharacterPortraitAssetUrl } from '@/types/character-campaign'

async function assetUrlToFile(assetUrl: string): Promise<File> {
  const res = await fetch(assetUrl)
  if (!res.ok) {
    throw new Error(`Не удалось загрузить файл портрета (${res.status})`)
  }
  const blob = await res.blob()
  const type = blob.type || 'image/jpeg'
  const ext = type.includes('png') ? 'png' : 'jpg'
  return new File([blob], `portrait.${ext}`, { type })
}

/** Загружает портрет демо-персонажа на сервер до complete, если имя известно. */
export async function uploadDemoCharacterPortraitIfKnown(
  campaignId: string,
  characterId: string,
  characterName: string,
  signal?: AbortSignal
): Promise<string | null> {
  const assetUrl = getDemoCharacterPortraitAssetUrl(characterName)
  if (!assetUrl) return null

  const file = await assetUrlToFile(assetUrl)
  const uploaded = await uploadFile(
    {
      campaignId,
      kind: 'character',
      characterId,
      file,
    },
    signal
  )
  return uploaded.url?.trim() || null
}
