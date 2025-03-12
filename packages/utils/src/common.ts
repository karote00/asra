export const isNil = (v: unknown): v is null | undefined =>
  v === null || v === undefined

export const isNumber = (val: string | number): boolean => isFinite(Number(val))
