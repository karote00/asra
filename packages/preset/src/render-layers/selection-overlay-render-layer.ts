import {
  VECTOR_TOKENS,
  createOverlayLayerRegistration,
  renderSelectionStore,
  type OverlayCanvas
} from '@asyra/core'
import type {
  RegisterRenderLayerOptions,
  RenderLayerRegistration,
  VectorNetwork,
  VectorPointNode,
  VectorSegment
} from '@asyra/core'
import type { PositionData } from '@asyra/utils'
import type { PresetDependencies } from '../types'

const SELECTION_OVERLAY_LAYER_NAME = 'selection-overlay-layer'
const SELECTION_STROKE_COLOR = 0x157ae7
const STROKE_WIDTH = 2
const VECTOR_HOVER_STROKE_WIDTH = 2

interface LocalBounds {
  x: number
  y: number
  width: number
  height: number
}

interface TransformMatrix {
  a: number
  b: number
  c: number
  d: number
  tx: number
  ty: number
}

interface RenderElementShape {
  getBounds: () => LocalBounds
  worldTransform: TransformMatrix
}

interface VectorComputedData {
  width?: number
  height?: number
  points?: Record<string, VectorPointNode>
  segments?: Record<string, VectorSegment>
  networks?: Record<string, VectorNetwork>
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

const transformPoint = (
  matrix: TransformMatrix,
  point: PositionData
): PositionData => ({
  x: matrix.a * point.x + matrix.c * point.y + matrix.tx,
  y: matrix.b * point.x + matrix.d * point.y + matrix.ty
})

const getBoundsCorners = (
  element: RenderElementShape
): [PositionData, PositionData, PositionData, PositionData] => {
  const bounds = element.getBounds()
  const topLeft = { x: bounds.x, y: bounds.y }
  const topRight = { x: bounds.x + bounds.width, y: bounds.y }
  const bottomRight = {
    x: bounds.x + bounds.width,
    y: bounds.y + bounds.height
  }
  const bottomLeft = { x: bounds.x, y: bounds.y + bounds.height }

  return [topLeft, topRight, bottomRight, bottomLeft]
}

const drawOutline = (
  canvas: OverlayCanvas,
  points: [PositionData, PositionData, PositionData, PositionData],
  color: number,
  width: number
) => {
  canvas.line(points[0], points[1], { color, width })
  canvas.line(points[1], points[2], { color, width })
  canvas.line(points[2], points[3], { color, width })
  canvas.line(points[3], points[0], { color, width })
}

const drawElementBoundsOutline = (
  canvas: OverlayCanvas,
  element: RenderElementShape,
  color: number,
  width: number
) => {
  drawOutline(canvas, getBoundsCorners(element), color, width)
}

const drawBoundsOutline = (
  canvas: OverlayCanvas,
  bounds: LocalBounds,
  color: number,
  width: number
) => {
  const topLeft = { x: bounds.x, y: bounds.y }
  const topRight = { x: bounds.x + bounds.width, y: bounds.y }
  const bottomRight = {
    x: bounds.x + bounds.width,
    y: bounds.y + bounds.height
  }
  const bottomLeft = { x: bounds.x, y: bounds.y + bounds.height }

  drawOutline(canvas, [topLeft, topRight, bottomRight, bottomLeft], color, width)
}

const getElementType = (
  deps: Pick<PresetDependencies, 'sceneTree'>,
  elementId: string
) => deps.sceneTree.getElementById(elementId)?.get('type')

const drawRectGeometryOutline = (
  canvas: OverlayCanvas,
  matrix: TransformMatrix,
  width: number,
  height: number
) => {
  const p0 = transformPoint(matrix, { x: 0, y: 0 })
  const p1 = transformPoint(matrix, { x: width, y: 0 })
  const p2 = transformPoint(matrix, { x: width, y: height })
  const p3 = transformPoint(matrix, { x: 0, y: height })

  drawOutline(canvas, [p0, p1, p2, p3], SELECTION_STROKE_COLOR, STROKE_WIDTH)
}

const drawOvalGeometryOutline = (
  canvas: OverlayCanvas,
  matrix: TransformMatrix,
  width: number,
  height: number
) => {
  const radiusX = width / 2
  const radiusY = height / 2
  const center = { x: radiusX, y: radiusY }
  const segmentCount = 48

  let firstPoint: PositionData | null = null
  let previousPoint: PositionData | null = null

  for (let i = 0; i <= segmentCount; i += 1) {
    const t = (i / segmentCount) * Math.PI * 2
    const localPoint = {
      x: center.x + Math.cos(t) * radiusX,
      y: center.y + Math.sin(t) * radiusY
    }
    const worldPoint = transformPoint(matrix, localPoint)

    if (!firstPoint) {
      firstPoint = worldPoint
      previousPoint = worldPoint
      continue
    }

    if (previousPoint) {
      canvas.line(previousPoint, worldPoint, {
        width: STROKE_WIDTH,
        color: SELECTION_STROKE_COLOR
      })
    }
    previousPoint = worldPoint
  }

  if (previousPoint && firstPoint) {
    canvas.line(previousPoint, firstPoint, {
      width: STROKE_WIDTH,
      color: SELECTION_STROKE_COLOR
    })
  }
}

const drawVectorHoverOutline = (
  canvas: OverlayCanvas,
  deps: Pick<PresetDependencies, 'sceneTree'>,
  elementId: string,
  matrix: TransformMatrix
) => {
  const element = deps.sceneTree.getElementById(elementId)
  if (!element) {
    return false
  }

  const computed = element.getAllComputedData() as VectorComputedData
  const points = computed.points
  const segments = computed.segments
  const networks = computed.networks
  if (!points || !segments || !networks) {
    return false
  }

  const orderedNetworks = sortByStableId(Object.values(networks))
  if (orderedNetworks.length === 0) {
    return false
  }

  let hasDrawn = false

  orderedNetworks.forEach((network) => {
    network.segmentIds.forEach((segmentId) => {
      const segment = segments[segmentId]
      if (!segment) {
        return
      }

      const start = points[segment.startId]
      const end = points[segment.endId]
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
        points[segment.outControlId]?.kind === VECTOR_TOKENS.POINT.KIND.CONTROL
          ? points[segment.outControlId]
          : null
      const inControl =
        segment.inControlId &&
        points[segment.inControlId]?.kind === VECTOR_TOKENS.POINT.KIND.CONTROL
          ? points[segment.inControlId]
          : null

      const startPoint = transformPoint(matrix, { x: start.x, y: start.y })
      const endPoint = transformPoint(matrix, { x: end.x, y: end.y })

      if (!outControl && !inControl) {
        canvas.line(startPoint, endPoint, {
          width: VECTOR_HOVER_STROKE_WIDTH,
          color: SELECTION_STROKE_COLOR
        })
        hasDrawn = true
        return
      }

      const control1 = transformPoint(matrix, {
        x: outControl?.x ?? start.x,
        y: outControl?.y ?? start.y
      })
      const control2 = transformPoint(matrix, {
        x: inControl?.x ?? end.x,
        y: inControl?.y ?? end.y
      })

      canvas.bezierCurve(startPoint, control1, control2, endPoint, {
        width: VECTOR_HOVER_STROKE_WIDTH,
        color: SELECTION_STROKE_COLOR
      })
      hasDrawn = true
    })
  })

  return hasDrawn
}

const drawHoverGeometryOutline = (
  canvas: OverlayCanvas,
  deps: Pick<PresetDependencies, 'sceneTree'>,
  elementId: string,
  hoveredElement: RenderElementShape
) => {
  const type = getElementType(deps, elementId)
  if (!type) {
    drawElementBoundsOutline(
      canvas,
      hoveredElement,
      SELECTION_STROKE_COLOR,
      STROKE_WIDTH
    )
    return
  }

  if (type === 'vector') {
    const hasVectorOutline = drawVectorHoverOutline(
      canvas,
      deps,
      elementId,
      hoveredElement.worldTransform
    )
    if (hasVectorOutline) {
      return
    }
  }

  const hoveredSceneElement = deps.sceneTree.getElementById(elementId)
  const computed = hoveredSceneElement?.getAllComputedData() as
    | VectorComputedData
    | undefined
  const width = computed?.width
  const height = computed?.height

  if (typeof width === 'number' && typeof height === 'number') {
    if (type === 'oval') {
      drawOvalGeometryOutline(
        canvas,
        hoveredElement.worldTransform,
        width,
        height
      )
      return
    }
    if (type === 'rect') {
      drawRectGeometryOutline(
        canvas,
        hoveredElement.worldTransform,
        width,
        height
      )
      return
    }
  }

  drawElementBoundsOutline(
    canvas,
    hoveredElement,
    SELECTION_STROKE_COLOR,
    STROKE_WIDTH
  )
}

const getSingleSelectedElementId = (): string | null => {
  const selected = [...renderSelectionStore.elementSelection]
  if (selected.length !== 1) {
    return null
  }

  return selected[0]
}

const getMultiSelectionBounds = (
  deps: Pick<PresetDependencies, 'render'>,
  selectedIds: string[]
): LocalBounds | null => {
  if (selectedIds.length === 0) {
    return null
  }

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  selectedIds.forEach((elementId) => {
    const element = deps.render.getElementById(
      elementId
    ) as RenderElementShape | null
    if (!element) {
      return
    }

    const bounds = element.getBounds()
    minX = Math.min(minX, bounds.x)
    minY = Math.min(minY, bounds.y)
    maxX = Math.max(maxX, bounds.x + bounds.width)
    maxY = Math.max(maxY, bounds.y + bounds.height)
  })

  if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
    return null
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  }
}

