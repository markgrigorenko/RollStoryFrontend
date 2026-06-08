// Машиночитаемые коды причин ошибки verify-email. Совпадают с тем, что
// бэк отдаёт в ErrorResponse.reason (см. schema.yaml).
export type VerifyEmailReason =
  | 'empty'
  | 'not_found'
  | 'used'
  | 'expired'
  | 'internal'

const REASON_MESSAGES: Record<VerifyEmailReason, string> = {
  empty: 'Ссылка подтверждения не содержит токен.',
  not_found: 'Ссылка подтверждения недействительна.',
  used: 'Email уже подтверждён.',
  expired: 'Ссылка подтверждения истекла. Запросите новое письмо.',
  internal: 'Не удалось подтвердить email. Попробуйте позже.',
}

export function verifyEmailErrorMessage(reason: string): string {
  return (REASON_MESSAGES as Record<string, string>)[reason] ?? REASON_MESSAGES.internal
}

export function isVerifyEmailAlreadyUsedReason(reason: string): boolean {
  return reason === 'used'
}

// Маппинг HTTP-статуса ответа /auth/verify-email на reason.
// Бэк теперь возвращает JSON со статусами (без 302-редиректа):
//   200 → ok; 400 → empty; 403 → expired; 404 → not_found; 409 → used; 500 → internal.
// Если бэк прислал reason в теле ошибки — используем его, иначе fallback по статусу.
export function verifyEmailReasonFromStatus(status: number): VerifyEmailReason {
  switch (status) {
    case 400:
      return 'empty'
    case 403:
      return 'expired'
    case 404:
      return 'not_found'
    case 409:
      return 'used'
    default:
      return 'internal'
  }
}
