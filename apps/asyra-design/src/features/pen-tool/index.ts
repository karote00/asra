import { id, type SystemContextSnapshot } from '@asyra/utils'
import {
  VECTOR_TOKENS,
  defineFeature,
  VECTOR_TOPOLOGY_POINT_ID_TYPE,
  type VectorAnchorPoint,
  type VectorEndpointSide,
  type VectorPointTarget
} from '@asyra/core'
import {
  cursorApis,
  elementApis,
  selectionApis,
  systemContextApis
} from '../../common-apis'
import type { SelectedVectorPointState } from '../../common-apis/system-context'
import {
  FEATURE_MOVEMENT_THRESHOLD,
  FeatureNames,
  InputSystemEvents,
  PrimaryToolType
} from '../../constants'

interface PenState extends Record<string, unknown> {
  elementId: string
  pointId: string
  connectedPointId: string | null
  connectionSide: VectorEndpointSide
  autoUpdateConnectedHandle: boolean
}

interface SubpathEndpoint {
  point: VectorAnchorPoint
  side: VectorEndpointSide
}

const createAnchorPoint = (point: {
  x: number
  y: number
}): VectorAnchorPoint => ({
  id: id(VECTOR_TOPOLOGY_POINT_ID_TYPE),
  x: point.x,
  y: point.y,
  type: 'sharp',
  isMove: undefined,
  inHandle: null,
  outHandle: null
})

const DOUBLE_CLICK_HIT_PADDING = 8

interface Vec2 {
  x: number
  y: number
}

const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y })
const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y })
const scale = (v: Vec2, k: number): Vec2 => ({ x: v.x * k, y: v.y * k })

const computeSymmetricHandles = (
  anchor: Vec2,
  mouse: Vec2
): { inHandle: Vec2; outHandle: Vec2; dragVector: Vec2 } => {
  const dragVector = sub(mouse, anchor)
  return {
    inHandle: add(anchor, scale(dragVector, -1)),
    outHandle: add(anchor, dragVector),
    dragVector
  }
}

const computeConnectedOutHandle = (connectedPoint: VectorAnchorPoint): Vec2 => {
  return connectedPoint.outHandle ?? connectedPoint
}

const computeConnectedInHandle = (connectedPoint: VectorAnchorPoint): Vec2 => {
  return connectedPoint.inHandle ?? connectedPoint
}

const computeFigmaStyleHandles = (
  connectedPoint: VectorAnchorPoint,
  currentPoint: VectorAnchorPoint,
  mouse: Vec2
): {
  connectedOutHandle: Vec2
  currentInHandle: Vec2
  currentOutHandle: Vec2
} => {
  const vx = mouse.x - currentPoint.x
  const vy = mouse.y - currentPoint.y

  const p2 = {
    x: currentPoint.x - vx * 0.8,
    y: currentPoint.y - vy * 0.8
  }

  const p1 = {
    x: connectedPoint.x - vx * 0.334,
    y: connectedPoint.y + (currentPoint.y - connectedPoint.y) * 0.327
  }

  return {
    connectedOutHandle: p1,
    currentInHandle: p2,
    currentOutHandle: { x: mouse.x, y: mouse.y }
  }
}

const setSelectedAnchorPoint = (
  elementId: string,
  selectedPoint: { point: VectorAnchorPoint; index: number } | null
) => {
  if (!selectedPoint) {
    selectionApis.clearVectorPointSelection()
    systemContextApis.setSelectedVectorPoint(null)
    return
  }

  const selectedState: SelectedVectorPointState = {
    elementId,
    pointId: selectedPoint.point.id,
    index: selectedPoint.index,
    target: VECTOR_TOKENS.POINT.TARGET.ANCHOR,
    x: selectedPoint.point.x,
    y: selectedPoint.point.y
  }

  selectionApis.clearVectorSegmentSelection()
  selectionApis.selectVectorPoint({
    elementId,
    pointId: selectedState.pointId,
    target: selectedState.target
  })
  // Compatibility mirror during SelectionManager migration.
  systemContextApis.setSelectedVectorPoint(selectedState)
}

const getCurrentMouseWorkspacePos = () => {
  const snapshot = systemContextApis.getSystemContextSnapshot()
  return elementApis.getMousePosInWorkspace({
    x: snapshot.mousePosition.x,
    y: snapshot.mousePosition.y
  })
}

