const DEVICE_ID_KEY = 'rs_device_id'

/** Стабильный UUID устройства для заголовка X-Device-Id (OpenAPI /auth/login). */
export function getOrCreateDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(DEVICE_ID_KEY, id)
  }
  return id
}
