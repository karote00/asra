const REPORT_BYTE_LIMIT = 64 * 1024 * 1024

/** Consume lazily; retain no later rows after the first over-budget part. */
export function collectReportText(
  parts: Iterable<string>,
  maxBytes = REPORT_BYTE_LIMIT
): string {
  if (
    !Number.isSafeInteger(maxBytes) ||
    maxBytes <= 0 ||
    maxBytes > REPORT_BYTE_LIMIT
  )
    throw new Error('Invalid report byte limit')
  const encoder = new TextEncoder(),
    accepted: string[] = []
  let bytes = 0
  for (const part of parts) {
    bytes += encoder.encode(part).length
    if (bytes > maxBytes)
      throw new Error('Report exceeds 64 MiB or its smaller byte allowance')
    accepted.push(part)
  }
  return accepted.join('')
}
