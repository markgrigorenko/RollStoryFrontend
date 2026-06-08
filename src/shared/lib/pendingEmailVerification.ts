const STORAGE_KEY = 'rs_pending_email_verification'

// Чёрная коробка состояния «есть аккаунт без подтверждения, мы его помним».
// Используется ConfirmEmailView, чтобы знать email для повторной отправки,
// без необходимости заново его вводить. userId нам тут не нужен — для resend
// бэк принимает только email+password.
export type PendingEmailVerification = {
  email: string
}

export function savePendingEmailVerification(data: PendingEmailVerification): void {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export function getPendingEmailVerification(): PendingEmailVerification | null {
  const raw = sessionStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as PendingEmailVerification
    if (typeof parsed.email !== 'string' || parsed.email.length === 0) {
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
