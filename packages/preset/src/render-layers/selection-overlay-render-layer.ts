import {
  VECTOR_TOKENS,
  createOverlayLayerRegistration,
  renderSelectionStore,
  sortVectorItemsById,
  type OverlayCanvas
} from '@asyra/core'
import type {
  RegisterRenderLayer,
  VectorNetwork,
  VectorPointNode,
  VectorSegment
} from '@asyra/core'
import {
  EntityTypes,
  getElementGeometryWorldBounds,
  projectWorkspacePointToViewport,
  transformGeometryPoint,
  type GeometryTransformMatrix,
  type PositionData,
  type Rect
} from '@asyra/utils'
import { SelectionChannels } from '../selection/channels'
import type { PresetDependencies } from '../types'
import { PresetSystemPropertyKeys } from '../system-property-keys'
import { getVectorRenderLocalPoint } from '../components/vector'

const SELECTION_OVERLAY_LAYER_NAME = 'selection-overlay-layer'
const SELECTION_STROKE_COLOR = 0x157ae7
export const SELECTION_OVERLAY_STROKE_WIDTH = 2
export const SELECTION_OVERLAY_VECTOR_HOVER_STROKE_WIDTH = 2

type LocalBounds = Rect

interface RenderElementShape {
  getBounds: () => LocalBounds
  worldTransform: GeometryTransformMatrix
}

interface ElementSelectionReader {
  getSelectedIds: () => Iterable<string>
}

interface VectorComputedData {
  x?: number
  y?: number
  width?: number
  height?: number
  pointCoordinateSpace?: 'workspace'
  points?: Record<string, VectorPointNode>
  segments?: Record<string, VectorSegment>
  networks?: Record<string, VectorNetwork>
}

interface GroupComputedData {
  x?: number
  y?: number
  width?: number
  height?: number
}

interface SelectionOverlayRenderLayerDeps
  extends Pick<PresetDependencies, 'render' | 'sceneTree' | 'systemContext'> {
  getSelection: (type: string) => ElementSelectionReader | undefined
}

const getElementSelectionIds = (deps: SelectionOverlayRenderLayerDeps) => {
  const selectedIds = Array.from(
    (
      deps.getSelection(SelectionChannels.ELEMENT) as
        | ElementSelectionReader
        | undefined
    )?.getSelectedIds() ?? []
  )
  return selectedIds.length > 0
    ? selectedIds
    : [...renderSelectionStore.elementSelection]
}

export const projectWorkspacePointToOverlayScreen = (
  point: PositionData,
  viewportPosition: PositionData,
  viewportScale: number
): PositionData =>
  projectWorkspacePointToViewport(point, viewportPosition, viewportScale)

const getBoundsCorners = (
  element: RenderElementShape
): [PositionData, PositionData, PositionData, PositionData] => {
  const bounds = getElementGeometryWorldBounds(element)
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

  drawOutline(
    canvas,
    [topLeft, topRight, bottomRight, bottomLeft],
    color,
    width
  )
}

const getElementType = (
  deps: Pick<PresetDependencies, 'sceneTree'>,
  elementId: string
) => deps.sceneTree.getElementById(elementId)?.get('type')

const isFiniteTransform = (matrix: GeometryTransformMatrix) =>
  [matrix.a, matrix.b, matrix.c, matrix.d, matrix.tx, matrix.ty].every(
    Number.isFinite
  )

const getGroupBoundsCorners = (
  deps: Pick<PresetDependencies, 'sceneTree'>,
  elementId: string,
  element: RenderElementShape
): [PositionData, PositionData, PositionData, PositionData] | null => {
  const sceneElement = deps.sceneTree.getElementById(elementId)
  if (!sceneElement || sceneElement.get('type') !== EntityTypes.GROUP) {
    return null
  }

  const computed = sceneElement.getAllComputedData() as GroupComputedData
  const { x, y, width, height } = computed
  if (
    ![x, y, width, height].every(Number.isFinite) ||
    typeof width !== 'number' ||
    typeof height !== 'number' ||
    width <= 0 ||
    height <= 0 ||
    !isFiniteTransform(element.worldTransform)
  ) {
    return null
  }

  return [
    transformGeometryPoint(element.worldTransform, { x: 0, y: 0 }),
    transformGeometryPoint(element.worldTransform, { x: width, y: 0 }),
    transformGeometryPoint(element.worldTransform, { x: width, y: height }),
    transformGeometryPoint(element.worldTransform, { x: 0, y: height })
  ]
}