const hasMovedBeyondPenCurveThreshold = (
  snapshot: SystemContextSnapshot
): boolean => {
  const dragStart = snapshot.mouseDragStart
  if (!dragStart) {
    return false
  }

  return elementApis.hasMovedBeyondThreshold(
    dragStart,
    snapshot.mousePosition,
    FEATURE_MOVEMENT_THRESHOLD.penCurveDrag
  )
}

const applyBezierDragForNewPoint = (
  state: PenState,
  mouseWorkspacePos: { x: number; y: number }
) => {
  if (!state.connectedPointId) {
    return false
  }

  const anchorPoints = elementApis.getVectorAnchorPoints(state.elementId)
  const newPoint = anchorPoints.find((point) => point.id === state.pointId)
  const connectedPoint = anchorPoints.find(
    (point) => point.id === state.connectedPointId
  )
  if (!newPoint || !connectedPoint) {
    return false
  }

  const symmetric = computeSymmetricHandles(newPoint, mouseWorkspacePos)
  const connectedTarget: Exclude<
    VectorPointTarget,
    typeof VECTOR_TOKENS.POINT.TARGET.ANCHOR
  > =
    state.connectionSide === VECTOR_TOKENS.ENDPOINT.SIDE.START
      ? VECTOR_TOKENS.POINT.TARGET.IN_HANDLE
      : VECTOR_TOKENS.POINT.TARGET.OUT_HANDLE
  const currentSegmentTarget: Exclude<
    VectorPointTarget,
    typeof VECTOR_TOKENS.POINT.TARGET.ANCHOR
  > =
    state.connectionSide === VECTOR_TOKENS.ENDPOINT.SIDE.START
      ? VECTOR_TOKENS.POINT.TARGET.OUT_HANDLE
      : VECTOR_TOKENS.POINT.TARGET.IN_HANDLE
  const currentOppositeTarget: Exclude<
    VectorPointTarget,
    typeof VECTOR_TOKENS.POINT.TARGET.ANCHOR
  > =
    state.connectionSide === VECTOR_TOKENS.ENDPOINT.SIDE.START
      ? VECTOR_TOKENS.POINT.TARGET.IN_HANDLE
      : VECTOR_TOKENS.POINT.TARGET.OUT_HANDLE

  const figmaHandles =
    state.autoUpdateConnectedHandle &&
    state.connectionSide === VECTOR_TOKENS.ENDPOINT.SIDE.END
      ? computeFigmaStyleHandles(connectedPoint, newPoint, mouseWorkspacePos)
      : null

  const connectedHandle = figmaHandles
    ? figmaHandles.connectedOutHandle
    : state.connectionSide === VECTOR_TOKENS.ENDPOINT.SIDE.START
      ? computeConnectedInHandle(connectedPoint)
      : computeConnectedOutHandle(connectedPoint)
  const currentSegmentHandle = figmaHandles
    ? figmaHandles.currentInHandle
    : symmetric.inHandle
  const currentOppositeHandle = figmaHandles
    ? figmaHandles.currentOutHandle
    : symmetric.outHandle

  elementApis.updateVectorAnchorPointHandles(state.elementId, [
    {
      pointId: state.connectedPointId,
      target: connectedTarget,
      position: {
        x: connectedHandle.x,
        y: connectedHandle.y
      }
    },
    {
      pointId: state.pointId,
      target: currentSegmentTarget,
      position: {
        x: currentSegmentHandle.x,
        y: currentSegmentHandle.y
      },
      forceSmooth: true
    },
    {
      pointId: state.pointId,
      target: currentOppositeTarget,
      position: {
        x: currentOppositeHandle.x,
        y: currentOppositeHandle.y
      },
      forceSmooth: true
    }
  ])

  return true
}

const isPathEditingVectorSelected = (
  selectedIds: string[],
  pathEditingVectorId: string | null
): pathEditingVectorId is string => {
  if (!pathEditingVectorId || selectedIds.length !== 1) {
    return false
  }

  if (selectedIds[0] !== pathEditingVectorId) {
    return false
  }

  return elementApis.getElementType(pathEditingVectorId) === 'vector'
}

const getSubpathEndpoint = (
  subpaths: VectorAnchorPoint[][],
  pointId: string
): SubpathEndpoint | null => {
  for (const subpath of subpaths) {
    if (subpath.length === 0) {
      continue
    }

    const firstPoint = subpath[0]
    const lastPoint = subpath[subpath.length - 1]

    if (firstPoint.id === pointId && lastPoint.id === pointId) {
      return { point: lastPoint, side: VECTOR_TOKENS.ENDPOINT.SIDE.END }
    }

    if (firstPoint.id === pointId) {
      return { point: subpath[0], side: VECTOR_TOKENS.ENDPOINT.SIDE.START }
    }
    if (lastPoint.id === pointId) {
      return { point: lastPoint, side: VECTOR_TOKENS.ENDPOINT.SIDE.END }
    }
  }

  return null
}

