const REASON_MESSAGES: Record<string, string> = {
  empty: 'Ссылка подтверждения не содержит токен.',
  not_found: 'Ссылка подтверждения недействительна.',
  used: 'Email уже подтверждён.',
  expired: 'Ссылка подтверждения истекла. Зарегистрируйтесь заново.',
  internal: 'Не удалось подтвердить email. Попробуйте позже.',
}

export function verifyEmailErrorMessage(reason: string): string {
  return REASON_MESSAGES[reason] ?? REASON_MESSAGES.internal!
}

export function isVerifyEmailAlreadyUsedReason(reason: string): boolean {
  return reason === 'used'
}

export function parseVerifyEmailReasonFromLocation(location: string): string | null {
  try {
    const url = new URL(location, window.location.origin)
    return url.searchParams.get('reason')
  } catch {
    const match = location.match(/[?&]reason=([^&]+)/)
    return match?.[1] ? decodeURIComponent(match[1]) : null
  }
}

// Определяем ошибочный редирект по наличию query-параметра `reason`.
// На success_url его нет, на error_url он всегда есть (см. openapi: empty,
// not_found, used, expired, internal). Это устойчиво к смене путей в
// `verify_email.success_url` / `verify_email.error_url` на стороне бэка.
export function isVerifyEmailErrorLocation(location: string): boolean {
  return parseVerifyEmailReasonFromLocation(location) !== null
}
