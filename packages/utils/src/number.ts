export const roundFloat = (value: number, decimals = 2): number => {
  const factor = Math.pow(10, decimals)
  return Math.round(value * factor) / factor
}

export const clampUnit = (value: number): number =>
  Math.max(0, Math.min(1, value))