const getCornersBounds = (
  corners: [PositionData, PositionData, PositionData, PositionData]
): LocalBounds => {
  const xValues = corners.map((point) => point.x)
  const yValues = corners.map((point) => point.y)
  const minX = Math.min(...xValues)
  const maxX = Math.max(...xValues)
  const minY = Math.min(...yValues)
  const maxY = Math.max(...yValues)

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  }
}

const getElementOverlayWorldBounds = (
  deps: Pick<PresetDependencies, 'sceneTree'>,
  elementId: string,
  element: RenderElementShape
): LocalBounds | null => {
  if (getElementType(deps, elementId) === EntityTypes.GROUP) {
    const corners = getGroupBoundsCorners(deps, elementId, element)
    return corners ? getCornersBounds(corners) : null
  }

  return getElementGeometryWorldBounds(element)
}

const drawRectGeometryOutline = (
  canvas: OverlayCanvas,
  matrix: GeometryTransformMatrix,
  width: number,
  height: number
) => {
  const p0 = transformGeometryPoint(matrix, { x: 0, y: 0 })
  const p1 = transformGeometryPoint(matrix, { x: width, y: 0 })
  const p2 = transformGeometryPoint(matrix, { x: width, y: height })
  const p3 = transformGeometryPoint(matrix, { x: 0, y: height })

  drawOutline(
    canvas,
    [p0, p1, p2, p3],
    SELECTION_STROKE_COLOR,
    SELECTION_OVERLAY_STROKE_WIDTH
  )
}

const drawOvalGeometryOutline = (
  canvas: OverlayCanvas,
  matrix: GeometryTransformMatrix,
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
    const worldPoint = transformGeometryPoint(matrix, localPoint)

    if (!firstPoint) {
      firstPoint = worldPoint
      previousPoint = worldPoint
      continue
    }

    if (previousPoint) {
      canvas.line(previousPoint, worldPoint, {
        width: SELECTION_OVERLAY_STROKE_WIDTH,
        color: SELECTION_STROKE_COLOR
      })
    }
    previousPoint = worldPoint
  }

  if (previousPoint && firstPoint) {
    canvas.line(previousPoint, firstPoint, {
      width: SELECTION_OVERLAY_STROKE_WIDTH,
      color: SELECTION_STROKE_COLOR
    })
  }
}

const drawVectorHoverOutline = (
  canvas: OverlayCanvas,
  deps: Pick<PresetDependencies, 'render' | 'sceneTree'>,
  elementId: string,
  viewportPosition: PositionData,
  viewportScale: number
) => {
  const element = deps.sceneTree.getElementById(elementId)
  if (!element) {
    return false
  }

  const computed = element.getAllComputedData() as VectorComputedData
  const points = computed.points
  const segments = computed.segments
  const networks = computed.networks
  if (
    computed.pointCoordinateSpace !== 'workspace' ||
    !points ||
    !segments ||
    !networks
  ) {
    return false
  }
  const renderElement = deps.render.getElementById(elementId)
  if (!renderElement) {
    return false
  }
  const resolveCurrentWorkspacePoint = (
    point: PositionData
  ): PositionData | null => {
    const localPoint = getVectorRenderLocalPoint(renderElement, point)
    return localPoint
      ? deps.render.elementLocalToWorkspace(elementId, localPoint)
      : null
  }

  const orderedNetworks = sortVectorItemsById(Object.values(networks))
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

      const startWorkspace = resolveCurrentWorkspacePoint(start)
      const endWorkspace = resolveCurrentWorkspacePoint(end)
      if (!startWorkspace || !endWorkspace) {
        return
      }
      const startPoint = projectWorkspacePointToOverlayScreen(
        startWorkspace,
        viewportPosition,
        viewportScale
      )
      const endPoint = projectWorkspacePointToOverlayScreen(
        endWorkspace,
        viewportPosition,
        viewportScale
      )

      if (!outControl && !inControl) {
        canvas.line(startPoint, endPoint, {
          width: SELECTION_OVERLAY_VECTOR_HOVER_STROKE_WIDTH,
          color: SELECTION_STROKE_COLOR
        })
        hasDrawn = true
        return
      }

      const control1Workspace = resolveCurrentWorkspacePoint(
        outControl ?? start
      )
      const control2Workspace = resolveCurrentWorkspacePoint(inControl ?? end)
      if (!control1Workspace || !control2Workspace) {
        return
      }
      const control1 = projectWorkspacePointToOverlayScreen(
        control1Workspace,
        viewportPosition,
        viewportScale
      )
      const control2 = projectWorkspacePointToOverlayScreen(
        control2Workspace,
        viewportPosition,
        viewportScale
      )

      canvas.bezierCurve(startPoint, control1, control2, endPoint, {
        width: SELECTION_OVERLAY_VECTOR_HOVER_STROKE_WIDTH,
        color: SELECTION_STROKE_COLOR
      })
      hasDrawn = true
    })
  })

  return hasDrawn
}

