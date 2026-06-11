import {
  VECTOR_TOKENS,
  createOverlayLayerRegistration,
  sampleOverlayBezierPoints,
  type OverlayCanvas,
  type OverlayStrokeStyle
} from '@asyra/core'
import type {
  RegisterRenderLayerOptions,
  RenderLayerRegistration,
  VectorNetwork,
  VectorPointTarget,
  VectorPointNode,
  VectorSegment
} from '@asyra/core'
import type { PositionData } from '@asyra/utils'
import { SelectionChannels } from '../selection/channels'
import type { PresetDependencies } from '../types'

const VECTOR_EDITING_LAYER_NAME = 'vector-editing-layer'
const POINT_RADIUS = 6
const POINT_FILL_COLOR = 0x9ca3af
const POINT_STROKE_COLOR = 0x4b5563
const HANDLE_STROKE_COLOR = 0xffffff
const SEGMENT_COLOR = 0x9ca3af
const SEGMENT_WIDTH = 1
const PREVIEW_WIDTH = 2
const GHOST_POINT_FILL_COLOR = 0xffffff
const GHOST_POINT_STROKE_COLOR = 0x157ae7
const GHOST_POINT_STROKE_WIDTH = 2

const SELECTION_OUTLINE_COLOR = 0x157ae7
const HOVER_COLOR = SELECTION_OUTLINE_COLOR
const HOVER_OUTLINE_WIDTH = 2
const HOVER_OUTLINE_RADIUS = POINT_RADIUS + 2
const HOVER_SEGMENT_STROKE: OverlayStrokeStyle = {
  width: 2,
  color: HOVER_COLOR
}

const SELECTED_POINT_OUTLINE_COLOR = SELECTION_OUTLINE_COLOR
const SELECTED_POINT_OUTLINE_WIDTH = 2
const SELECTED_POINT_OUTLINE_RADIUS = POINT_RADIUS + 3
const SELECTED_SEGMENT_STROKE: OverlayStrokeStyle = {
  width: 3,
  color: SELECTED_POINT_OUTLINE_COLOR
}
const SYNTHETIC_HANDLE_MIN_LENGTH = 14
const SYNTHETIC_HANDLE_MAX_LENGTH = 56
const SYNTHETIC_HANDLE_POINT_EPSILON = 0.5

export interface OverlayAnchorPoint extends PositionData {
  id: string
  inHandle: PositionData | null
  outHandle: PositionData | null
}

export interface OverlaySubpath {
  points: OverlayAnchorPoint[]
  segmentIds: string[]
  closed: boolean
}

interface OverlaySegmentGeometry {
  id: string
  from: PositionData
  to: PositionData
  outHandle: PositionData | null
  inHandle: PositionData | null
  sampledPoints?: PositionData[]
}

interface OverlayVectorData {
  subpaths: OverlaySubpath[]
  segmentsById: Record<string, OverlaySegmentGeometry>
}

interface OverlayVectorDataCache {
  vectorId: string
  signature: string
  data: OverlayVectorData
}

interface ScreenOverlayVectorData {
  subpaths: OverlaySubpath[]
  segmentsById: Record<string, OverlaySegmentGeometry>
  flatPoints: OverlayAnchorPoint[]
}

interface ScreenOverlayVectorDataCache {
  source: OverlayVectorData
  viewportX: number
  viewportY: number
  viewportScale: number
  data: ScreenOverlayVectorData
}

interface OverlayDrawState {
  signature: string
}

interface VectorComputedData {
  x?: number
  y?: number
  pointCoordinateSpace?: 'workspace'
  points?: Record<string, VectorPointNode>
  segments?: Record<string, VectorSegment>
  networks?: Record<string, VectorNetwork>
}

interface SelectedVectorPointState {
  elementId: string
  pointId: string
  index: number
  target: VectorPointTarget
  x: number
  y: number
}

interface SelectedVectorSegmentState {
  elementId: string
  segmentId: string
}

interface HoveredVectorSegmentInsertPointState {
  elementId: string
  segmentId: string
  x: number
  y: number
}

interface VectorPointSelectionRef {
  elementId: string
  pointId: string
  target: VectorPointTarget
}

interface SelectedHandleAnchorRef {
  pointId: string
  index?: number | null
}

const PenPreviewMode = {
  NONE: 'none',
  CONNECTED_SEGMENT_PREVIEW: 'connected-segment-preview',
  SEGMENT_INSERT_PREVIEW: 'segment-insert-preview'
} as const

type PenPreviewMode = (typeof PenPreviewMode)[keyof typeof PenPreviewMode]

type RegisterRenderLayer = (
  registration: RenderLayerRegistration,
  options?: RegisterRenderLayerOptions
) => void

interface VectorPointSelectionReader {
  getSelectedIds(): Set<string>
}

interface VectorPathEditingRenderLayerDeps
  extends Pick<PresetDependencies, 'render' | 'sceneTree' | 'systemContext'> {
  getSelection: (type: string) => VectorPointSelectionReader | undefined
}

const measureVectorEditingOverlayPhase = <T>(
  phaseName: string,
  run: () => T
): T => {
  const sink = (
    globalThis as typeof globalThis & {
      __asyraVectorRenderPhaseSink?: (
        phaseName: string,
        durationMs: number
      ) => void
    }
  ).__asyraVectorRenderPhaseSink
  if (!sink) {
    return run()
  }

  const start = performance.now()
  try {
    return run()
  } finally {
    sink(phaseName, performance.now() - start)
  }
}

const emitStrokePipelineCounter = (counterName: string, value = 1) => {
  ;(
    globalThis as typeof globalThis & {
      __asyraStrokePipelineCounterSink?: (
        counterName: string,
        value: number
      ) => void
    }
  ).__asyraStrokePipelineCounterSink?.(counterName, value)
}