export const penFeature = defineFeature<Record<string, unknown>, PenState>(
  FeatureNames.PEN,
  InputSystemEvents.INPUT_DRAG,
  {
    priority: 15,
    exclusive: true,
    session: {
      onStart: (snapshot: SystemContextSnapshot) => {
        if (snapshot.primaryTool !== PrimaryToolType.PEN) {
          return null
        }

        const dragStartWorkspace = elementApis.getMousePosInWorkspace({
          x: snapshot.mousePosition.x,
          y: snapshot.mousePosition.y
        })

        if (!dragStartWorkspace) {
          return null
        }

        const selectedIds = selectionApis.getSelectedIds()
        const pathEditingVectorId = systemContextApis.getPathEditingVectorId()
        const startNewSubpath =
          systemContextApis.getPathEditingStartNewSubpath()

        if (isPathEditingVectorSelected(selectedIds, pathEditingVectorId)) {
          const subpaths =
            elementApis.getVectorAnchorSubpaths(pathEditingVectorId)
          const clickedPoint =
            startNewSubpath &&
            elementApis.getVectorEditablePointAtClientPos(
              pathEditingVectorId,
              snapshot.mousePosition
            )

          if (
            clickedPoint &&
            clickedPoint.target === VECTOR_TOKENS.POINT.TARGET.ANCHOR
          ) {
            const selectedPoint = elementApis.getVectorAnchorPointById(
              pathEditingVectorId,
              clickedPoint.point.id
            )
            setSelectedAnchorPoint(pathEditingVectorId, selectedPoint)

            const selectedEndpoint = getSubpathEndpoint(
              subpaths,
              clickedPoint.point.id
            )
            if (startNewSubpath && selectedEndpoint) {
              systemContextApis.setPathEditingStartNewSubpath(false)
            }

            return null
          }

          const selectedPoint = selectionApis
            .getSelectedVectorPoints()
            .find((selection) => selection.elementId === pathEditingVectorId)
          const selectedEndpoint =
            !startNewSubpath &&
            selectedPoint?.elementId === pathEditingVectorId &&
            selectedPoint.target === VECTOR_TOKENS.POINT.TARGET.ANCHOR
              ? getSubpathEndpoint(subpaths, selectedPoint.pointId)
              : null
          const currentSubpath = subpaths[subpaths.length - 1]
          const fallbackConnectedPoint =
            !startNewSubpath && currentSubpath && currentSubpath.length > 0
              ? currentSubpath[currentSubpath.length - 1]
              : null
          const connectedPoint =
            selectedEndpoint?.point ?? fallbackConnectedPoint
          const connectedPointId = connectedPoint?.id ?? null
          const continuation =
            !startNewSubpath && connectedPointId
              ? elementApis.getVectorAnchorEndpoint(
                  pathEditingVectorId,
                  connectedPointId
                )
              : null
          const connectionSide =
            continuation?.side ?? VECTOR_TOKENS.ENDPOINT.SIDE.END
          const autoUpdateConnectedHandle =
            !!connectedPoint &&
            connectionSide === VECTOR_TOKENS.ENDPOINT.SIDE.END &&
            !!currentSubpath &&
            currentSubpath.length === 1 &&
            connectedPoint.outHandle === null
          const newPoint = createAnchorPoint(dragStartWorkspace)
          const newSelectedPoint = elementApis.appendVectorAnchorPoint(
            pathEditingVectorId,
            newPoint,
            {
              startNewSubpath,
              continuation
            }
          )
          selectionApis.selectElements([pathEditingVectorId])
          setSelectedAnchorPoint(pathEditingVectorId, newSelectedPoint)
          if (startNewSubpath) {
            systemContextApis.setPathEditingStartNewSubpath(false)
          }
          systemContextApis.setHoveredVectorPoint(null)

          return {
            elementId: pathEditingVectorId,
            pointId: newPoint.id,
            connectedPointId,
            connectionSide,
            autoUpdateConnectedHandle
          } as PenState
        }

        const firstPoint = createAnchorPoint(dragStartWorkspace)
        const elementId = elementApis.createVectorElementFromSinglePoint(
          firstPoint.id,
          dragStartWorkspace
        )
        if (!elementId) {
          return null
        }

        selectionApis.selectElements([elementId])
        // New vector creation should continue the same subpath immediately.
        systemContextApis.enterPathEditingMode(elementId, {
          startNewSubpath: false
        })
        const selectedPoint = elementApis.getVectorAnchorPointById(
          elementId,
          firstPoint.id
        )
        setSelectedAnchorPoint(elementId, selectedPoint)

        return {
          elementId,
          pointId: firstPoint.id,
          connectedPointId: null,
          connectionSide: VECTOR_TOKENS.ENDPOINT.SIDE.END,
          autoUpdateConnectedHandle: false
        }
      },

      onUpdate: (snapshot: SystemContextSnapshot, state: PenState) => {
        if (!hasMovedBeyondPenCurveThreshold(snapshot)) {
          return
        }

        const mouseWorkspacePos = getCurrentMouseWorkspacePos()
        if (!mouseWorkspacePos) {
          return
        }

        applyBezierDragForNewPoint(state, mouseWorkspacePos)

        return
      },
      onEnd: (snapshot: SystemContextSnapshot, state: PenState) => {
        if (!hasMovedBeyondPenCurveThreshold(snapshot)) {
          const selectedPoint = elementApis.getVectorAnchorPointById(
            state.elementId,
            state.pointId
          )
          setSelectedAnchorPoint(state.elementId, selectedPoint)
          return
        }

        const mouseWorkspacePos = getCurrentMouseWorkspacePos()
        if (mouseWorkspacePos) {
          applyBezierDragForNewPoint(state, mouseWorkspacePos)
        }

        const selectedPoint = elementApis.getVectorAnchorPointById(
          state.elementId,
          state.pointId
        )
        setSelectedAnchorPoint(state.elementId, selectedPoint)
        return
      }
    }
  }
)

