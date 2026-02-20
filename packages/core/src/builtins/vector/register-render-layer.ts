import {
  createOverlayLayerRegistration,
  type OverlayCanvas
} from '@asyra/render'
import type { Render } from '@asyra/render'
import sceneTree from '@asyra/scene-tree'
import systemContext from '@asyra/system-context'
import type { PositionData } from '@asyra/utils'
import type {
  RegisterRenderLayerOptions,
  RenderLayerRegistration
} from '../../types/render'

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

interface VectorComputedData {
  x?: number
  y?: number
  width?: number
  height?: number
  closed?: boolean
  anchorPoints?: VectorAnchorPointLike[]
}

type RegisterRenderLayer = (
  registration: RenderLayerRegistration,
  options?: RegisterRenderLayerOptions
) => void

const toWorkspacePoint = (
  point: VectorAnchorPointLike,
  computed: Pick<VectorComputedData, 'x' | 'y' | 'width' | 'height'>
): PositionData & { isMove?: boolean } => {
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
    return { x: point.x, y: point.y, isMove: point.isMove }
  }

  return {
    x: point.x + x,
    y: point.y + y,
    isMove: point.isMove
  }
}

const toScreenPoint = (
  point: PositionData & { isMove?: boolean },
  viewportPosition: PositionData,
  viewportScale: number
): PositionData & { isMove?: boolean } => {
  return {
    x: point.x * viewportScale + viewportPosition.x,
    y: point.y * viewportScale + viewportPosition.y,
    isMove: point.isMove
  }
}

const getPathEditingVectorData = (): {
  closed: boolean
  anchorPoints: Array<PositionData & { isMove?: boolean }>
} | null => {
  const pathEditingVectorId = systemContext.getManagedProperty<string | null>(
    'pathEditingVectorId'
  )
  if (!pathEditingVectorId) {
    return null
  }

  const element = sceneTree.getElementById(pathEditingVectorId)
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
  points: Array<PositionData & { isMove?: boolean }>,
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

const drawPoints = (canvas: OverlayCanvas, points: PositionData[]) => {
  points.forEach((point) => {
    canvas.circle(point, POINT_RADIUS, POINT_FILL_COLOR, {
      width: 1,
      color: POINT_STROKE_COLOR
    })
  })
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

export const registerVectorEditingRenderLayer = (
  registerRenderLayer: RegisterRenderLayer,
  render: Render
) => {
  const layerRegistration = createOverlayLayerRegistration({
    name: VECTOR_EDITING_LAYER_NAME,
    zIndex: 10,
    update: (canvas: OverlayCanvas) => {
      canvas.clear()

      const data = getPathEditingVectorData()
      if (!data || data.anchorPoints.length === 0) {
        return
      }

      const viewportPosition = render.getViewportPosition()
      const viewportScale = render.getViewportScale()
      const snapshot = systemContext.getSystemContextSnapshot()
      const startNewSubpath =
        systemContext.getManagedProperty<boolean>('pathEditingStartNewSubpath') ??
        false
      const shouldRenderPreview =
        snapshot.primaryTool === 'pen' && !startNewSubpath

      const mouseWorkspacePos = render.getMousePosInWorkspace({
        clientX: snapshot.mouse.position.x,
        clientY: snapshot.mouse.position.y
      })
      const mouseScreenPos = toScreenPoint(
        mouseWorkspacePos,
        viewportPosition,
        viewportScale
      )
      const screenPoints = data.anchorPoints.map((point) =>
        toScreenPoint(point, viewportPosition, viewportScale)
      )

      drawSegments(canvas, screenPoints, data.closed)
      drawPreview(
        canvas,
        screenPoints[screenPoints.length - 1],
        mouseScreenPos,
        shouldRenderPreview
      )
      drawPoints(canvas, screenPoints)
    }
  })

  registerRenderLayer(layerRegistration, { override: true })
}
