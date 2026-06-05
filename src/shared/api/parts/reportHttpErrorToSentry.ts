export type ReportHttpErrorParams = {
  source: string
  url: string
  method: string
  httpStatus: number
  errorName?: string
  responseBodyLength?: number
}

/** Заглушка под Sentry: при подключении `@sentry/vue` — заменить реализацией с санитизацией URL. */
export function reportHttpErrorToSentry(params: ReportHttpErrorParams): void {
  void params
}

function normalizePathForReport(urlString: string): string {
  try {
    const u = new URL(urlString, 'http://local.invalid')
    let p = u.pathname
    p = p.replace(
      /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g,
      ':id'
    )
    p = p.replace(/\/\d+(?=\/|$)/g, '/:id')
    return p
  } catch {
    return urlString.split('?')[0] ?? urlString
  }
}

export function buildReportParams(
  source: string,
  fullUrl: string,
  method: string,
  httpStatus: number,
  err: unknown,
  responseText?: string
): ReportHttpErrorParams {
  const urlForReport = (() => {
    try {
      const u = new URL(fullUrl, window.location.origin)
      u.search = ''
      return u.toString()
    } catch {
      return fullUrl.split('?')[0] ?? fullUrl
    }
  })()

  return {
    source,
    url: normalizePathForReport(urlForReport),
    method,
    httpStatus,
    errorName: err instanceof Error ? err.name : undefined,
    responseBodyLength: responseText?.length,
  }
}
