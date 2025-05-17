export const isNil = (v: unknown): v is null | undefined =>
  v === null || v === undefined
