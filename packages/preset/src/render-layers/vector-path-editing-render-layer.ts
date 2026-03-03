import {
  VECTOR_TOKENS,
  createOverlayLayerRegistration,
  type OverlayCanvas
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

const SELECTED_POINT_OUTLINE_COLOR = 0x1e90ff
const SELECTED_POINT_OUTLINE_WIDTH = 2
const SELECTED_POINT_OUTLINE_RADIUS = POINT_RADIUS + 3

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

const getControlId = (
  anchorId: string,
  role:
    | typeof VECTOR_TOKENS.CONTROL.ROLE.IN
    | typeof VECTOR_TOKENS.CONTROL.ROLE.OUT
) =>
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
      if (!anchor || anchor.kind !== VECTOR_TOKENS.POINT.KIND.ANCHOR) {
        return
      }

      const inHandle = computed.points?.[
        getControlId(pointId, VECTOR_TOKENS.CONTROL.ROLE.IN)
      ]
      const outHandle = computed.points?.[
        getControlId(pointId, VECTOR_TOKENS.CONTROL.ROLE.OUT)
      ]

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
  selectedTarget: VectorPointTarget | null
) => {
  points.forEach((point) => {
    canvas.circle(point, POINT_RADIUS, POINT_FILL_COLOR, {
      width: 1,
      color: POINT_STROKE_COLOR
    })
  })

  if (!selectedPointId || selectedTarget !== VECTOR_TOKENS.POINT.TARGET.ANCHOR) {
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
  visibleAnchorIds: Set<string>,
  selectedPointId: string | null,
  selectedTarget: VectorPointTarget | null
) => {
  points.forEach((point) => {
    if (!visibleAnchorIds.has(point.id)) {
      return
    }

    const handles: {
      target: Exclude<VectorPointTarget, typeof VECTOR_TOKENS.POINT.TARGET.ANCHOR>
      position: PositionData | null
    }[] = [
      { target: VECTOR_TOKENS.POINT.TARGET.IN_HANDLE, position: point.inHandle },
      { target: VECTOR_TOKENS.POINT.TARGET.OUT_HANDLE, position: point.outHandle }
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

const getVisibleHandleAnchorIds = (
  subpaths: OverlaySubpath[],
  selectedAnchorId: string | null
): Set<string> => {
  if (!selectedAnchorId) {
    return new Set()
  }

  for (const subpath of subpaths) {
    const index = subpath.points.findIndex((point) => point.id === selectedAnchorId)
    if (index === -1) {
      continue
    }

    const visibleIds = new Set<string>()
    const indexes = [index - 1, index, index + 1]
    indexes.forEach((targetIndex) => {
      if (targetIndex < 0 || targetIndex >= subpath.points.length) {
        return
      }

      visibleIds.add(subpath.points[targetIndex].id)
    })

    return visibleIds
  }

  return new Set()
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
        clientX: snapshot.mousePosition.x,
        clientY: snapshot.mousePosition.y
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
      const visibleHandleAnchorIds = getVisibleHandleAnchorIds(
        screenSubpaths,
        activeSelectedPoint?.pointId ?? null
      )

      screenSubpaths.forEach((subpath) => drawSubpathSegments(canvas, subpath))
      drawHandleLines(canvas, flatScreenPoints, visibleHandleAnchorIds)
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
        visibleHandleAnchorIds,
        activeSelectedPoint?.pointId ?? null,
        activeSelectedPoint?.target ?? null
      )
    }
  })

  registerRenderLayer(layerRegistration, { override: true })
}
