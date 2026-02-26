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
const SEGMENT_COLOR = 0x9ca3af
const SEGMENT_WIDTH = 1
const PREVIEW_WIDTH = 2

interface VectorAnchorPointLike extends PositionData {
  id: string
  type: 'smooth' | 'sharp'
  isMove?: boolean
  inHandle: PositionData | null
  outHandle: PositionData | null
}

interface OverlayAnchorPoint extends PositionData {
  id: string
  isMove?: boolean
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

  if (!isLikelyLocal) {
    return { id: point.id, x: point.x, y: point.y, isMove: point.isMove }
  }

  return {
    id: point.id,
    x: point.x + x,
    y: point.y + y,
    isMove: point.isMove
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
    isMove: point.isMove
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

const getPathEditingVectorDataWithDeps = (
  deps: Pick<PresetDependencies, 'sceneTree' | 'systemContext'>
): {
  closed: boolean
  anchorPoints: OverlayAnchorPoint[]
} | null => {
  const pathEditingVectorId =
    deps.systemContext.getManagedProperty<string | null>('pathEditingVectorId')
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

const drawSegments = (
  canvas: OverlayCanvas,
  points: OverlayAnchorPoint[],
  closed: boolean
) => {
  if (points.length < 2) {
    return
  }

  let prev = points[0]
  for (let i = 1; i < points.length; i++) {
    const current = points[i]
    if (current.isMove) {
      prev = current
      continue
    }

    canvas.line(prev, current, {
      width: SEGMENT_WIDTH,
      color: SEGMENT_COLOR
    })
    prev = current
  }

  if (closed) {
    canvas.line(points[points.length - 1], points[0], {
      width: SEGMENT_WIDTH,
      color: SEGMENT_COLOR
    })
  }
}

const SELECTED_POINT_OUTLINE_COLOR = 0x1e90ff
const SELECTED_POINT_OUTLINE_WIDTH = 2
const SELECTED_POINT_OUTLINE_RADIUS = POINT_RADIUS + 3

const drawPoints = (
  canvas: OverlayCanvas,
  points: OverlayAnchorPoint[],
  selectedPointId: string | null
) => {
  points.forEach((point) => {
    canvas.circle(point, POINT_RADIUS, POINT_FILL_COLOR, {
      width: 1,
      color: POINT_STROKE_COLOR
    })
  })

  if (!selectedPointId) {
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

const drawPreview = (
  canvas: OverlayCanvas,
  lastPoint: PositionData,
  mouseScreenPos: PositionData,
  shouldRender: boolean
) => {
  if (!shouldRender) {
    return
  }

  canvas.line(lastPoint, mouseScreenPos, {
    width: PREVIEW_WIDTH,
    color: SEGMENT_COLOR
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
      const activeSelectedPointId =
        pathEditingVectorId &&
        selectedVectorPoint?.elementId === pathEditingVectorId &&
        selectedVectorPoint?.pointId
          ? selectedVectorPoint.pointId
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
        activeSelectedPointId !== null
          ? screenPoints.find((point) => point.id === activeSelectedPointId) ??
            null
          : null
      const shouldRenderPreview =
        snapshot.primaryTool === 'pen' &&
        !startNewSubpath &&
        previewStartPoint !== null

      drawSegments(canvas, screenPoints, data.closed)
      drawPreview(
        canvas,
        previewStartPoint ?? screenPoints[screenPoints.length - 1],
        mouseScreenPos,
        shouldRenderPreview
      )
      drawPoints(canvas, screenPoints, activeSelectedPointId)
    }
  })

  registerRenderLayer(layerRegistration, { override: true })
}