export const registerSelectionOverlayRenderLayer = (
  registerRenderLayer: RegisterRenderLayer,
  deps: Pick<PresetDependencies, 'render' | 'sceneTree' | 'systemContext'>
) => {
  const layerRegistration = createOverlayLayerRegistration({
    name: SELECTION_OVERLAY_LAYER_NAME,
    zIndex: 8,
    update: (canvas: OverlayCanvas) => {
      canvas.clear()

      const pathEditingVectorId =
        deps.systemContext.getManagedProperty<string | null>(
          'pathEditingVectorId'
        ) ?? null

      const selectedIds = [...renderSelectionStore.elementSelection]
      const selectedElementId = selectedIds.length === 1 ? selectedIds[0] : null
      if (!pathEditingVectorId && selectedIds.length > 0) {
        if (selectedElementId) {
          const selectedElement = deps.render.getElementById(
            selectedElementId
          ) as RenderElementShape | null

          if (selectedElement) {
            drawElementBoundsOutline(
              canvas,
              selectedElement,
              SELECTION_STROKE_COLOR,
              STROKE_WIDTH
            )
          }
        } else {
          const bounds = getMultiSelectionBounds(deps, selectedIds)
          if (bounds) {
            drawBoundsOutline(
              canvas,
              bounds,
              SELECTION_STROKE_COLOR,
              STROKE_WIDTH
            )
          }
        }
      }

      const hoveredElementId =
        deps.systemContext.getManagedProperty<string | null>(
          'hoveredElementId'
        ) ?? null
      if (
        !hoveredElementId ||
        hoveredElementId === selectedElementId ||
        selectedIds.includes(hoveredElementId)
      ) {
        return
      }

      const hoveredElement = deps.render.getElementById(
        hoveredElementId
      ) as RenderElementShape | null
      if (!hoveredElement) {
        return
      }

      drawHoverGeometryOutline(canvas, deps, hoveredElementId, hoveredElement)
    }
  })

  registerRenderLayer(layerRegistration, { override: true })
}
