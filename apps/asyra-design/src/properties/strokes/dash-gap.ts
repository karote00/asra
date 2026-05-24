const DEFAULT_DASH_GAP_VALUE = 20

const getPositivePatternEntry = (
  pattern: readonly number[] | undefined,
  index: number
) => {
  const entry = pattern?.[index]
  return typeof entry === 'number' && Number.isFinite(entry) && entry > 0
    ? entry
    : null
}

export const getStrokeDashGap = (
  pattern: readonly number[] | undefined
): { dash: number; gap: number } => {
  const dash = getPositivePatternEntry(pattern, 0) ?? DEFAULT_DASH_GAP_VALUE
  const gap = getPositivePatternEntry(pattern, 1) ?? dash

  return { dash, gap }
}
