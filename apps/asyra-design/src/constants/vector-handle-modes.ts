import { VECTOR_HANDLE_MODES, type VectorHandleMode } from '@asyra/core'

export const VectorHandleModes = VECTOR_HANDLE_MODES
export type { VectorHandleMode }

export const isVectorHandleMode = (value: unknown): value is VectorHandleMode =>
  value === VectorHandleModes.NONE ||
  value === VectorHandleModes.MIRROR_ANGLE ||
  value === VectorHandleModes.MIRROR_ANGLE_LENGTH