export const selectVectorPointFeature = defineFeature(
  FeatureNames.SELECT_VECTOR_POINT,
  InputSystemEvents.INPUT_DRAG,
  {
    priority: 30,
    exclusive: true,
    session: {
      onStart: (snapshot: SystemContextSnapshot) => {
        if (snapshot.primaryTool === PrimaryToolType.PEN) {
          return null
        }

        const selectedIds = selectionApis.getSelectedIds()
        const pathEditingVectorId = systemContextApis.getPathEditingVectorId()
        if (!isPathEditingVectorSelected(selectedIds, pathEditingVectorId)) {
          return null
        }

        const hoveredPoint = systemContextApis.getHoveredVectorPoint()
        const hoveredSegmentId = elementApis.getVectorSegmentAtClientPos(
          pathEditingVectorId,
          snapshot.mousePosition
        )
        if (!hoveredPoint || hoveredPoint.elementId !== pathEditingVectorId) {
          if (hoveredSegmentId) {
            selectionApis.selectVectorSegment({
              elementId: pathEditingVectorId,
              segmentId: hoveredSegmentId
            })
            selectionApis.clearVectorPointSelection()
            systemContextApis.setSelectedVectorPoint(null)
            return {
              segmentId: hoveredSegmentId
            }
          }

          selectionApis.clearVectorPointSelection()
          selectionApis.clearVectorSegmentSelection()
          systemContextApis.setSelectedVectorPoint(null)
          return null
        }

        selectionApis.clearVectorSegmentSelection()
        selectionApis.selectVectorPoint({
          elementId: hoveredPoint.elementId,
          pointId: hoveredPoint.pointId,
          target: hoveredPoint.target
        })
        systemContextApis.setSelectedVectorPoint({
          elementId: hoveredPoint.elementId,
          pointId: hoveredPoint.pointId,
          index: hoveredPoint.index,
          target: hoveredPoint.target,
          x: hoveredPoint.x,
          y: hoveredPoint.y
        })

        return {
          pointId: hoveredPoint.pointId
        }
      },
      onUpdate: () => {
        return
      },
      onEnd: () => {
        return
      }
    }
  }
)

export const hoverVectorPointCursorFeature = defineFeature(
  FeatureNames.HOVER_VECTOR_POINT_CURSOR,
  InputSystemEvents.INPUT_MOUSE_MOVE,
  {
    priority: 20,
    exclusive: false,
    execution: (snapshot: SystemContextSnapshot) => {
      const pathEditingVectorId = systemContextApis.getPathEditingVectorId()
      if (!pathEditingVectorId) {
        cursorApis.resetCanvasCursor()
        systemContextApis.setHoveredVectorPoint(null)
        return null
      }

      const hoveredPoint = elementApis.getVectorEditablePointAtClientPos(
        pathEditingVectorId,
        snapshot.mousePosition
      )
      systemContextApis.setHoveredVectorPoint(
        hoveredPoint
          ? {
              elementId: pathEditingVectorId,
              pointId: hoveredPoint.point.id,
              index: hoveredPoint.index,
              target: hoveredPoint.target,
              x: hoveredPoint.position.x,
              y: hoveredPoint.position.y
            }
          : null
      )
      cursorApis.setCanvasCursor(hoveredPoint ? 'pointer' : 'default')
      return null
    }
  }
)

