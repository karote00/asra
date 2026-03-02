import { createOverlayLayerRegistration, type OverlayCanvas } from '@asyra/core'
import type {
  RegisterRenderLayerOptions,
  RenderLayerRegistration,
  VectorNetwork,
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

const SELECTED_POINT_OUTLINE_COLOR = 0x1e90ff
const SELECTED_POINT_OUTLINE_WIDTH = 2
const SELECTED_POINT_OUTLINE_RADIUS = POINT_RADIUS + 3

type VectorPointTarget = 'anchor' | 'inHandle' | 'outHandle'

interface OverlayAnchorPoint extends PositionData {
  id: string
  inHandle: PositionData | null
  outHandle: PositionData | null
}

interface OverlaySubpath {
  points: OverlayAnchorPoint[]
  closed: boolean
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

type RegisterRenderLayer = (
  registration: RenderLayerRegistration,
  options?: RegisterRenderLayerOptions
) => void

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

const getControlId = (anchorId: string, role: 'in' | 'out') =>
  `${anchorId}:${role}`

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
): OverlaySubpath[] | null => {
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

  const offsetX = typeof computed.x === 'number' ? computed.x : 0
  const offsetY = typeof computed.y === 'number' ? computed.y : 0
  const orderedNetworks = sortByStableId(Object.values(computed.networks))
  const subpaths: OverlaySubpath[] = []

  orderedNetworks.forEach((network) => {
    const points: OverlayAnchorPoint[] = []
    network.pointIds.forEach((pointId) => {
      const anchor = computed.points?.[pointId]
      if (!anchor || anchor.kind !== 'anchor') {
        return
      }

      const inHandle = computed.points?.[getControlId(pointId, 'in')]
      const outHandle = computed.points?.[getControlId(pointId, 'out')]

      points.push({
        id: pointId,
        x: anchor.x + offsetX,
        y: anchor.y + offsetY,
        inHandle:
          inHandle && inHandle.kind === 'control'
            ? { x: inHandle.x + offsetX, y: inHandle.y + offsetY }
            : null,
        outHandle:
          outHandle && outHandle.kind === 'control'
            ? { x: outHandle.x + offsetX, y: outHandle.y + offsetY }
            : null
      })
    })

    if (points.length > 0) {
      subpaths.push({ points, closed: network.closed })
    }
  })

  return subpaths.length > 0 ? subpaths : null
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

const drawSubpathSegments = (
  canvas: OverlayCanvas,
  subpath: OverlaySubpath
) => {
  const points = subpath.points
  if (points.length < 2) {
    return
  }

  const drawSegment = (from: OverlayAnchorPoint, to: OverlayAnchorPoint) => {
    const hasCurve = !!from.outHandle || !!to.inHandle
    if (!hasCurve) {
      canvas.line(from, to, {
        width: SEGMENT_WIDTH,
        color: SEGMENT_COLOR
      })
      return
    }

    canvas.bezierCurve(from, from.outHandle ?? from, to.inHandle ?? to, to, {
      width: SEGMENT_WIDTH,
      color: SEGMENT_COLOR
    })
  }

  for (let i = 1; i < points.length; i += 1) {
    drawSegment(points[i - 1], points[i])
  }

  if (subpath.closed) {
    drawSegment(points[points.length - 1], points[0])
  }
}

const drawHandleLines = (
  canvas: OverlayCanvas,
  points: OverlayAnchorPoint[]
) => {
  points.forEach((point) => {
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
  selectedTarget: VectorPointTarget | null
) => {
  points.forEach((point) => {
    canvas.circle(point, POINT_RADIUS, POINT_FILL_COLOR, {
      width: 1,
      color: POINT_STROKE_COLOR
    })
  })

  if (!selectedPointId || selectedTarget !== 'anchor') {
    return
  }

  const selectedPoint = points.find((point) => point.id === selectedPointId)
  if (!selectedPoint) {
    return
  }

  canvas.circle(
    selectedPoint,
    SELECTED_POINT_OUTLINE_RADIUS,
    POINT_FILL_COLOR,
    {
      width: SELECTED_POINT_OUTLINE_WIDTH,
      color: SELECTED_POINT_OUTLINE_COLOR
    }
  )
}

const drawHandlePoints = (
  canvas: OverlayCanvas,
  points: OverlayAnchorPoint[],
  selectedPointId: string | null,
  selectedTarget: VectorPointTarget | null
) => {
  points.forEach((point) => {
    const handles: {
      target: Exclude<VectorPointTarget, 'anchor'>
      position: PositionData | null
    }[] = [
      { target: 'inHandle', position: point.inHandle },
      { target: 'outHandle', position: point.outHandle }
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

      if (selectedPointId === point.id && selectedTarget === target) {
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

const drawPreview = (
  canvas: OverlayCanvas,
  lastPoint: OverlayAnchorPoint,
  mouseScreenPos: PositionData,
  shouldRender: boolean
) => {
  if (!shouldRender) {
    return
  }

  const hasCurve = !!lastPoint.outHandle
  if (!hasCurve) {
    canvas.line(lastPoint, mouseScreenPos, {
      width: PREVIEW_WIDTH,
      color: SEGMENT_COLOR
    })
    return
  }

  canvas.bezierCurve(
    lastPoint,
    lastPoint.outHandle ?? lastPoint,
    mouseScreenPos,
    mouseScreenPos,
    {
      width: PREVIEW_WIDTH,
      color: SEGMENT_COLOR
    }
  )
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

      const subpaths = getPathEditingVectorDataWithDeps(deps)
      if (!subpaths || subpaths.length === 0) {
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

      const mouseWorkspacePos = deps.render.getMousePosInWorkspace({
        clientX: snapshot.mouse.position.x,
        clientY: snapshot.mouse.position.y
      })
      const mouseScreenPos = toScreenPosition(
        mouseWorkspacePos,
        viewportPosition,
        viewportScale
      )

      const screenSubpaths = subpaths.map((subpath) => ({
        closed: subpath.closed,
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

      const flatScreenPoints = screenSubpaths.flatMap(
        (subpath) => subpath.points
      )
      const lastSubpath = screenSubpaths[screenSubpaths.length - 1]
      const fallbackPreviewStartPoint =
        lastSubpath.points[lastSubpath.points.length - 1]
      const previewStartPoint =
        activeSelectedPoint !== null
          ? (flatScreenPoints.find(
              (point) => point.id === activeSelectedPoint.pointId
            ) ?? fallbackPreviewStartPoint)
          : fallbackPreviewStartPoint
      const shouldRenderPreview =
        snapshot.primaryTool === 'pen' &&
        !startNewSubpath &&
        previewStartPoint !== null

      screenSubpaths.forEach((subpath) => drawSubpathSegments(canvas, subpath))
      drawHandleLines(canvas, flatScreenPoints)
      if (previewStartPoint) {
        drawPreview(
          canvas,
          previewStartPoint,
          mouseScreenPos,
          shouldRenderPreview
        )
      }
      drawAnchorPoints(
        canvas,
        flatScreenPoints,
        activeSelectedPoint?.pointId ?? null,
        activeSelectedPoint?.target ?? null
      )
      drawHandlePoints(
        canvas,
        flatScreenPoints,
        activeSelectedPoint?.pointId ?? null,
        activeSelectedPoint?.target ?? null
      )
    }
  })

  registerRenderLayer(layerRegistration, { override: true })
}
