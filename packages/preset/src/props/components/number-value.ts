export const toNumberValue = (value: unknown, defaultValue = 0): number =>
  typeof value === 'number' ? value : defaultValue
