export const VectorHandleModes = {
  NONE: 'none',
  MIRROR_ANGLE: 'mirror-angle',
  MIRROR_ANGLE_LENGTH: 'mirror-angle-length'
} as const

export type VectorHandleMode =
  (typeof VectorHandleModes)[keyof typeof VectorHandleModes]

export const isVectorHandleMode = (value: unknown): value is VectorHandleMode =>
  value === VectorHandleModes.NONE ||
  value === VectorHandleModes.MIRROR_ANGLE ||
  value === VectorHandleModes.MIRROR_ANGLE_LENGTH
