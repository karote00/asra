import type { PositionData } from '@asyra/utils'
import type { FillAttrs, StrokeAttrs } from '@asyra/utils'

export const VECTOR_ANCHOR_ID_TYPE = 'vector-anchor'
export const VECTOR_ANCHOR_ID_PREFIX = 'anchor'
export const VECTOR_TOPOLOGY_NETWORK_ID_TYPE = 'tn'
export const VECTOR_TOPOLOGY_SEGMENT_ID_TYPE = 'ts'
export const VECTOR_TOPOLOGY_POINT_ID_TYPE = 'tp'
export const VECTOR_TOKENS = {
  CONTROL: {
    ROLE: {
      IN: 'in',
      OUT: 'out'
    }
  },
  ENDPOINT: {
    SIDE: {
      START: 'start',
      END: 'end'
    }
  },
  POINT: {
    KIND: {
      ANCHOR: 'anchor',
      CONTROL: 'control'
    },
    TARGET: {
      ANCHOR: 'anchor',
      IN_HANDLE: 'inHandle',
      OUT_HANDLE: 'outHandle'
    }
  }
} as const

export type VectorAnchorType = 'smooth' | 'sharp'
export type VectorPointKind =
  (typeof VECTOR_TOKENS.POINT.KIND)[keyof typeof VECTOR_TOKENS.POINT.KIND]
export type VectorControlRole =
  (typeof VECTOR_TOKENS.CONTROL.ROLE)[keyof typeof VECTOR_TOKENS.CONTROL.ROLE]

export const getVectorControlId = (
  anchorId: string,
  role: VectorControlRole
): string => `${anchorId}:${role}`
export type VectorEndpointSide =
  (typeof VECTOR_TOKENS.ENDPOINT.SIDE)[keyof typeof VECTOR_TOKENS.ENDPOINT.SIDE]
export type VectorPointTarget =
  (typeof VECTOR_TOKENS.POINT.TARGET)[keyof typeof VECTOR_TOKENS.POINT.TARGET]
export const VECTOR_HANDLE_MODES = {
  NONE: 'none',
  MIRROR_ANGLE: 'mirror-angle',
  MIRROR_ANGLE_LENGTH: 'mirror-angle-length'
} as const
export type VectorHandleMode =
  (typeof VECTOR_HANDLE_MODES)[keyof typeof VECTOR_HANDLE_MODES]

export interface VectorAnchorPoint extends PositionData {
  id: string
  type: VectorAnchorType
  isMove?: boolean
  inHandle: PositionData | null
  outHandle: PositionData | null
}

export const getVectorPointTargetPosition = (
  point: Pick<VectorAnchorPoint, 'x' | 'y' | 'inHandle' | 'outHandle'>,
  target: VectorPointTarget
): PositionData | null => {
  if (target === VECTOR_TOKENS.POINT.TARGET.ANCHOR) {
    return { x: point.x, y: point.y }
  }

  return target === VECTOR_TOKENS.POINT.TARGET.IN_HANDLE
    ? point.inHandle
    : point.outHandle
}

export interface VectorPointNode extends PositionData {
  id: string
  kind: VectorPointKind
  anchorType?: VectorAnchorType
  handleMode?: VectorHandleMode
  controlForId?: string
  controlRole?: VectorControlRole
}

export type VectorAnchorPointNode = VectorPointNode & {
  kind: typeof VECTOR_TOKENS.POINT.KIND.ANCHOR
}

export type VectorControlPointNode = VectorPointNode & {
  kind: typeof VECTOR_TOKENS.POINT.KIND.CONTROL
}

export const isVectorAnchorNode = (
  point: VectorPointNode | null | undefined
): point is VectorAnchorPointNode =>
  point?.kind === VECTOR_TOKENS.POINT.KIND.ANCHOR

export const isVectorControlNode = (
  point: VectorPointNode | null | undefined
): point is VectorControlPointNode =>
  point?.kind === VECTOR_TOKENS.POINT.KIND.CONTROL

export const isVectorHandleMode = (value: unknown): value is VectorHandleMode =>
  value === VECTOR_HANDLE_MODES.NONE ||
  value === VECTOR_HANDLE_MODES.MIRROR_ANGLE ||
  value === VECTOR_HANDLE_MODES.MIRROR_ANGLE_LENGTH

const getTrailingVectorIdNumber = (value: string): number => {
  const match = value.match(/[-_](\d+)$/)
  return match ? Number.parseInt(match[1], 10) : Number.NaN
}

export const sortVectorItemsById = <T extends { id: string }>(
  items: readonly T[]
): T[] =>
  [...items].sort((left, right) => {
    const leftRank = getTrailingVectorIdNumber(left.id)
    const rightRank = getTrailingVectorIdNumber(right.id)
    if (!Number.isNaN(leftRank) && !Number.isNaN(rightRank)) {
      return leftRank - rightRank
    }

    return left.id.localeCompare(right.id)
  })

export interface VectorAnchorHandleRefs {
  inControlId: string | null
  outControlId: string | null
}

export const getVectorNetworkAnchorHandleRefs = (
  network: Pick<VectorNetwork, 'pointIds' | 'segmentIds'>,
  segments: Readonly<Record<string, VectorSegment>>
): Map<string, VectorAnchorHandleRefs> => {
  const refs = new Map<string, VectorAnchorHandleRefs>()
  network.pointIds.forEach((pointId) => {
    refs.set(pointId, { inControlId: null, outControlId: null })
  })

  network.segmentIds.forEach((segmentId) => {
    const segment = segments[segmentId]
    if (!segment) {
      return
    }

    const startRefs = refs.get(segment.startId)
    if (startRefs && segment.outControlId) {
      startRefs.outControlId = segment.outControlId
    }

    const endRefs = refs.get(segment.endId)
    if (endRefs && segment.inControlId) {
      endRefs.inControlId = segment.inControlId
    }
  })

  return refs
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

export interface VectorPathStyle {
  closed: boolean
  fillRule?: 'evenodd' | 'nonzero'
  fills?: FillAttrs[]
  strokes?: StrokeAttrs[]
}

export interface VectorSelectionRef {
  elementId: string
  pointId: string
  target: VectorPointTarget
}

export interface VectorEditingContinuation {
  networkId: string
  pointId: string
  side: VectorEndpointSide
}

export interface SelectedVectorPointState extends Record<string, unknown> {
  elementId: string
  pointId: string
  index: number
  target: VectorPointTarget
  x: number
  y: number
  handleMode?: VectorHandleMode
}

export interface SelectedVectorSegmentState extends Record<string, unknown> {
  elementId: string
  segmentId: string
}

export interface HoveredVectorSegmentInsertPointState extends Record<
  string,
  unknown
> {
  elementId: string
  segmentId: string
  x: number
  y: number
}
