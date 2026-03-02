import type { PositionData } from '@asyra/utils'

export const VECTOR_ANCHOR_ID_TYPE = 'vector-anchor'
export const VECTOR_ANCHOR_ID_PREFIX = 'anchor'

export type VectorAnchorType = 'smooth' | 'sharp'
export type VectorPointKind = 'anchor' | 'control'
export type VectorControlRole = 'in' | 'out'

export interface VectorAnchorPoint extends PositionData {
  id: string
  type: VectorAnchorType
  isMove?: boolean
  inHandle: PositionData | null
  outHandle: PositionData | null
}

export interface VectorPointNode extends PositionData {
  id: string
  kind: VectorPointKind
  anchorType?: VectorAnchorType
  controlForId?: string
  controlRole?: VectorControlRole
}

export interface VectorSegment {
  id: string
  startId: string
  endId: string
  outControlId?: string | null
  inControlId?: string | null
}

export interface VectorNetwork {
  id: string
  pointIds: string[]
  segmentIds: string[]
  closed: boolean
}

export interface VectorTopology {
  points: Record<string, VectorPointNode>
  segments: Record<string, VectorSegment>
  networks: Record<string, VectorNetwork>
}

export interface VectorStrokeStyle {
  stroke: string
  strokeWidth: number
}

export interface VectorPathStyle extends VectorStrokeStyle {
  closed: boolean
  fill: string
}
