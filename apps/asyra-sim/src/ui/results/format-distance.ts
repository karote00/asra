export const formatDistance = (value: number | null): string =>
  value === null ? 'unknown' : `${(value * 1000).toFixed(3)} mm`
