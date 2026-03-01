import { createOverlayLayerRegistration, type OverlayCanvas } from '@asyra/core'
import type { PositionData } from '@asyra/utils'
import type {
  RegisterRenderLayerOptions,
  RenderLayerRegistration
} from '@asyra/core'
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

interface VectorAnchorPointLike extends PositionData {
  id: string
  type: 'smooth' | 'sharp'
  isMove?: boolean
  inHandle: PositionData | null
  outHandle: PositionData | null
}

type VectorPointTarget = 'anchor' | 'inHandle' | 'outHandle'

interface OverlayAnchorPoint extends PositionData {
  id: string
  isMove?: boolean
  inHandle: PositionData | null
  outHandle: PositionData | null
}

interface VectorComputedData {
  x?: number
  y?: number
  width?: number
  height?: number
  closed?: boolean
  anchorPoints?: VectorAnchorPointLike[]
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

const toWorkspacePoint = (
  point: VectorAnchorPointLike,
  computed: Pick<VectorComputedData, 'x' | 'y' | 'width' | 'height'>
): OverlayAnchorPoint => {
  const x = typeof computed.x === 'number' ? computed.x : 0
  const y = typeof computed.y === 'number' ? computed.y : 0
  const width = typeof computed.width === 'number' ? computed.width : 0
  const height = typeof computed.height === 'number' ? computed.height : 0

  const isLikelyLocal =
    point.x >= -1 &&
    point.x <= width + 1 &&
    point.y >= -1 &&
    point.y <= height + 1

  const toWorkspaceHandle = (handle: PositionData | null) => {
    if (!handle) {
      return null
    }

    if (!isLikelyLocal) {
      return handle
    }

    return {
      x: handle.x + x,
      y: handle.y + y
    }
  }

  if (!isLikelyLocal) {
    return {
      id: point.id,
      x: point.x,
      y: point.y,
      isMove: point.isMove,
      inHandle: toWorkspaceHandle(point.inHandle),
      outHandle: toWorkspaceHandle(point.outHandle)
    }
  }

  return {
    id: point.id,
    x: point.x + x,
    y: point.y + y,
    isMove: point.isMove,
    inHandle: toWorkspaceHandle(point.inHandle),
    outHandle: toWorkspaceHandle(point.outHandle)
  }
}

const toScreenPosition = (
  point: PositionData,
  viewportPosition: PositionData,
  viewportScale: number
): PositionData => {
  return {
    x: point.x * viewportScale + viewportPosition.x,
    y: point.y * viewportScale + viewportPosition.y
  }
}

const toScreenAnchorPoint = (
  point: OverlayAnchorPoint,
  viewportPosition: PositionData,
  viewportScale: number
): OverlayAnchorPoint => {
  return {
    id: point.id,
    x: point.x * viewportScale + viewportPosition.x,
    y: point.y * viewportScale + viewportPosition.y,
    isMove: point.isMove,
    inHandle: point.inHandle
      ? toScreenPosition(point.inHandle, viewportPosition, viewportScale)
      : null,
    outHandle: point.outHandle
      ? toScreenPosition(point.outHandle, viewportPosition, viewportScale)
      : null
  }
}

const getPathEditingVectorDataWithDeps = (
  deps: Pick<PresetDependencies, 'sceneTree' | 'systemContext'>
): {
  closed: boolean
  anchorPoints: OverlayAnchorPoint[]
} | null => {
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
  if (
    !Array.isArray(computed.anchorPoints) ||
    computed.anchorPoints.length === 0
  ) {
    return null
  }

  return {
    closed: computed.closed === true,
    anchorPoints: computed.anchorPoints.map((point) =>
      toWorkspacePoint(point, computed)
    )
  }
}

const getDiamondPoints = (
  center: PositionData,
  radius: number
): PositionData[] => {
  return [
    { x: center.x, y: center.y - radius },
    { x: center.x + radius, y: center.y },
    { x: center.x, y: center.y + radius },
    { x: center.x - radius, y: center.y }
  ]
}

const drawSegments = (
  canvas: OverlayCanvas,
  points: OverlayAnchorPoint[],
  closed: boolean
) => {
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

  let prev = points[0]
  for (let i = 1; i < points.length; i++) {
    const current = points[i]
    if (current.isMove) {
      prev = current
      continue
    }

    drawSegment(prev, current)
    prev = current
  }

  const first = points[0]
  const last = points[points.length - 1]
  if (closed && !first.isMove && !last.isMove) {
    drawSegment(last, first)
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

      const data = getPathEditingVectorDataWithDeps(deps)
      if (!data || data.anchorPoints.length === 0) {
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
      const screenPoints = data.anchorPoints.map((point) =>
        toScreenAnchorPoint(point, viewportPosition, viewportScale)
      )
      const previewStartPoint =
        activeSelectedPoint !== null
          ? (screenPoints.find(
              (point) => point.id === activeSelectedPoint.pointId
            ) ?? null)
          : null
      const shouldRenderPreview =
        snapshot.primaryTool === 'pen' &&
        !startNewSubpath &&
        previewStartPoint !== null

      drawSegments(canvas, screenPoints, data.closed)
      drawHandleLines(canvas, screenPoints)
      drawPreview(
        canvas,
        previewStartPoint ?? screenPoints[screenPoints.length - 1],
        mouseScreenPos,
        shouldRenderPreview
      )
      drawAnchorPoints(
        canvas,
        screenPoints,
        activeSelectedPoint?.pointId ?? null,
        activeSelectedPoint?.target ?? null
      )
      drawHandlePoints(
        canvas,
        screenPoints,
        activeSelectedPoint?.pointId ?? null,
        activeSelectedPoint?.target ?? null
      )
    }
  })

  registerRenderLayer(layerRegistration, { override: true })
}
