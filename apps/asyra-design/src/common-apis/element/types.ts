import type {
  FillAttrs,
  StrokeAttrs,
  VectorAnchorPoint,
  VectorPointTarget as CoreVectorPointTarget,
  VectorPathStyle,
  VectorNetwork,
  VectorPointNode,
  VectorSegment
} from '@asyra/core'
import type { EntityType, PositionData, Rect } from '@asyra/utils'

export type ElementBounds = Rect

export interface VectorComputedSnapshot extends Partial<VectorPathStyle> {
  x?: number
  y?: number
  width?: number
  height?: number
  pointCoordinateSpace?: 'workspace'
  points: Record<string, VectorPointNode>
  segments: Record<string, VectorSegment>
  networks: Record<string, VectorNetwork>
}

export interface CreateElementOptions {
  type: EntityType
  clientPosition?: PositionData
  workspacePosition?: PositionData
  parentWorkspaceOrigin?: PositionData
  parentId?: string
  width?: number
  height?: number
  fills?: FillAttrs[]
  strokes?: StrokeAttrs[]
  points?: Record<string, VectorPointNode>
  segments?: Record<string, VectorSegment>
  networks?: Record<string, VectorNetwork>
  closed?: boolean
}

export type VectorPointTarget = CoreVectorPointTarget

export interface VectorEditablePointHit {
  point: VectorAnchorPoint
  index: number
  target: VectorPointTarget
  position: PositionData
}

export interface VectorSegmentHit {
  segmentId: string
  position: PositionData
  t: number
}
