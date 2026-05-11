import {
  VECTOR_TOKENS,
  createOverlayLayerRegistration,
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
}

interface OverlayVectorData {
  subpaths: OverlaySubpath[]
  segmentsById: Record<string, OverlaySegmentGeometry>
}

interface VectorComputedData {
  x?: number
  y?: number
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

const sortByStableId = <T extends { id: string }>(items: T[]): T[] =>
  [...items].sort((a, b) => {
    const aRank = getNumericSuffix(a.id)
    const bRank = getNumericSuffix(b.id)
    if (!Number.isNaN(aRank) && !Number.isNaN(bRank)) {
      return aRank - bRank
    }

    return a.id.localeCompare(b.id)
  })

const getControlId = (
  anchorId: string,
  role:
    | typeof VECTOR_TOKENS.CONTROL.ROLE.IN
    | typeof VECTOR_TOKENS.CONTROL.ROLE.OUT
) => `${anchorId}:${role}`

const toScreenPosition = (
  point: PositionData,
  viewportPosition: PositionData,
  viewportScale: number
): PositionData => ({
  x: point.x * viewportScale + viewportPosition.x,
  y: point.y * viewportScale + viewportPosition.y
})

const getPathEditingVectorDataWithDeps = (
  deps: Pick<PresetDependencies, 'sceneTree' | 'systemContext'>
): OverlayVectorData | null => {
  const pathEditingVectorId = deps.systemContext.getManagedProperty<
    string | null
  >('pathEditingVectorId')
  if (!pathEditingVectorId) {
    return null
  }

  const element = deps.sceneTree.getElementById(pathEditingVectorId)
  if (!element || element.get('type') !== 'vector') {
    return null
  }

  const computed = element.getAllComputedData() as VectorComputedData
  if (!computed.points || !computed.segments || !computed.networks) {
    return null
  }
  emitStrokePipelineCounter('editing-overlay-full-topology-walk')
  emitStrokePipelineCounter(
    'editing-overlay-walk-point-count',
    Object.keys(computed.points).length
  )
  emitStrokePipelineCounter(
    'editing-overlay-walk-segment-count',
    Object.keys(computed.segments).length
  )
  emitStrokePipelineCounter(
    'editing-overlay-walk-network-count',
    Object.keys(computed.networks).length
  )

  const offsetX = typeof computed.x === 'number' ? computed.x : 0
  const offsetY = typeof computed.y === 'number' ? computed.y : 0
  const orderedNetworks = sortByStableId(Object.values(computed.networks))
  const subpaths: OverlaySubpath[] = []
  const segmentsById: Record<string, OverlaySegmentGeometry> = {}

  orderedNetworks.forEach((network) => {
    const points: OverlayAnchorPoint[] = []

    network.pointIds.forEach((pointId) => {
      const anchor = computed.points?.[pointId]
      if (!anchor || anchor.kind !== VECTOR_TOKENS.POINT.KIND.ANCHOR) {
        return
      }

      const inHandle =
        computed.points?.[getControlId(pointId, VECTOR_TOKENS.CONTROL.ROLE.IN)]
      const outHandle =
        computed.points?.[getControlId(pointId, VECTOR_TOKENS.CONTROL.ROLE.OUT)]

      points.push({
        id: pointId,
        x: anchor.x + offsetX,
        y: anchor.y + offsetY,
        inHandle:
          inHandle && inHandle.kind === VECTOR_TOKENS.POINT.KIND.CONTROL
            ? { x: inHandle.x + offsetX, y: inHandle.y + offsetY }
            : null,
        outHandle:
          outHandle && outHandle.kind === VECTOR_TOKENS.POINT.KIND.CONTROL
            ? { x: outHandle.x + offsetX, y: outHandle.y + offsetY }
            : null
      })
    })

    network.segmentIds.forEach((segmentId) => {
      const segment = computed.segments?.[segmentId]
      if (!segment) {
        return
      }

      const start = computed.points?.[segment.startId]
      const end = computed.points?.[segment.endId]
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
        computed.points?.[segment.outControlId]?.kind ===
          VECTOR_TOKENS.POINT.KIND.CONTROL
          ? computed.points[segment.outControlId]
          : null
      const inControl =
        segment.inControlId &&
        computed.points?.[segment.inControlId]?.kind ===
          VECTOR_TOKENS.POINT.KIND.CONTROL
          ? computed.points[segment.inControlId]
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
    return null
  }

  return {
    subpaths,
    segmentsById
  }
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
    'from' | 'to' | 'outHandle' | 'inHandle'
  >,
  stroke: OverlayStrokeStyle
) => {
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

export const getVisibleHandleAnchorIds = (
  subpaths: OverlaySubpath[],
  selectedAnchorId: string | null
): Set<string> => {
  if (!selectedAnchorId) {
    return new Set()
  }

  for (const subpath of subpaths) {
    const index = subpath.points.findIndex(
      (point) => point.id === selectedAnchorId
    )
    if (index === -1) {
      continue
    }

    const visibleIds = new Set<string>()
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

    return visibleIds
  }

  return new Set()
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
  deps: Pick<PresetDependencies, 'render' | 'sceneTree' | 'systemContext'>
) => {
  const layerRegistration = createOverlayLayerRegistration({
    name: VECTOR_EDITING_LAYER_NAME,
    zIndex: 10,
    update: (canvas: OverlayCanvas) => {
      canvas.clear()

      const vectorData = measureVectorEditingOverlayPhase(
        'editing-overlay:model',
        () => getPathEditingVectorDataWithDeps(deps)
      )
      if (!vectorData) {
        return
      }

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
      const activeSelectedPoint =
        pathEditingVectorId &&
        selectedVectorPoint?.elementId === pathEditingVectorId &&
        selectedVectorPoint?.pointId
          ? selectedVectorPoint
          : null
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

      const screenSubpaths = vectorData.subpaths.map((subpath) => ({
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
      const screenSegmentsById = Object.fromEntries(
        Object.entries(vectorData.segmentsById).map(([segmentId, segment]) => [
          segmentId,
          {
            ...segment,
            from: toScreenPosition(
              segment.from,
              viewportPosition,
              viewportScale
            ),
            to: toScreenPosition(segment.to, viewportPosition, viewportScale),
            inHandle: segment.inHandle
              ? toScreenPosition(
                  segment.inHandle,
                  viewportPosition,
                  viewportScale
                )
              : null,
            outHandle: segment.outHandle
              ? toScreenPosition(
                  segment.outHandle,
                  viewportPosition,
                  viewportScale
                )
              : null
          }
        ])
      ) as Record<string, OverlaySegmentGeometry>

      const flatScreenPoints = screenSubpaths.flatMap(
        (subpath) => subpath.points
      )
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
        activeSelectedPoint?.pointId ?? null
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
    }
  })

  registerRenderLayer(layerRegistration, { override: true })
}
