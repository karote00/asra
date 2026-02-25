export const PrimaryToolType = {
  SELECT: 'select',
  RECTANGLE: 'rect',
  OVAL: 'oval',
  PEN: 'pen'
} as const

export type PrimaryToolType =
  (typeof PrimaryToolType)[keyof typeof PrimaryToolType]
