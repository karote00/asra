export const parseFiniteInputNumber = (value: string): number | null => {
  const trimmed = value.trim()
  if (trimmed.length === 0) {
    return null
  }

  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

export const formatInputNumber = (
  value: number | string
): number | string => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return value
  }

  const rounded = value.toFixed(2)
  return rounded.replace(/\.?0+$/, '')
}
