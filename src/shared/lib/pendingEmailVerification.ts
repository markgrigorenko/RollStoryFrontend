const STORAGE_KEY = 'rs_pending_email_verification'

export type PendingEmailVerification = {
  userId: string
  email: string
  verificationToken?: string
}

export function savePendingEmailVerification(data: PendingEmailVerification): void {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export function getPendingEmailVerification(): PendingEmailVerification | null {
  const raw = sessionStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as PendingEmailVerification
    if (typeof parsed.userId !== 'string' || typeof parsed.email !== 'string') {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function clearPendingEmailVerification(): void {
  sessionStorage.removeItem(STORAGE_KEY)
}
