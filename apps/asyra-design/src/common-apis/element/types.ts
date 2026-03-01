import type { VectorAnchorPoint, VectorPathStyle } from '@asyra/core'
import type { EntityType, PositionData, Rect } from '@asyra/utils'

export type ElementBounds = Rect

export interface VectorComputedSnapshot extends Partial<VectorPathStyle> {
  x?: number
  y?: number
  width?: number
  height?: number
  anchorPoints?: VectorAnchorPoint[]
}

export interface CreateElementOptions {
  type: EntityType
  clientPosition?: PositionData
  anchorPoints?: VectorAnchorPoint[]
}

export type VectorPointTarget = 'anchor' | 'inHandle' | 'outHandle'

export interface VectorEditablePointHit {
  point: VectorAnchorPoint
  index: number
  target: VectorPointTarget
  position: PositionData
}