const getNumericSuffix = (value: string) => {
  const match = value.match(/[-_](\d+)$/)
  if (!match) {
    return Number.NaN
  }

  return Number.parseInt(match[1], 10)
}

const appendPositionSignature = (
  parts: string[],
  prefix: string,
  point: PositionData | null | undefined
) => {
  parts.push(prefix)
  if (!point) {
    parts.push('')
    return
  }

  parts.push(String(point.x), String(point.y))
}

const appendSelectedPointSignature = (
  parts: string[],
  prefix: string,
  point: SelectedVectorPointState | null
) => {
  parts.push(prefix)
  if (!point) {
    parts.push('')
    return
  }

  parts.push(
    point.elementId,
    point.pointId,
    String(point.index),
    point.target,
    String(point.x),
    String(point.y)
  )
}

const appendStringListSignature = (
  parts: string[],
  prefix: string,
  values: string[]
) => {
  parts.push(prefix, values.join(','))
}

const appendSelectedSegmentSignature = (
  parts: string[],
  prefix: string,
  segment: SelectedVectorSegmentState | null
) => {
  parts.push(prefix)
  if (!segment) {
    parts.push('')
    return
  }

  parts.push(segment.elementId, segment.segmentId)
}

const appendInsertPointSignature = (
  parts: string[],
  prefix: string,
  point: HoveredVectorSegmentInsertPointState | null
) => {
  parts.push(prefix)
  if (!point) {
    parts.push('')
    return
  }

  parts.push(point.elementId, point.segmentId, String(point.x), String(point.y))
}

const buildOverlayDrawSignature = (input: {
  vectorModelSignature: string
  viewportPosition: PositionData
  viewportScale: number
  mousePosition: PositionData
  primaryTool: string | null | undefined
  pathEditingVectorId: string | null
  selectedVectorPoint: SelectedVectorPointState | null
  selectedVectorPointSelectionIds: string[]
  hoveredVectorPoint: SelectedVectorPointState | null
  selectedVectorSegment: SelectedVectorSegmentState | null
  hoveredVectorSegment: SelectedVectorSegmentState | null
  hoveredVectorSegmentInsertPoint: HoveredVectorSegmentInsertPointState | null
  startNewSubpath: boolean
}) => {
  const parts = [
    'draw',
    input.vectorModelSignature,
    String(input.viewportPosition.x),
    String(input.viewportPosition.y),
    String(input.viewportScale),
    input.primaryTool ?? '',
    input.pathEditingVectorId ?? '',
    input.startNewSubpath ? '1' : '0'
  ]
  appendPositionSignature(parts, 'mouse', input.mousePosition)
  appendSelectedPointSignature(
    parts,
    'selected-point',
    input.selectedVectorPoint
  )
  appendStringListSignature(
    parts,
    'selected-point-ids',
    input.selectedVectorPointSelectionIds
  )
  appendSelectedPointSignature(parts, 'hovered-point', input.hoveredVectorPoint)
  appendSelectedSegmentSignature(
    parts,
    'selected-segment',
    input.selectedVectorSegment
  )
  appendSelectedSegmentSignature(
    parts,
    'hovered-segment',
    input.hoveredVectorSegment
  )
  appendInsertPointSignature(
    parts,
    'insert-point',
    input.hoveredVectorSegmentInsertPoint
  )
  return parts.join('|')
}

const sortByStableId = <T extends { id: string }>(items: T[]): T[] =>
  [...items].sort((a, b) => {
    const aRank = getNumericSuffix(a.id)
    const bRank = getNumericSuffix(b.id)
    if (!Number.isNaN(aRank) && !Number.isNaN(bRank)) {
      return aRank - bRank
    }

    return a.id.localeCompare(b.id)
  })

const appendSortedVectorPointSignature = (
  parts: string[],
  points: NonNullable<VectorComputedData['points']>
) => {
  Object.keys(points)
    .sort()
    .forEach((pointId) => {
      const point = points[pointId]
      if (!point) {
        return
      }

      parts.push('p', pointId, point.kind, String(point.x), String(point.y))
      if (point.kind === VECTOR_TOKENS.POINT.KIND.CONTROL) {
        parts.push(point.controlForId ?? '', point.controlRole ?? '')
      }
    })
}

const appendSortedVectorSegmentSignature = (
  parts: string[],
  segments: NonNullable<VectorComputedData['segments']>
) => {
  Object.keys(segments)
    .sort()
    .forEach((segmentId) => {
      const segment = segments[segmentId]
      if (!segment) {
        return
      }

      parts.push(
        's',
        segmentId,
        segment.startId,
        segment.endId,
        segment.inControlId ?? '',
        segment.outControlId ?? ''
      )
    })
}

const appendSortedVectorNetworkSignature = (
  parts: string[],
  networks: NonNullable<VectorComputedData['networks']>
) => {
  Object.keys(networks)
    .sort()
    .forEach((networkId) => {
      const network = networks[networkId]
      if (!network) {
        return
      }

      parts.push(
        'n',
        networkId,
        network.closed ? '1' : '0',
        network.pointIds.join(','),
        network.segmentIds.join(',')
      )
    })
}

const buildOverlayVectorDataSignature = (
  computed: Required<
    Pick<VectorComputedData, 'points' | 'segments' | 'networks'>
  > &
    Pick<VectorComputedData, 'x' | 'y' | 'pointCoordinateSpace'>,
  offsetX: number,
  offsetY: number
) => {
  const parts = [
    'o',
    computed.pointCoordinateSpace ?? 'legacy-local',
    String(offsetX),
    String(offsetY)
  ]
  appendSortedVectorPointSignature(parts, computed.points)
  appendSortedVectorSegmentSignature(parts, computed.segments)
  appendSortedVectorNetworkSignature(parts, computed.networks)
  return parts.join('|')
}

