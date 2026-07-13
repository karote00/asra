export const isNil = (v: unknown): v is null | undefined =>
  v === null || v === undefined

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)
