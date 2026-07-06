const DEFAULT_DASH_LENGTH_VALUE = 20

const getPositiveLength = (value: number | undefined) =>
  typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : null

export const getStrokeDashLengths = (
  value: { dash?: number; gap?: number } | undefined
): { dash: number; gap: number } => {
  const dash = getPositiveLength(value?.dash) ?? DEFAULT_DASH_LENGTH_VALUE
  const gap = getPositiveLength(value?.gap) ?? DEFAULT_DASH_LENGTH_VALUE

  return { dash, gap }
}