const drawHoverGeometryOutline = (
  canvas: OverlayCanvas,
  deps: Pick<PresetDependencies, 'render' | 'sceneTree'>,
  elementId: string,
  hoveredElement: RenderElementShape
) => {
  const type = getElementType(deps, elementId)
  if (!type) {
    drawElementBoundsOutline(
      canvas,
      hoveredElement,
      SELECTION_STROKE_COLOR,
      SELECTION_OVERLAY_STROKE_WIDTH
    )
    return
  }

  if (type === 'vector') {
    const hasVectorOutline = drawVectorHoverOutline(
      canvas,
      deps,
      elementId,
      deps.render.getViewportPosition(),
      deps.render.getViewportScale()
    )
    if (hasVectorOutline) {
      return
    }
  }

  if (type === EntityTypes.GROUP) {
    const corners = getGroupBoundsCorners(deps, elementId, hoveredElement)
    if (corners) {
      drawOutline(
        canvas,
        corners,
        SELECTION_STROKE_COLOR,
        SELECTION_OVERLAY_STROKE_WIDTH
      )
    }
    return
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
    SELECTION_OVERLAY_STROKE_WIDTH
  )
}

const drawSelectedGeometryOutline = (
  canvas: OverlayCanvas,
  deps: Pick<PresetDependencies, 'render' | 'sceneTree'>,
  elementId: string,
  element: RenderElementShape
) => {
  const type = getElementType(deps, elementId)
  if (type === EntityTypes.GROUP) {
    const corners = getGroupBoundsCorners(deps, elementId, element)
    if (corners) {
      drawOutline(
        canvas,
        corners,
        SELECTION_STROKE_COLOR,
        SELECTION_OVERLAY_STROKE_WIDTH
      )
    }
    return
  }

  drawElementBoundsOutline(
    canvas,
    element,
    SELECTION_STROKE_COLOR,
    SELECTION_OVERLAY_STROKE_WIDTH
  )
  if (type === 'vector') {
    drawVectorHoverOutline(
      canvas,
      deps,
      elementId,
      deps.render.getViewportPosition(),
      deps.render.getViewportScale()
    )
  }
}

