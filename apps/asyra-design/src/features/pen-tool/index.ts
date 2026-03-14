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
import type {
  SelectedVectorPointState,
  SelectedVectorSegmentState
} from '../../common-apis/system-context'
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

interface VectorPointDragTargetState extends Record<string, unknown> {
  elementId: string
  pointId: string
  index: number
  target: VectorPointTarget
  dragStartWorkspacePos: { x: number; y: number }
  initialTargetPos: { x: number; y: number }
  hasMoved: boolean
}

interface SelectVectorPointState extends Record<string, unknown> {
  segmentId?: string
  dragTarget: VectorPointDragTargetState | null
}

interface SubpathEndpoint {
  point: VectorAnchorPoint
  side: VectorEndpointSide
}

const PenHoverPreviewMode = {
  NONE: 'none',
  CONNECTED_SEGMENT_PREVIEW: 'connected-segment-preview',
  SEGMENT_INSERT_PREVIEW: 'segment-insert-preview'
} as const

type PenHoverPreviewMode =
  (typeof PenHoverPreviewMode)[keyof typeof PenHoverPreviewMode]

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

let pendingSelectedPointMirror: SelectedVectorPointState | null | undefined
let pendingSelectedPointTimer: ReturnType<typeof setTimeout> | null = null

const scheduleSelectedVectorPointMirror = (
  next: SelectedVectorPointState | null
) => {
  pendingSelectedPointMirror = next
  if (pendingSelectedPointTimer) {
    return
  }

  pendingSelectedPointTimer = setTimeout(() => {
    pendingSelectedPointTimer = null
    if (pendingSelectedPointMirror === undefined) {
      return
    }
    systemContextApis.setSelectedVectorPoint(pendingSelectedPointMirror)
    pendingSelectedPointMirror = undefined
  }, 0)
}