export const cancelPenEditingFeature = defineFeature(
  FeatureNames.CANCEL_PEN_EDITING,
  InputSystemEvents.INPUT_SHORTCUT_CANCEL,
  {
    priority: 100,
    exclusive: true,
    execution: (snapshot: SystemContextSnapshot) => {
      const editingVectorId = systemContextApis.getPathEditingVectorId()
      if (!editingVectorId) {
        cursorApis.resetCanvasCursor()
        return null
      }

      if (snapshot.primaryTool !== PrimaryToolType.PEN) {
        systemContextApis.exitPathEditingMode()
        cursorApis.resetCanvasCursor()
        return { cancelled: true, elementId: editingVectorId }
      }

      const startNewSubpath = systemContextApis.getPathEditingStartNewSubpath()
      if (!startNewSubpath) {
        const removed =
          elementApis.removeLastSinglePointSubpath(editingVectorId)
        if (removed) {
          systemContextApis.setPathEditingStartNewSubpath(true)
          selectionApis.clearVectorPointSelection({ undoable: false })
          selectionApis.clearVectorSegmentSelection({ undoable: false })
          systemContextApis.clearVectorPointState()
          return { splitPath: true, removedSinglePointSubpath: true }
        }

        systemContextApis.setPathEditingStartNewSubpath(true)
        selectionApis.clearVectorPointSelection({ undoable: false })
        selectionApis.clearVectorSegmentSelection({ undoable: false })
        systemContextApis.clearVectorPointState()
        return { splitPath: true, elementId: editingVectorId }
      }

      systemContextApis.exitPathEditingMode()
      systemContextApis.switchPrimaryTool(PrimaryToolType.SELECT)
      cursorApis.resetCanvasCursor()
      return { cancelled: true, elementId: editingVectorId }
    }
  }
)

export const enterPathEditingFeature = defineFeature(
  FeatureNames.ENTER_PATH_EDITING,
  InputSystemEvents.INPUT_SHORTCUT_ENTER,
  {
    priority: 100,
    exclusive: true,
    execution: () => {
      const selectedIds = selectionApis.getSelectedIds()
      if (selectedIds.length !== 1) {
        return null
      }

      const selectedId = selectedIds[0]
      if (elementApis.getElementType(selectedId) !== 'vector') {
        return null
      }

      systemContextApis.enterPathEditingMode(selectedId)
      return { pathEditingVectorId: selectedId, source: 'enter' }
    }
  }
)

export const enterPathEditingByDoubleClickFeature = defineFeature(
  FeatureNames.ENTER_PATH_EDITING_BY_DOUBLE_CLICK,
  InputSystemEvents.INPUT_DOUBLE_CLICK,
  {
    priority: 90,
    exclusive: true,
    execution: (snapshot: SystemContextSnapshot) => {
      if (snapshot.primaryTool === PrimaryToolType.PEN) {
        return null
      }

      const selectedIds = selectionApis.getSelectedIds()
      if (selectedIds.length !== 1) {
        return null
      }

      const selectedId = selectedIds[0]
      if (elementApis.getElementType(selectedId) !== 'vector') {
        return null
      }

      const workspacePointerPos = elementApis.getMousePosInWorkspace({
        x: snapshot.mousePosition.x,
        y: snapshot.mousePosition.y
      })

      if (!workspacePointerPos) {
        return null
      }

      const isHitSelectedVector = elementApis.isPointInsideElement(
        selectedId,
        workspacePointerPos,
        DOUBLE_CLICK_HIT_PADDING
      )
      const isNearSelectedVectorPath =
        elementApis.isPointNearVectorPathAtWorkspacePos(
          selectedId,
          workspacePointerPos,
          DOUBLE_CLICK_HIT_PADDING
        )

      if (!isHitSelectedVector && !isNearSelectedVectorPath) {
        return null
      }

      systemContextApis.enterPathEditingMode(selectedId)
      return { pathEditingVectorId: selectedId, source: 'double-click' }
    }
  }
)
