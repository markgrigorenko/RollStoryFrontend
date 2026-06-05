import { httpFetch } from '@/shared/api/parts/httpFetch'
import { requireUserAuthHeaders } from '@/shared/api/parts/authHeaders'
import { API_ROUTES } from '@/shared/api/routes/apiRoutes'
import { resolveApiUrl } from '@/shared/lib/apiBaseUrl'
import type { components } from '@/shared/api/generated/schema'

export type UploadFileKind = 'location' | 'character'

export type UploadFileParams = {
  campaignId: string
  kind: UploadFileKind
  file: File
  locationId?: string
  characterId?: string
}

function buildUploadUrl(params: UploadFileParams): string {
  const query: Record<string, string> = {
    campaign_id: params.campaignId,
    kind: params.kind,
  }
  if (params.locationId) {
    query.location_id = params.locationId
  }
  if (params.characterId) {
    query.character_id = params.characterId
  }
  const base = resolveApiUrl(API_ROUTES.files.upload)
  const qs = new URLSearchParams(query).toString()
  return qs.length > 0 ? `${base}?${qs}` : base
}

/** Загрузка изображения (POST /files/upload, multipart/form-data). */
export async function uploadFile(
  params: UploadFileParams,
  signal?: AbortSignal
): Promise<components['schemas']['UploadFileResponse']> {
  const form = new FormData()
  form.append('file', params.file)

  const res = await httpFetch<components['schemas']['UploadFileResponse']>(
    buildUploadUrl(params),
    {
      method: 'POST',
      headers: requireUserAuthHeaders(),
      body: form,
      signal,
      source: 'filesApi.uploadFile',
    }
  )
  if (!res) {
    throw new Error('Пустой ответ при загрузке файла')
  }
  return res
}