const flushSelectedVectorPointMirror = (
  next: SelectedVectorPointState | null
) => {
  if (pendingSelectedPointTimer) {
    clearTimeout(pendingSelectedPointTimer)
    pendingSelectedPointTimer = null
  }
  pendingSelectedPointMirror = undefined
  systemContextApis.setSelectedVectorPoint(next)
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
    y: selectedPoint.point.y,
    handleMode: elementApis.getVectorAnchorPointHandleMode(
      elementId,
      selectedPoint.point.id
    )
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

const hasMovedBeyondVectorPointDragThreshold = (
  snapshot: SystemContextSnapshot
): boolean => {
  const dragStart = snapshot.mouseDragStart ?? snapshot.mousePosition
  return elementApis.hasMovedBeyondThreshold(
    dragStart,
    snapshot.mousePosition,
    FEATURE_MOVEMENT_THRESHOLD.moveVectorPoint
  )
}

const getPointTargetPosition = (
  point: VectorAnchorPoint,
  target: VectorPointTarget
) => {
  if (target === VECTOR_TOKENS.POINT.TARGET.ANCHOR) {
    return { x: point.x, y: point.y }
  }

  if (target === VECTOR_TOKENS.POINT.TARGET.IN_HANDLE) {
    return point.inHandle
  }

  return point.outHandle
}

const syncSelectedVectorPointMirror = (
  elementId: string,
  selectedPoint: { point: VectorAnchorPoint; index: number } | null,
  target: VectorPointTarget,
  options?: { deferred?: boolean }
) => {
  if (!selectedPoint) {
    return false
  }

  const targetPosition = getPointTargetPosition(selectedPoint.point, target)
  if (!targetPosition) {
    return false
  }

  const nextState: SelectedVectorPointState = {
    elementId,
    pointId: selectedPoint.point.id,
    index: selectedPoint.index,
    target,
    x: targetPosition.x,
    y: targetPosition.y,
    handleMode: elementApis.getVectorAnchorPointHandleMode(
      elementId,
      selectedPoint.point.id
    )
  }

  if (options?.deferred) {
    scheduleSelectedVectorPointMirror(nextState)
  } else {
    flushSelectedVectorPointMirror(nextState)
  }

  return true
}

const updateVectorPointTargetPosition = (
  targetState: VectorPointDragTargetState,
  position: { x: number; y: number },
  options?: { undoable: boolean }
) => {
  if (targetState.target === VECTOR_TOKENS.POINT.TARGET.ANCHOR) {
    return elementApis.updateVectorAnchorPointPosition(
      targetState.elementId,
      targetState.pointId,
      position,
      options
    )
  }

  return elementApis.updateVectorAnchorPointHandlePosition(
    targetState.elementId,
    targetState.pointId,
    targetState.target,
    position,
    options
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

const resolvePenHoverPreviewMode = (
  snapshot: SystemContextSnapshot,
  pathEditingVectorId: string | null
): PenHoverPreviewMode => {
  if (snapshot.primaryTool !== PrimaryToolType.PEN || !pathEditingVectorId) {
    return PenHoverPreviewMode.NONE
  }

  if (systemContextApis.getPathEditingStartNewSubpath()) {
    return PenHoverPreviewMode.SEGMENT_INSERT_PREVIEW
  }

  return PenHoverPreviewMode.CONNECTED_SEGMENT_PREVIEW
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
          const clickedPoint = elementApis.getVectorEditablePointAtClientPos(
            pathEditingVectorId,
            snapshot.mousePosition
          )
          const clickedEndpoint =
            clickedPoint &&
            clickedPoint.target === VECTOR_TOKENS.POINT.TARGET.ANCHOR
              ? getSubpathEndpoint(subpaths, clickedPoint.point.id)
              : null
          const hoveredPoint = systemContextApis.getHoveredVectorPoint()
          const hoveredSegment = systemContextApis.getHoveredVectorSegment()
          const hoveredSegmentInsertPoint =
            systemContextApis.getHoveredVectorSegmentInsertPoint()

          if (
            clickedPoint &&
            clickedPoint.target === VECTOR_TOKENS.POINT.TARGET.ANCHOR
          ) {
            if (clickedEndpoint) {
              const selectedPoint = elementApis.getVectorAnchorPointById(
                pathEditingVectorId,
                clickedPoint.point.id
              )
              setSelectedAnchorPoint(pathEditingVectorId, selectedPoint)
              if (startNewSubpath) {
                systemContextApis.setPathEditingStartNewSubpath(false)
                return null
              }
            }

            if (!clickedEndpoint) {
              return null
            }

            const selectedPoint = selectionApis
              .getSelectedVectorPoints()
              .find((selection) => selection.elementId === pathEditingVectorId)
            const selectedEndpoint =
              selectedPoint?.elementId === pathEditingVectorId &&
              selectedPoint.target === VECTOR_TOKENS.POINT.TARGET.ANCHOR
                ? getSubpathEndpoint(subpaths, selectedPoint.pointId)
                : null
            const currentSubpath = subpaths[subpaths.length - 1]
            const fallbackEndpoint =
              currentSubpath && currentSubpath.length > 0
                ? getSubpathEndpoint(
                    subpaths,
                    currentSubpath[currentSubpath.length - 1].id
                  )
                : null
            const sourceEndpoint = selectedEndpoint ?? fallbackEndpoint

            if (!sourceEndpoint) {
              return null
            }

            if (sourceEndpoint.point.id === clickedEndpoint.point.id) {
              return null
            }

            const connected = elementApis.connectVectorAnchorEndpoints(
              pathEditingVectorId,
              sourceEndpoint.point.id,
              clickedEndpoint.point.id
            )
            if (!connected) {
              return null
            }

            selectionApis.selectElements([pathEditingVectorId])
            const nextSelectedPoint = elementApis.getVectorAnchorPointById(
              pathEditingVectorId,
              clickedEndpoint.point.id
            )
            setSelectedAnchorPoint(pathEditingVectorId, nextSelectedPoint)
            systemContextApis.setSelectedVectorSegment(null)
            systemContextApis.setHoveredVectorSegment(null)
            systemContextApis.setHoveredVectorSegmentInsertPoint(null)
            systemContextApis.setHoveredVectorPoint(null)
            // After endpoint-connect commit (merge/close), stay in split mode
            // so connected append preview does not auto-continue unexpectedly.
            systemContextApis.setPathEditingStartNewSubpath(true)
            return null
          }

          const isHoveringAnchorOnEditingVector =
            hoveredPoint?.elementId === pathEditingVectorId
          const isHoveringSegmentOnEditingVector =
            hoveredSegment?.elementId === pathEditingVectorId
          const hasInsertPointOnHoveredSegment =
            hoveredSegmentInsertPoint?.elementId === pathEditingVectorId &&
            hoveredSegmentInsertPoint.segmentId === hoveredSegment?.segmentId
          const stateHoveredSegmentHit =
            isHoveringSegmentOnEditingVector &&
            hasInsertPointOnHoveredSegment &&
            hoveredSegment &&
            hoveredSegmentInsertPoint
              ? {
                  segmentId: hoveredSegment.segmentId,
                  position: {
                    x: hoveredSegmentInsertPoint.x,
                    y: hoveredSegmentInsertPoint.y
                  }
                }
              : null
          const activeHoveredSegmentHit =
            startNewSubpath && !isHoveringAnchorOnEditingVector
              ? (stateHoveredSegmentHit ??
                elementApis.getVectorSegmentHitAtClientPos(
                  pathEditingVectorId,
                  snapshot.mousePosition
                ))
              : null

          if (activeHoveredSegmentHit) {
            const insertedPoint = elementApis.splitVectorSegmentAtWorkspacePos(
              pathEditingVectorId,
              activeHoveredSegmentHit.segmentId,
              activeHoveredSegmentHit.position
            )

            if (insertedPoint) {
              selectionApis.selectElements([pathEditingVectorId])
              setSelectedAnchorPoint(pathEditingVectorId, insertedPoint)
              systemContextApis.setSelectedVectorSegment(null)
              systemContextApis.setHoveredVectorSegment(null)
              systemContextApis.setHoveredVectorSegmentInsertPoint(null)
              // Keep split mode active after split actions. Non-endpoint
              // continuation is intentionally deferred to network editing.
              systemContextApis.setPathEditingStartNewSubpath(true)
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

export const selectVectorPointFeature = defineFeature<
  Record<string, unknown>,
  SelectVectorPointState
>(FeatureNames.SELECT_VECTOR_POINT, InputSystemEvents.INPUT_DRAG, {
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
      const hoveredSegment = systemContextApis.getHoveredVectorSegment()
      const activeHoveredPoint =
        hoveredPoint?.elementId === pathEditingVectorId
          ? hoveredPoint
          : (() => {
              const hit = elementApis.getVectorEditablePointAtClientPos(
                pathEditingVectorId,
                snapshot.mousePosition
              )
              if (!hit) {
                return null
              }

              return {
                elementId: pathEditingVectorId,
                pointId: hit.point.id,
                index: hit.index,
                target: hit.target,
                x: hit.position.x,
                y: hit.position.y
              } as SelectedVectorPointState
            })()

      if (!activeHoveredPoint) {
        const activeHoveredSegmentId =
          hoveredSegment?.elementId === pathEditingVectorId &&
          hoveredSegment.segmentId
            ? hoveredSegment.segmentId
            : elementApis.getVectorSegmentAtClientPos(
                pathEditingVectorId,
                snapshot.mousePosition
              )

        if (activeHoveredSegmentId) {
          selectionApis.selectVectorSegment({
            elementId: pathEditingVectorId,
            segmentId: activeHoveredSegmentId
          })
          selectionApis.clearVectorPointSelection()
          systemContextApis.setSelectedVectorPoint(null)
          systemContextApis.setSelectedVectorSegment({
            elementId: pathEditingVectorId,
            segmentId: activeHoveredSegmentId
          })
          return {
            segmentId: activeHoveredSegmentId,
            dragTarget: null
          }
        }

        selectionApis.clearVectorPointSelection()
        selectionApis.clearVectorSegmentSelection()
        systemContextApis.setSelectedVectorPoint(null)
        systemContextApis.setSelectedVectorSegment(null)
        return null
      }

      selectionApis.clearVectorSegmentSelection()
      systemContextApis.setSelectedVectorSegment(null)
      selectionApis.selectVectorPoint({
        elementId: activeHoveredPoint.elementId,
        pointId: activeHoveredPoint.pointId,
        target: activeHoveredPoint.target
      })
      const handleMode = elementApis.getVectorAnchorPointHandleMode(
        activeHoveredPoint.elementId,
        activeHoveredPoint.pointId
      )
      systemContextApis.setSelectedVectorPoint({
        elementId: activeHoveredPoint.elementId,
        pointId: activeHoveredPoint.pointId,
        index: activeHoveredPoint.index,
        target: activeHoveredPoint.target,
        x: activeHoveredPoint.x,
        y: activeHoveredPoint.y,
        handleMode
      })

      const dragStartWorkspacePos = elementApis.getMousePosInWorkspace(
        snapshot.mousePosition
      )
      const selectedPoint = elementApis.getVectorAnchorPointById(
        activeHoveredPoint.elementId,
        activeHoveredPoint.pointId
      )
      const initialTargetPos =
        selectedPoint &&
        getPointTargetPosition(selectedPoint.point, activeHoveredPoint.target)

      return {
        dragTarget:
          dragStartWorkspacePos && selectedPoint && initialTargetPos
            ? {
                elementId: activeHoveredPoint.elementId,
                pointId: activeHoveredPoint.pointId,
                index: activeHoveredPoint.index,
                target: activeHoveredPoint.target,
                dragStartWorkspacePos,
                initialTargetPos: {
                  x: initialTargetPos.x,
                  y: initialTargetPos.y
                },
                hasMoved: false
              }
            : null
      }
    },
    onUpdate: (
      snapshot: SystemContextSnapshot,
      state: SelectVectorPointState
    ) => {
      const dragTarget = state.dragTarget
      if (!dragTarget) {
        return
      }

      if (
        !snapshot.mouseDragging ||
        !hasMovedBeyondVectorPointDragThreshold(snapshot)
      ) {
        return
      }

      const currentWorkspacePos = elementApis.getMousePosInWorkspace(
        snapshot.mousePosition
      )
      if (!currentWorkspacePos) {
        return
      }

      const dx = currentWorkspacePos.x - dragTarget.dragStartWorkspacePos.x
      const dy = currentWorkspacePos.y - dragTarget.dragStartWorkspacePos.y
      const targetPos = {
        x: dragTarget.initialTargetPos.x + dx,
        y: dragTarget.initialTargetPos.y + dy
      }

      const updatedPoint = updateVectorPointTargetPosition(
        dragTarget,
        targetPos,
        {
          undoable: false
        }
      )
      if (!updatedPoint) {
        return
      }

      syncSelectedVectorPointMirror(
        dragTarget.elementId,
        updatedPoint,
        dragTarget.target,
        { deferred: true }
      )
      dragTarget.hasMoved = true
      return
    },
    onEnd: (snapshot: SystemContextSnapshot, state: SelectVectorPointState) => {
      const dragTarget = state.dragTarget
      if (!dragTarget) {
        return
      }

      if (
        !dragTarget.hasMoved &&
        !hasMovedBeyondVectorPointDragThreshold(snapshot)
      ) {
        return
      }

      const currentWorkspacePos = elementApis.getMousePosInWorkspace(
        snapshot.mousePosition
      )
      if (!currentWorkspacePos) {
        return
      }

      const dx = currentWorkspacePos.x - dragTarget.dragStartWorkspacePos.x
      const dy = currentWorkspacePos.y - dragTarget.dragStartWorkspacePos.y
      const targetPos = {
        x: dragTarget.initialTargetPos.x + dx,
        y: dragTarget.initialTargetPos.y + dy
      }

      updateVectorPointTargetPosition(dragTarget, dragTarget.initialTargetPos, {
        undoable: false
      })
      const committedPoint = updateVectorPointTargetPosition(
        dragTarget,
        targetPos
      )
      if (!committedPoint) {
        return
      }

      syncSelectedVectorPointMirror(
        dragTarget.elementId,
        committedPoint,
        dragTarget.target
      )
      return
    }
  }
})

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
        systemContextApis.setHoveredVectorSegment(null)
        systemContextApis.setHoveredVectorSegmentInsertPoint(null)
        return null
      }

      const previewMode = resolvePenHoverPreviewMode(
        snapshot,
        pathEditingVectorId
      )
      const hoveredPoint = (() => {
        const rawHoveredPoint = elementApis.getVectorEditablePointAtClientPos(
          pathEditingVectorId,
          snapshot.mousePosition
        )
        if (!rawHoveredPoint) {
          return null
        }

        if (snapshot.primaryTool !== PrimaryToolType.PEN) {
          return rawHoveredPoint
        }

        if (previewMode !== PenHoverPreviewMode.CONNECTED_SEGMENT_PREVIEW) {
          return null
        }

        if (rawHoveredPoint.target !== VECTOR_TOKENS.POINT.TARGET.ANCHOR) {
          return null
        }

        const subpaths =
          elementApis.getVectorAnchorSubpaths(pathEditingVectorId)
        const endpoint = getSubpathEndpoint(subpaths, rawHoveredPoint.point.id)
        return endpoint ? rawHoveredPoint : null
      })()
      if (hoveredPoint) {
        systemContextApis.setHoveredVectorPoint({
          elementId: pathEditingVectorId,
          pointId: hoveredPoint.point.id,
          index: hoveredPoint.index,
          target: hoveredPoint.target,
          x: hoveredPoint.position.x,
          y: hoveredPoint.position.y
        })
        systemContextApis.setHoveredVectorSegment(null)
        systemContextApis.setHoveredVectorSegmentInsertPoint(null)
        cursorApis.setCanvasCursor('pointer')
        return null
      }

      const hoveredSegmentHit = elementApis.getVectorSegmentHitAtClientPos(
        pathEditingVectorId,
        snapshot.mousePosition
      )
      const hoveredSegment: SelectedVectorSegmentState | null =
        hoveredSegmentHit
          ? snapshot.primaryTool === PrimaryToolType.PEN &&
            previewMode === PenHoverPreviewMode.CONNECTED_SEGMENT_PREVIEW
            ? null
            : {
                elementId: pathEditingVectorId,
                segmentId: hoveredSegmentHit.segmentId
              }
          : null

      systemContextApis.setHoveredVectorPoint(null)
      systemContextApis.setHoveredVectorSegment(hoveredSegment)
      systemContextApis.setHoveredVectorSegmentInsertPoint(
        previewMode === PenHoverPreviewMode.SEGMENT_INSERT_PREVIEW &&
          hoveredSegmentHit
          ? {
              elementId: pathEditingVectorId,
              segmentId: hoveredSegmentHit.segmentId,
              x: hoveredSegmentHit.position.x,
              y: hoveredSegmentHit.position.y
            }
          : null
      )
      cursorApis.setCanvasCursor(hoveredSegment ? 'pointer' : 'default')
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
      const pathEditingMode = systemContextApis.getPathEditingMode()
      const editingVectorId = systemContextApis.getPathEditingVectorId()

      if (pathEditingMode) {
        const hasVectorPointSelection =
          selectionApis.getVectorPointSelectionIds().length > 0
        const hasVectorSegmentSelection =
          selectionApis.getVectorSegmentSelectionIds().length > 0

        if (hasVectorPointSelection || hasVectorSegmentSelection) {
          selectionApis.clearVectorPointSelection({ undoable: false })
          selectionApis.clearVectorSegmentSelection({ undoable: false })
          systemContextApis.clearVectorPointState()
          systemContextApis.setPathEditingStartNewSubpath(true)
          cursorApis.resetCanvasCursor()
          return {
            cancelled: true,
            selection: 'vector',
            elementId: editingVectorId
          }
        }

        systemContextApis.exitPathEditingMode()
        systemContextApis.switchPrimaryTool(PrimaryToolType.SELECT)
        cursorApis.resetCanvasCursor()
        return { cancelled: true, elementId: editingVectorId }
      }

      const selectedIds = selectionApis.getSelectedIds()
      if (selectedIds.length > 0) {
        selectionApis.clearSelection({ undoable: false })
        cursorApis.resetCanvasCursor()
        return { cancelled: true, selection: 'element' }
      }

      cursorApis.resetCanvasCursor()
      return null
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
