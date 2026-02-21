import type { PositionData } from '@asyra/utils'

export const VECTOR_ANCHOR_ID_TYPE = 'vector-anchor'
export const VECTOR_ANCHOR_ID_PREFIX = 'anchor'

export type VectorAnchorType = 'smooth' | 'sharp'

export interface VectorAnchorPoint extends PositionData {
  id: string
  type: VectorAnchorType
  isMove?: boolean
  inHandle: PositionData | null
  outHandle: PositionData | null
}

export interface VectorStrokeStyle {
  stroke: string
  strokeWidth: number
}

export interface VectorPathStyle extends VectorStrokeStyle {
  closed: boolean
  fill: string
}
