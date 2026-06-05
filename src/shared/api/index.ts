export { getApiBaseUrl, HttpError, postJson, resolveApiUrl } from './client'
export {
  login,
  refreshTokens,
  signUp,
  verifyEmail,
  type LoginRequestBody,
  type LoginResponseBody,
  type SignUpRequestBody,
  type SignUpResponseBody,
  type VerifyEmailResult,
} from './authApi'
export { createCampaign, deleteCampaign, listCampaigns } from './campaignApi'
export {
  createCharacterRelation,
  deleteCharacterRelation,
  getCharacterDetail,
  listCharacters,
} from './characterApi'
export {
  completeCharacterCreation,
  postCharacterAsi,
  postCharacterBasicInfo,
  postCharacterPointBuy,
  postCharacterProficiencies,
  rewindCharacterCreationStep,
  startCharacterCreation,
} from './characterCreateApi'
export { fetchHealthPing, fetchHealthReady } from './healthApi'
export {
  createLocation,
  deleteLocation,
  getLocationDetail,
  linkCharacterToLocation,
  linkQuestToLocation,
  listLocations,
  unlinkCharacterFromLocation,
  unlinkQuestFromLocation,
  updateLocation,
} from './locationApi'
export { uploadFile, type UploadFileKind, type UploadFileParams } from './filesApi'
export {
  createQuest,
  fetchCampaignLocationQuestDetails,
  type CreateQuestRequest,
  type LocationQuestDetail,
  type QuestResponse,
} from './questApi'
export { API_ROUTES } from './routes/apiRoutes'
export { defaultApiClient, type ApiCallContext } from '@/shared/lib/apiClient'
export type { components } from './generated/schema'
export {
  AuthFailedError,
  AuthStateError,
  InternalServerError,
  InvalidCredentialsError,
} from './parts/defaultErrors'
