import type { PositionData } from '@asyra/utils'

export type VectorAnchorType = 'smooth' | 'sharp'

export interface VectorAnchorPoint extends PositionData {
  id: string
  type: VectorAnchorType
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