const getMultiSelectionBounds = (
  deps: Pick<PresetDependencies, 'render' | 'sceneTree'>,
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

    const geometryBounds = getElementOverlayWorldBounds(
      deps,
      elementId,
      element
    )
    if (!geometryBounds) {
      return
    }
    minX = Math.min(minX, geometryBounds.x)
    minY = Math.min(minY, geometryBounds.y)
    maxX = Math.max(maxX, geometryBounds.x + geometryBounds.width)
    maxY = Math.max(maxY, geometryBounds.y + geometryBounds.height)
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

const appendElementTransformSignature = (
  parts: string[],
  deps: Pick<PresetDependencies, 'sceneTree'>,
  elementId: string,
  element: RenderElementShape | null
) => {
  parts.push(elementId)
  if (!element) {
    parts.push('missing')
    return
  }

  const transform = element.worldTransform
  const bounds = getElementOverlayWorldBounds(deps, elementId, element)
  parts.push(
    String(transform.a),
    String(transform.b),
    String(transform.c),
    String(transform.d),
    String(transform.tx),
    String(transform.ty)
  )
  if (!bounds) {
    parts.push('invalid-bounds')
    return
  }
  parts.push(
    String(bounds.x),
    String(bounds.y),
    String(bounds.width),
    String(bounds.height)
  )
}

const appendVectorComputedSignature = (
  parts: string[],
  deps: Pick<PresetDependencies, 'sceneTree'>,
  elementId: string
) => {
  const sceneElement = deps.sceneTree.getElementById(elementId)
  if (!sceneElement || sceneElement.get('type') !== 'vector') {
    return
  }

  const computed = sceneElement.getAllComputedData() as VectorComputedData
  parts.push(
    computed.pointCoordinateSpace ?? 'missing-workspace',
    String(computed.x ?? ''),
    String(computed.y ?? ''),
    String(computed.width ?? ''),
    String(computed.height ?? '')
  )

  Object.values(computed.points ?? {})
    .sort((a, b) => a.id.localeCompare(b.id))
    .forEach((point) => {
      parts.push(
        point.id,
        point.kind,
        String(point.x),
        String(point.y),
        'anchorType' in point ? String(point.anchorType ?? '') : '',
        'handleMode' in point ? String(point.handleMode ?? '') : '',
        'parentId' in point ? String(point.parentId ?? '') : ''
      )
    })

  Object.values(computed.segments ?? {})
    .sort((a, b) => a.id.localeCompare(b.id))
    .forEach((segment) => {
      parts.push(
        segment.id,
        segment.startId,
        segment.endId,
        segment.outControlId ?? '',
        segment.inControlId ?? ''
      )
    })

  Object.values(computed.networks ?? {})
    .sort((a, b) => a.id.localeCompare(b.id))
    .forEach((network) => {
      parts.push(
        network.id,
        network.closed ? 'closed' : 'open',
        network.pointIds.join(','),
        network.segmentIds.join(',')
      )
    })
}

export const registerSelectionOverlayRenderLayer = (
  registerRenderLayer: RegisterRenderLayer,
  deps: SelectionOverlayRenderLayerDeps
) => {
  let lastDrawSignature = ''
  const layerRegistration = createOverlayLayerRegistration({
    name: SELECTION_OVERLAY_LAYER_NAME,
    zIndex: 8,
    update: (canvas: OverlayCanvas) => {
      const pathEditingVectorId =
        deps.systemContext.getManagedProperty<string | null>(
          PresetSystemPropertyKeys.PATH_EDITING_VECTOR_ID
        ) ?? null

      const selectedIds = getElementSelectionIds(deps)
      const selectedElementId = selectedIds.length === 1 ? selectedIds[0] : null
      const hoveredElementId =
        deps.systemContext.getManagedProperty<string | null>(
          PresetSystemPropertyKeys.HOVERED_ELEMENT_ID
        ) ?? null
      const drawSignatureParts = [
        pathEditingVectorId ?? '',
        selectedIds.join(','),
        hoveredElementId ?? ''
      ]
      selectedIds.forEach((selectedId) => {
        appendElementTransformSignature(
          drawSignatureParts,
          deps,
          selectedId,
          deps.render.getElementById(selectedId) as RenderElementShape | null
        )
        appendVectorComputedSignature(drawSignatureParts, deps, selectedId)
      })
      if (hoveredElementId) {
        appendElementTransformSignature(
          drawSignatureParts,
          deps,
          hoveredElementId,
          deps.render.getElementById(
            hoveredElementId
          ) as RenderElementShape | null
        )
        appendVectorComputedSignature(
          drawSignatureParts,
          deps,
          hoveredElementId
        )
      }
      const drawSignature = drawSignatureParts.join('|')
      if (drawSignature === lastDrawSignature) {
        return false
      }
      lastDrawSignature = drawSignature

      canvas.clear()
      if (!pathEditingVectorId && selectedIds.length > 0) {
        if (selectedElementId) {
          const selectedElement = deps.render.getElementById(
            selectedElementId
          ) as RenderElementShape | null

          if (selectedElement) {
            drawSelectedGeometryOutline(
              canvas,
              deps,
              selectedElementId,
              selectedElement
            )
          }
        } else {
          const bounds = getMultiSelectionBounds(deps, selectedIds)
          if (bounds) {
            drawBoundsOutline(
              canvas,
              bounds,
              SELECTION_STROKE_COLOR,
              SELECTION_OVERLAY_STROKE_WIDTH
            )
          }
        }
      }

      if (
        !hoveredElementId ||
        hoveredElementId === selectedElementId ||
        selectedIds.includes(hoveredElementId)
      ) {
        return true
      }

      const hoveredElement = deps.render.getElementById(
        hoveredElementId
      ) as RenderElementShape | null
      if (!hoveredElement) {
        return true
      }

      drawHoverGeometryOutline(canvas, deps, hoveredElementId, hoveredElement)
      return true
    }
  })

  registerRenderLayer(layerRegistration, { override: true })
}
