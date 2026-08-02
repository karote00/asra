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
import type {
  CreateElementData,
  EntityType,
  PositionData,
  PropsRawData,
  Rect
} from '@asyra/utils'

export type ElementBounds = Rect

export interface VectorComputedSnapshot extends Partial<VectorPathStyle> {
  x?: number
  y?: number
  width?: number
  height?: number
  pointCoordinateSpace?: 'local'
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

export type PreparedElementDescriptor = Readonly<
  CreateElementData & {
    readonly id: string
    readonly name: string
    readonly props: Readonly<PropsRawData>
    readonly type: EntityType
  }
>

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