const getControlId = (
  anchorId: string,
  role:
    | typeof VECTOR_TOKENS.CONTROL.ROLE.IN
    | typeof VECTOR_TOKENS.CONTROL.ROLE.OUT
) => `${anchorId}:${role}`

const decodeSelectionToken = (value: string) => {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

const decodeVectorPointSelectionId = (
  value: string
): VectorPointSelectionRef | null => {
  const parts = value.split(':')
  if (parts.length !== 3) {
    return null
  }

  const elementId = decodeSelectionToken(parts[0])
  const pointId = decodeSelectionToken(parts[1])
  const target = decodeSelectionToken(parts[2])
  if (
    !elementId ||
    !pointId ||
    (target !== VECTOR_TOKENS.POINT.TARGET.ANCHOR &&
      target !== VECTOR_TOKENS.POINT.TARGET.IN_HANDLE &&
      target !== VECTOR_TOKENS.POINT.TARGET.OUT_HANDLE)
  ) {
    return null
  }

  return {
    elementId,
    pointId,
    target
  }
}

interface AnchorHandleRefs {
  inControlId: string | null
  outControlId: string | null
}

export const getNetworkAnchorHandleRefs = (
  network: Pick<VectorNetwork, 'pointIds' | 'segmentIds'>,
  segments: Record<string, VectorSegment>
): Map<string, AnchorHandleRefs> => {
  const refs = new Map<string, AnchorHandleRefs>()
  network.pointIds.forEach((pointId) => {
    refs.set(pointId, {
      inControlId: null,
      outControlId: null
    })
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

const toScreenPosition = (
  point: PositionData,
  viewportPosition: PositionData,
  viewportScale: number
): PositionData => ({
  x: point.x * viewportScale + viewportPosition.x,
  y: point.y * viewportScale + viewportPosition.y
})

const getDistance = (from: PositionData, to: PositionData): number =>
  Math.hypot(to.x - from.x, to.y - from.y)

const isVisibleHandlePosition = (
  anchor: PositionData,
  handle: PositionData | null | undefined
): handle is PositionData =>
  !!handle && getDistance(anchor, handle) > SYNTHETIC_HANDLE_POINT_EPSILON

const clampSyntheticHandleLength = (
  desiredLength: number,
  segmentLength: number
): number => {
  if (segmentLength <= SYNTHETIC_HANDLE_POINT_EPSILON) {
    return 0
  }

  return Math.min(
    SYNTHETIC_HANDLE_MAX_LENGTH,
    segmentLength * 0.45,
    Math.max(SYNTHETIC_HANDLE_MIN_LENGTH, desiredLength)
  )
}

const createSyntheticHandlePosition = (
  anchor: PositionData,
  neighbor: PositionData | null,
  mirroredHandle: PositionData | null
): PositionData | null => {
  if (!neighbor) {
    return null
  }

  const dx = neighbor.x - anchor.x
  const dy = neighbor.y - anchor.y
  const segmentLength = Math.hypot(dx, dy)
  if (segmentLength <= SYNTHETIC_HANDLE_POINT_EPSILON) {
    return null
  }

  const mirroredLength = isVisibleHandlePosition(anchor, mirroredHandle)
    ? getDistance(anchor, mirroredHandle)
    : segmentLength / 3
  const handleLength = clampSyntheticHandleLength(mirroredLength, segmentLength)
  if (handleLength <= SYNTHETIC_HANDLE_POINT_EPSILON) {
    return null
  }

  const scale = handleLength / segmentLength
  return {
    x: anchor.x + dx * scale,
    y: anchor.y + dy * scale
  }
}

export const resolveOverlayHandlePosition = (
  anchor: PositionData,
  actualHandle: PositionData | null | undefined,
  neighbor: PositionData | null,
  mirroredHandle: PositionData | null
): PositionData | null => {
  if (isVisibleHandlePosition(anchor, actualHandle)) {
    return { x: actualHandle.x, y: actualHandle.y }
  }

  return createSyntheticHandlePosition(anchor, neighbor, mirroredHandle)
}

const getPathEditingVectorDataWithDeps = (
  deps: Pick<PresetDependencies, 'sceneTree' | 'systemContext'>,
  cache?: { current: OverlayVectorDataCache | null }
): OverlayVectorData | null => {
  const pathEditingVectorId = deps.systemContext.getManagedProperty<
    string | null
  >('pathEditingVectorId')
  if (!pathEditingVectorId) {
    if (cache) {
      cache.current = null
    }
    return null
  }

  const element = deps.sceneTree.getElementById(pathEditingVectorId)
  if (!element || element.get('type') !== 'vector') {
    if (cache) {
      cache.current = null
    }
    return null
  }

  const computed = element.getAllComputedData() as VectorComputedData
  if (!computed.points || !computed.segments || !computed.networks) {
    if (cache) {
      cache.current = null
    }
    return null
  }
  const computedPoints = computed.points
  const computedSegments = computed.segments
  const computedNetworks = computed.networks
  const usesWorkspacePoints = computed.pointCoordinateSpace === 'workspace'
  const offsetX =
    usesWorkspacePoints || typeof computed.x !== 'number' ? 0 : computed.x
  const offsetY =
    usesWorkspacePoints || typeof computed.y !== 'number' ? 0 : computed.y
  const signature = measureVectorEditingOverlayPhase(
    'editing-overlay:model-signature',
    () =>
      buildOverlayVectorDataSignature(
        {
          points: computedPoints,
          segments: computedSegments,
          networks: computedNetworks,
          x: computed.x,
          y: computed.y,
          pointCoordinateSpace: computed.pointCoordinateSpace
        },
        offsetX,
        offsetY
      )
  )
  const cached = cache?.current
  if (
    cached &&
    cached.vectorId === pathEditingVectorId &&
    cached.signature === signature
  ) {
    emitStrokePipelineCounter('editing-overlay-model-cache-hit')
    return cached.data
  }

  emitStrokePipelineCounter('editing-overlay-model-cache-miss')
  emitStrokePipelineCounter('editing-overlay-full-topology-walk')
  emitStrokePipelineCounter(
    'editing-overlay-walk-point-count',
    Object.keys(computedPoints).length
  )
  emitStrokePipelineCounter(
    'editing-overlay-walk-segment-count',
    Object.keys(computedSegments).length
  )
  emitStrokePipelineCounter(
    'editing-overlay-walk-network-count',
    Object.keys(computedNetworks).length
  )

  const orderedNetworks = sortByStableId(Object.values(computedNetworks))
  const subpaths: OverlaySubpath[] = []
  const segmentsById: Record<string, OverlaySegmentGeometry> = {}

  orderedNetworks.forEach((network) => {
    const points: OverlayAnchorPoint[] = []
    const anchorHandleRefs = getNetworkAnchorHandleRefs(
      network,
      computedSegments
    )

    network.pointIds.forEach((pointId, pointIndex) => {
      const anchor = computedPoints[pointId]
      if (!anchor || anchor.kind !== VECTOR_TOKENS.POINT.KIND.ANCHOR) {
        return
      }

      const handleRefs = anchorHandleRefs.get(pointId)
      const inHandle =
        handleRefs?.inControlId &&
        computedPoints[handleRefs.inControlId]?.kind ===
          VECTOR_TOKENS.POINT.KIND.CONTROL
          ? computedPoints[handleRefs.inControlId]
          : computedPoints[getControlId(pointId, VECTOR_TOKENS.CONTROL.ROLE.IN)]
      const outHandle =
        handleRefs?.outControlId &&
        computedPoints[handleRefs.outControlId]?.kind ===
          VECTOR_TOKENS.POINT.KIND.CONTROL
          ? computedPoints[handleRefs.outControlId]
          : computedPoints[
              getControlId(pointId, VECTOR_TOKENS.CONTROL.ROLE.OUT)
            ]
      const previousPointId =
        pointIndex > 0
          ? network.pointIds[pointIndex - 1]
          : network.closed
            ? network.pointIds[network.pointIds.length - 1]
            : null
      const nextPointId =
        pointIndex < network.pointIds.length - 1
          ? network.pointIds[pointIndex + 1]
          : network.closed
            ? network.pointIds[0]
            : null
      const previousAnchor = previousPointId
        ? computedPoints[previousPointId]
        : null
      const nextAnchor = nextPointId ? computedPoints[nextPointId] : null
      const anchorPosition = {
        x: anchor.x + offsetX,
        y: anchor.y + offsetY
      }
      const actualInHandle =
        inHandle && inHandle.kind === VECTOR_TOKENS.POINT.KIND.CONTROL
          ? { x: inHandle.x + offsetX, y: inHandle.y + offsetY }
          : null
      const actualOutHandle =
        outHandle && outHandle.kind === VECTOR_TOKENS.POINT.KIND.CONTROL
          ? { x: outHandle.x + offsetX, y: outHandle.y + offsetY }
          : null

      points.push({
        id: pointId,
        ...anchorPosition,
        inHandle: resolveOverlayHandlePosition(
          anchorPosition,
          actualInHandle,
          previousAnchor &&
            previousAnchor.kind === VECTOR_TOKENS.POINT.KIND.ANCHOR
            ? { x: previousAnchor.x + offsetX, y: previousAnchor.y + offsetY }
            : null,
          actualOutHandle
        ),
        outHandle: resolveOverlayHandlePosition(
          anchorPosition,
          actualOutHandle,
          nextAnchor && nextAnchor.kind === VECTOR_TOKENS.POINT.KIND.ANCHOR
            ? { x: nextAnchor.x + offsetX, y: nextAnchor.y + offsetY }
            : null,
          actualInHandle
        )
      })
    })

    network.segmentIds.forEach((segmentId) => {
      const segment = computedSegments[segmentId]
      if (!segment) {
        return
      }

      const start = computedPoints[segment.startId]
      const end = computedPoints[segment.endId]
      if (
        !start ||
        !end ||
        start.kind !== VECTOR_TOKENS.POINT.KIND.ANCHOR ||
        end.kind !== VECTOR_TOKENS.POINT.KIND.ANCHOR
      ) {
        return
      }

      const outControl =
        segment.outControlId &&
        computedPoints[segment.outControlId]?.kind ===
          VECTOR_TOKENS.POINT.KIND.CONTROL
          ? computedPoints[segment.outControlId]
          : null
      const inControl =
        segment.inControlId &&
        computedPoints[segment.inControlId]?.kind ===
          VECTOR_TOKENS.POINT.KIND.CONTROL
          ? computedPoints[segment.inControlId]
          : null

      segmentsById[segmentId] = {
        id: segmentId,
        from: { x: start.x + offsetX, y: start.y + offsetY },
        to: { x: end.x + offsetX, y: end.y + offsetY },
        outHandle: outControl
          ? { x: outControl.x + offsetX, y: outControl.y + offsetY }
          : null,
        inHandle: inControl
          ? { x: inControl.x + offsetX, y: inControl.y + offsetY }
          : null
      }
    })

    if (points.length > 0) {
      subpaths.push({
        points,
        segmentIds: [...network.segmentIds],
        closed: network.closed
      })
    }
  })

  if (subpaths.length === 0) {
    if (cache) {
      cache.current = null
    }
    return null
  }

  const data = {
    subpaths,
    segmentsById
  }

  if (cache) {
    cache.current = {
      vectorId: pathEditingVectorId,
      signature,
      data
    }
  }

  return data
}

const projectOverlayVectorDataToScreen = (
  vectorData: OverlayVectorData,
  viewportPosition: PositionData,
  viewportScale: number,
  cache?: { current: ScreenOverlayVectorDataCache | null }
): ScreenOverlayVectorData => {
  const cached = cache?.current
  if (
    cached &&
    cached.source === vectorData &&
    cached.viewportX === viewportPosition.x &&
    cached.viewportY === viewportPosition.y &&
    cached.viewportScale === viewportScale
  ) {
    emitStrokePipelineCounter('editing-overlay-screen-cache-hit')
    return cached.data
  }

  emitStrokePipelineCounter('editing-overlay-screen-cache-miss')
  const subpaths = vectorData.subpaths.map((subpath) => ({
    closed: subpath.closed,
    segmentIds: [...subpath.segmentIds],
    points: subpath.points.map((point) => ({
      id: point.id,
      x: point.x * viewportScale + viewportPosition.x,
      y: point.y * viewportScale + viewportPosition.y,
      inHandle: point.inHandle
        ? toScreenPosition(point.inHandle, viewportPosition, viewportScale)
        : null,
      outHandle: point.outHandle
        ? toScreenPosition(point.outHandle, viewportPosition, viewportScale)
        : null
    }))
  }))
  const segmentsById = Object.fromEntries(
    Object.entries(vectorData.segmentsById).map(([segmentId, segment]) => [
      segmentId,
      (() => {
        const from = toScreenPosition(
          segment.from,
          viewportPosition,
          viewportScale
        )
        const to = toScreenPosition(segment.to, viewportPosition, viewportScale)
        const inHandle = segment.inHandle
          ? toScreenPosition(segment.inHandle, viewportPosition, viewportScale)
          : null
        const outHandle = segment.outHandle
          ? toScreenPosition(segment.outHandle, viewportPosition, viewportScale)
          : null
        return {
          ...segment,
          from,
          to,
          inHandle,
          outHandle,
          sampledPoints:
            outHandle || inHandle
              ? sampleOverlayBezierPoints(
                  from,
                  outHandle ?? from,
                  inHandle ?? to,
                  to
                )
              : undefined
        }
      })()
    ])
  ) as Record<string, OverlaySegmentGeometry>
  const data = {
    subpaths,
    segmentsById,
    flatPoints: subpaths.flatMap((subpath) => subpath.points)
  }

  if (cache) {
    cache.current = {
      source: vectorData,
      viewportX: viewportPosition.x,
      viewportY: viewportPosition.y,
      viewportScale,
      data
    }
  }

  return data
}

const getDiamondPoints = (
  center: PositionData,
  radius: number
): PositionData[] => [
  { x: center.x, y: center.y - radius },
  { x: center.x + radius, y: center.y },
  { x: center.x, y: center.y + radius },
  { x: center.x - radius, y: center.y }
]

const drawSegment = (
  canvas: OverlayCanvas,
  segment: Pick<
    OverlaySegmentGeometry,
    'from' | 'to' | 'outHandle' | 'inHandle' | 'sampledPoints'
  >,
  stroke: OverlayStrokeStyle
) => {
  if (segment.sampledPoints) {
    canvas.polyline(segment.sampledPoints, stroke)
    return
  }

  const hasCurve = !!segment.outHandle || !!segment.inHandle
  if (!hasCurve) {
    canvas.line(segment.from, segment.to, stroke)
    return
  }

  canvas.bezierCurve(
    segment.from,
    segment.outHandle ?? segment.from,
    segment.inHandle ?? segment.to,
    segment.to,
    stroke
  )
}

const drawSubpathSegments = (
  canvas: OverlayCanvas,
  subpath: OverlaySubpath,
  segmentsById: Record<string, OverlaySegmentGeometry>
) => {
  if (subpath.segmentIds.length === 0) {
    return
  }

  const stroke: OverlayStrokeStyle = {
    width: SEGMENT_WIDTH,
    color: SEGMENT_COLOR
  }

  subpath.segmentIds.forEach((segmentId) => {
    const segment = segmentsById[segmentId]
    if (!segment) {
      return
    }
    drawSegment(canvas, segment, stroke)
  })
}

const drawHighlightedSegments = (
  canvas: OverlayCanvas,
  segmentsById: Record<string, OverlaySegmentGeometry>,
  selectedSegmentId: string | null,
  hoveredSegmentId: string | null
) => {
  if (selectedSegmentId) {
    const selectedSegment = segmentsById[selectedSegmentId]
    if (selectedSegment) {
      drawSegment(canvas, selectedSegment, SELECTED_SEGMENT_STROKE)
    }
  }

  if (!hoveredSegmentId || hoveredSegmentId === selectedSegmentId) {
    return
  }

  const hoveredSegment = segmentsById[hoveredSegmentId]
  if (!hoveredSegment) {
    return
  }

  drawSegment(canvas, hoveredSegment, HOVER_SEGMENT_STROKE)
}

const drawHandleLines = (
  canvas: OverlayCanvas,
  points: OverlayAnchorPoint[],
  visibleAnchorIds: Set<string>
) => {
  points.forEach((point) => {
    if (!visibleAnchorIds.has(point.id)) {
      return
    }

    if (point.inHandle) {
      canvas.line(point, point.inHandle, {
        width: SEGMENT_WIDTH,
        color: SEGMENT_COLOR
      })
    }

    if (point.outHandle) {
      canvas.line(point, point.outHandle, {
        width: SEGMENT_WIDTH,
        color: SEGMENT_COLOR
      })
    }
  })
}

const drawAnchorPoints = (
  canvas: OverlayCanvas,
  points: OverlayAnchorPoint[],
  selectedPointId: string | null,
  selectedTarget: VectorPointTarget | null,
  hoveredPointId: string | null,
  hoveredTarget: VectorPointTarget | null
) => {
  points.forEach((point) => {
    canvas.circle(point, POINT_RADIUS, POINT_FILL_COLOR, {
      width: 1,
      color: POINT_STROKE_COLOR
    })

    const isSelectedAnchor =
      selectedPointId === point.id &&
      selectedTarget === VECTOR_TOKENS.POINT.TARGET.ANCHOR
    const isHoveredAnchor =
      !isSelectedAnchor &&
      hoveredPointId === point.id &&
      hoveredTarget === VECTOR_TOKENS.POINT.TARGET.ANCHOR

    if (isHoveredAnchor) {
      canvas.circle(point, HOVER_OUTLINE_RADIUS, POINT_FILL_COLOR, {
        width: HOVER_OUTLINE_WIDTH,
        color: HOVER_COLOR
      })
    }

    if (isSelectedAnchor) {
      canvas.circle(point, SELECTED_POINT_OUTLINE_RADIUS, POINT_FILL_COLOR, {
        width: SELECTED_POINT_OUTLINE_WIDTH,
        color: SELECTED_POINT_OUTLINE_COLOR
      })
    }
  })
}

const drawHandlePoints = (
  canvas: OverlayCanvas,
  points: OverlayAnchorPoint[],
  visibleAnchorIds: Set<string>,
  selectedPointId: string | null,
  selectedTarget: VectorPointTarget | null,
  hoveredPointId: string | null,
  hoveredTarget: VectorPointTarget | null
) => {
  points.forEach((point) => {
    if (!visibleAnchorIds.has(point.id)) {
      return
    }

    const handles: {
      target: Exclude<
        VectorPointTarget,
        typeof VECTOR_TOKENS.POINT.TARGET.ANCHOR
      >
      position: PositionData | null
    }[] = [
      {
        target: VECTOR_TOKENS.POINT.TARGET.IN_HANDLE,
        position: point.inHandle
      },
      {
        target: VECTOR_TOKENS.POINT.TARGET.OUT_HANDLE,
        position: point.outHandle
      }
    ]

    handles.forEach(({ target, position }) => {
      if (!position) {
        return
      }

      canvas.polygon(
        getDiamondPoints(position, POINT_RADIUS),
        POINT_FILL_COLOR,
        {
          width: 1,
          color: HANDLE_STROKE_COLOR
        }
      )

      const isSelectedHandle =
        selectedPointId === point.id && selectedTarget === target
      const isHoveredHandle =
        !isSelectedHandle &&
        hoveredPointId === point.id &&
        hoveredTarget === target

      if (isHoveredHandle) {
        canvas.polygon(
          getDiamondPoints(position, HOVER_OUTLINE_RADIUS),
          POINT_FILL_COLOR,
          {
            width: HOVER_OUTLINE_WIDTH,
            color: HOVER_COLOR
          }
        )
      }

      if (isSelectedHandle) {
        canvas.polygon(
          getDiamondPoints(position, SELECTED_POINT_OUTLINE_RADIUS),
          POINT_FILL_COLOR,
          {
            width: SELECTED_POINT_OUTLINE_WIDTH,
            color: SELECTED_POINT_OUTLINE_COLOR
          }
        )
      }
    })
  })
}

const appendVisibleHandleAnchorIdsForSubpathIndex = (
  visibleIds: Set<string>,
  subpath: OverlaySubpath,
  index: number
) => {
  const pointCount = subpath.points.length
  const offsets = [-1, 0, 1]
  offsets.forEach((offset) => {
    const rawIndex = index + offset
    if (!subpath.closed) {
      if (rawIndex < 0 || rawIndex >= pointCount) {
        return
      }

      visibleIds.add(subpath.points[rawIndex].id)
      return
    }

    const wrappedIndex = ((rawIndex % pointCount) + pointCount) % pointCount
    visibleIds.add(subpath.points[wrappedIndex].id)
  })
}

const appendVisibleHandleAnchorIdsForSelection = (
  visibleIds: Set<string>,
  subpaths: OverlaySubpath[],
  selection: SelectedHandleAnchorRef
) => {
  const selectedAnchorId = selection.pointId

  if (typeof selection.index === 'number' && selection.index >= 0) {
    let flatStartIndex = 0
    for (const subpath of subpaths) {
      const pointCount = subpath.points.length
      const flatEndIndex = flatStartIndex + pointCount
      if (selection.index >= flatStartIndex && selection.index < flatEndIndex) {
        const index = selection.index - flatStartIndex
        const selectedPoint = subpath.points[index]
        if (selectedPoint?.id === selectedAnchorId) {
          appendVisibleHandleAnchorIdsForSubpathIndex(
            visibleIds,
            subpath,
            index
          )
          return
        }
      }

      flatStartIndex = flatEndIndex
    }
  }

  for (const subpath of subpaths) {
    const index = subpath.points.findIndex(
      (point) => point.id === selectedAnchorId
    )
    if (index === -1) {
      continue
    }

    appendVisibleHandleAnchorIdsForSubpathIndex(visibleIds, subpath, index)
    return
  }
}

export const getVisibleHandleAnchorIds = (
  subpaths: OverlaySubpath[],
  selections: SelectedHandleAnchorRef[]
): Set<string> => {
  const visibleIds = new Set<string>()
  selections.forEach((selection) =>
    appendVisibleHandleAnchorIdsForSelection(visibleIds, subpaths, selection)
  )
  return visibleIds
}

const isSubpathEndpoint = (
  subpaths: OverlaySubpath[],
  pointId: string
): boolean =>
  subpaths.some((subpath) => {
    if (subpath.points.length === 0) {
      return false
    }

    const firstPoint = subpath.points[0]
    const lastPoint = subpath.points[subpath.points.length - 1]
    return firstPoint.id === pointId || lastPoint.id === pointId
  })

const drawPreview = (
  canvas: OverlayCanvas,
  lastPoint: OverlayAnchorPoint,
  mouseScreenPos: PositionData,
  shouldRender: boolean,
  handleSide: 'in' | 'out'
) => {
  if (!shouldRender) {
    return
  }

  const handle = handleSide === 'in' ? lastPoint.inHandle : lastPoint.outHandle
  const hasCurve = !!handle
  if (!hasCurve) {
    canvas.line(lastPoint, mouseScreenPos, {
      width: PREVIEW_WIDTH,
      color: SEGMENT_COLOR
    })
    return
  }

  canvas.bezierCurve(
    lastPoint,
    handle ?? lastPoint,
    mouseScreenPos,
    mouseScreenPos,
    {
      width: PREVIEW_WIDTH,
      color: SEGMENT_COLOR
    }
  )
}

const drawGhostInsertPoint = (
  canvas: OverlayCanvas,
  point: PositionData | null
) => {
  if (!point) {
    return
  }

  canvas.circle(point, POINT_RADIUS, GHOST_POINT_FILL_COLOR, {
    width: GHOST_POINT_STROKE_WIDTH,
    color: GHOST_POINT_STROKE_COLOR
  })
}

export const registerVectorPathEditingRenderLayer = (
  registerRenderLayer: RegisterRenderLayer,
  deps: VectorPathEditingRenderLayerDeps
) => {
  const vectorDataCache: { current: OverlayVectorDataCache | null } = {
    current: null
  }
  const screenDataCache: { current: ScreenOverlayVectorDataCache | null } = {
    current: null
  }
  const drawState: { current: OverlayDrawState | null } = {
    current: null
  }
  const layerRegistration = createOverlayLayerRegistration({
    name: VECTOR_EDITING_LAYER_NAME,
    zIndex: 10,
    update: (canvas: OverlayCanvas) => {
      const vectorData = measureVectorEditingOverlayPhase(
        'editing-overlay:model',
        () => getPathEditingVectorDataWithDeps(deps, vectorDataCache)
      )
      if (!vectorData) {
        screenDataCache.current = null
        if (drawState.current?.signature !== 'empty') {
          canvas.clear()
          drawState.current = { signature: 'empty' }
          return true
        }
        return false
      }
      const vectorModelSignature =
        vectorDataCache.current?.data === vectorData
          ? vectorDataCache.current.signature
          : ''

      const viewportPosition = deps.render.getViewportPosition()
      const viewportScale = deps.render.getViewportScale()
      const snapshot = deps.systemContext.getSystemContextSnapshot()
      const pathEditingVectorId =
        deps.systemContext.getManagedProperty<string | null>(
          'pathEditingVectorId'
        ) ?? null
      const selectedVectorPoint =
        deps.systemContext.getManagedProperty<SelectedVectorPointState | null>(
          'selectedVectorPoint'
        ) ?? null
      const selectedVectorPointSelectionIds = Array.from(
        deps.getSelection(SelectionChannels.VECTOR_POINT)?.getSelectedIds() ??
          []
      ).sort()
      const hoveredVectorPoint =
        deps.systemContext.getManagedProperty<SelectedVectorPointState | null>(
          'hoveredVectorPoint'
        ) ?? null
      const selectedVectorSegment =
        deps.systemContext.getManagedProperty<SelectedVectorSegmentState | null>(
          'selectedVectorSegment'
        ) ?? null
      const hoveredVectorSegment =
        deps.systemContext.getManagedProperty<SelectedVectorSegmentState | null>(
          'hoveredVectorSegment'
        ) ?? null
      const hoveredVectorSegmentInsertPoint =
        deps.systemContext.getManagedProperty<HoveredVectorSegmentInsertPointState | null>(
          'hoveredVectorSegmentInsertPoint'
        ) ?? null
      const startNewSubpath =
        deps.systemContext.getManagedProperty<boolean>(
          'pathEditingStartNewSubpath'
        ) ?? false
      const drawSignature = buildOverlayDrawSignature({
        vectorModelSignature,
        viewportPosition,
        viewportScale,
        mousePosition: snapshot.mousePosition,
        primaryTool: snapshot.primaryTool,
        pathEditingVectorId,
        selectedVectorPoint,
        selectedVectorPointSelectionIds,
        hoveredVectorPoint,
        selectedVectorSegment,
        hoveredVectorSegment,
        hoveredVectorSegmentInsertPoint,
        startNewSubpath
      })
      if (drawState.current?.signature === drawSignature) {
        emitStrokePipelineCounter('editing-overlay-draw-cache-hit')
        return false
      }
      emitStrokePipelineCounter('editing-overlay-draw-cache-miss')
      drawState.current = { signature: drawSignature }
      canvas.clear()

      const activeSelectedPoint =
        pathEditingVectorId &&
        selectedVectorPoint?.elementId === pathEditingVectorId &&
        selectedVectorPoint?.pointId
          ? selectedVectorPoint
          : null
      const selectedPointRefs = selectedVectorPointSelectionIds
        .map((id) => decodeVectorPointSelectionId(id))
        .filter(
          (selection): selection is VectorPointSelectionRef =>
            selection !== null && selection.elementId === pathEditingVectorId
        )
      const selectedHandleAnchorRefs: SelectedHandleAnchorRef[] =
        selectedPointRefs.length > 0
          ? selectedPointRefs.map((selection) => ({
              pointId: selection.pointId,
              index:
                activeSelectedPoint?.pointId === selection.pointId
                  ? activeSelectedPoint.index
                  : null
            }))
          : activeSelectedPoint
            ? [
                {
                  pointId: activeSelectedPoint.pointId,
                  index: activeSelectedPoint.index
                }
              ]
            : []
      const activeHoveredPoint =
        pathEditingVectorId &&
        hoveredVectorPoint?.elementId === pathEditingVectorId &&
        hoveredVectorPoint?.pointId
          ? hoveredVectorPoint
          : null
      const activeSelectedSegmentId =
        pathEditingVectorId &&
        selectedVectorSegment?.elementId === pathEditingVectorId &&
        selectedVectorSegment?.segmentId
          ? selectedVectorSegment.segmentId
          : null
      const activeHoveredSegmentId =
        activeHoveredPoint ||
        !pathEditingVectorId ||
        hoveredVectorSegment?.elementId !== pathEditingVectorId ||
        !hoveredVectorSegment.segmentId
          ? null
          : hoveredVectorSegment.segmentId

      const mouseWorkspacePos = deps.render.getMousePosInWorkspace({
        clientX: snapshot.mousePosition.x,
        clientY: snapshot.mousePosition.y
      })
      const mouseScreenPos = toScreenPosition(
        mouseWorkspacePos,
        viewportPosition,
        viewportScale
      )

      const screenData = measureVectorEditingOverlayPhase(
        'editing-overlay:screen-project',
        () =>
          projectOverlayVectorDataToScreen(
            vectorData,
            viewportPosition,
            viewportScale,
            screenDataCache
          )
      )
      const screenSubpaths = screenData.subpaths
      const screenSegmentsById = screenData.segmentsById
      const flatScreenPoints = screenData.flatPoints
      const lastSubpath = screenSubpaths[screenSubpaths.length - 1]
      const defaultPreviewStartPoint =
        lastSubpath.points[lastSubpath.points.length - 1]
      const selectedPreviewPoint =
        activeSelectedPoint !== null
          ? (flatScreenPoints.find(
              (point) => point.id === activeSelectedPoint.pointId
            ) ?? null)
          : null
      const previewStartPoint =
        selectedPreviewPoint &&
        isSubpathEndpoint(screenSubpaths, selectedPreviewPoint.id)
          ? selectedPreviewPoint
          : defaultPreviewStartPoint
      const previewHandleSide: 'in' | 'out' = (() => {
        if (!previewStartPoint) {
          return 'out'
        }

        const matchingSubpath = screenSubpaths.find((subpath) => {
          if (subpath.points.length === 0) {
            return false
          }
          const firstPoint = subpath.points[0]
          const lastPoint = subpath.points[subpath.points.length - 1]
          return (
            firstPoint.id === previewStartPoint.id ||
            lastPoint.id === previewStartPoint.id
          )
        })

        if (!matchingSubpath || matchingSubpath.points.length === 0) {
          return 'out'
        }

        const firstPoint = matchingSubpath.points[0]
        if (firstPoint.id === previewStartPoint.id) {
          return 'in'
        }

        return 'out'
      })()
      const shouldRenderPreview =
        snapshot.primaryTool === 'pen' &&
        !startNewSubpath &&
        previewStartPoint !== null
      const previewMode: PenPreviewMode =
        snapshot.primaryTool !== 'pen'
          ? PenPreviewMode.NONE
          : shouldRenderPreview
            ? PenPreviewMode.CONNECTED_SEGMENT_PREVIEW
            : PenPreviewMode.SEGMENT_INSERT_PREVIEW
      const activeGhostInsertPoint =
        activeHoveredPoint ||
        previewMode !== PenPreviewMode.SEGMENT_INSERT_PREVIEW ||
        !pathEditingVectorId ||
        !activeHoveredSegmentId ||
        hoveredVectorSegmentInsertPoint?.elementId !== pathEditingVectorId ||
        hoveredVectorSegmentInsertPoint?.segmentId !== activeHoveredSegmentId
          ? null
          : toScreenPosition(
              {
                x: hoveredVectorSegmentInsertPoint.x,
                y: hoveredVectorSegmentInsertPoint.y
              },
              viewportPosition,
              viewportScale
            )
      const visibleHandleAnchorIds = getVisibleHandleAnchorIds(
        screenSubpaths,
        selectedHandleAnchorRefs
      )

      measureVectorEditingOverlayPhase('editing-overlay:draw', () => {
        screenSubpaths.forEach((subpath) =>
          drawSubpathSegments(canvas, subpath, screenSegmentsById)
        )
        drawHighlightedSegments(
          canvas,
          screenSegmentsById,
          activeSelectedSegmentId,
          activeHoveredSegmentId
        )
        drawHandleLines(canvas, flatScreenPoints, visibleHandleAnchorIds)
        if (previewStartPoint) {
          drawPreview(
            canvas,
            previewStartPoint,
            mouseScreenPos,
            shouldRenderPreview,
            previewHandleSide
          )
        }
        drawGhostInsertPoint(canvas, activeGhostInsertPoint)
        drawAnchorPoints(
          canvas,
          flatScreenPoints,
          activeSelectedPoint?.pointId ?? null,
          activeSelectedPoint?.target ?? null,
          activeHoveredPoint?.pointId ?? null,
          activeHoveredPoint?.target ?? null
        )
        drawHandlePoints(
          canvas,
          flatScreenPoints,
          visibleHandleAnchorIds,
          activeSelectedPoint?.pointId ?? null,
          activeSelectedPoint?.target ?? null,
          activeHoveredPoint?.pointId ?? null,
          activeHoveredPoint?.target ?? null
        )
      })
      return true
    }
  })

  registerRenderLayer(layerRegistration, { override: true })
}
