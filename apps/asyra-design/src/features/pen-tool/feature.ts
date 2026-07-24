import {
  type EVENT_OPTIONS,
  type PositionData,
  type SystemContextSnapshot,
  id,
  measureBrowserDragPhase
} from '@asyra/utils'
import {
  VECTOR_TOKENS,
  defineFeature,
  getVectorPointTargetPosition,
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
  PathEditingContinuationState,
  SelectedVectorPointState,
  SelectedVectorSegmentState
} from '../../common-apis/system-context'
import {
  FEATURE_MOVEMENT_THRESHOLD,
  FeatureNames,
  InputSystemEvents,
  PrimaryToolType
} from '../../constants'
import {
  createPointHandleComputedPatchIntent,
  createPathEditingVectorOperationRequest,
  createStructuralVectorOperationPatchIntent,
  type PointHandleComputedPatchIntent,
  type PathEditingVectorOperationRequest
} from '../path-editing-intents'
import type { StructuralVectorOperationPatchIntent } from '../../common-apis/element/vector-operation-intent'

interface PenState extends Record<string, unknown> {
  elementId: string
  pointId: string
  connectedPointId: string | null
  connectionSide: VectorEndpointSide
  autoUpdateConnectedHandleTarget: VectorHandleTarget | null
  initialHandlePositions: VectorHandleInitialPosition[]
  structuralOperationIntent?: StructuralVectorOperationPatchIntent | null
  runtimeBefore: VectorEditingRuntimeState
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
  operationRequest?: PathEditingVectorOperationRequest | null
  computedPatchIntent?: PointHandleComputedPatchIntent | null
  runtimeBefore: VectorEditingRuntimeState
}

interface VectorEditingRuntimeState {
  pathEditingVectorId: string | null
  pathEditingStartNewSubpath: boolean
  pathEditingContinuation: PathEditingContinuationState | null
  selectedVectorPoint: SelectedVectorPointState | null
  selectedVectorSegment: SelectedVectorSegmentState | null
  hoveredVectorPoint: SelectedVectorPointState | null
  hoveredVectorSegment: SelectedVectorSegmentState | null
  hoveredVectorSegmentInsertPoint: ReturnType<
    typeof systemContextApis.getHoveredVectorSegmentInsertPoint
  >
}

const captureVectorEditingRuntimeState = (): VectorEditingRuntimeState => ({
  pathEditingVectorId: systemContextApis.getPathEditingVectorId(),
  pathEditingStartNewSubpath: systemContextApis.getPathEditingStartNewSubpath(),
  pathEditingContinuation: systemContextApis.getPathEditingContinuation(),
  selectedVectorPoint: systemContextApis.getSelectedVectorPoint(),
  selectedVectorSegment: systemContextApis.getSelectedVectorSegment(),
  hoveredVectorPoint: systemContextApis.getHoveredVectorPoint(),
  hoveredVectorSegment: systemContextApis.getHoveredVectorSegment(),
  hoveredVectorSegmentInsertPoint:
    systemContextApis.getHoveredVectorSegmentInsertPoint()
})

const restoreVectorEditingRuntimeState = (state: VectorEditingRuntimeState) => {
  systemContextApis.setPathEditingVectorId(state.pathEditingVectorId)
  systemContextApis.setPathEditingStartNewSubpath(
    state.pathEditingStartNewSubpath
  )
  systemContextApis.setPathEditingContinuation(state.pathEditingContinuation)
  systemContextApis.setSelectedVectorPoint(state.selectedVectorPoint)
  systemContextApis.setSelectedVectorSegment(state.selectedVectorSegment)
  systemContextApis.setHoveredVectorPoint(state.hoveredVectorPoint)
  systemContextApis.setHoveredVectorSegment(state.hoveredVectorSegment)
  systemContextApis.setHoveredVectorSegmentInsertPoint(
    state.hoveredVectorSegmentInsertPoint
  )
}

type VectorHandleTarget = Exclude<
  VectorPointTarget,
  typeof VECTOR_TOKENS.POINT.TARGET.ANCHOR
>

interface VectorHandleInitialPosition {
  pointId: string
  target: VectorHandleTarget
  position: Vec2 | null
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

type Vec2 = PositionData

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

const getConnectedHandleTargetForSide = (
  side: VectorEndpointSide
): VectorHandleTarget =>
  side === VECTOR_TOKENS.ENDPOINT.SIDE.START
    ? VECTOR_TOKENS.POINT.TARGET.IN_HANDLE
    : VECTOR_TOKENS.POINT.TARGET.OUT_HANDLE

const getControlRoleForHandleTarget = (target: VectorHandleTarget) =>
  target === VECTOR_TOKENS.POINT.TARGET.IN_HANDLE
    ? VECTOR_TOKENS.CONTROL.ROLE.IN
    : VECTOR_TOKENS.CONTROL.ROLE.OUT

const hasActualControlRecord = (
  elementId: string,
  pointId: string,
  target: VectorHandleTarget
): boolean => {
  const topology = elementApis.getVectorTopology(elementId)
  const role = getControlRoleForHandleTarget(target)

  return Object.values(topology.points).some(
    (point) =>
      point.kind === VECTOR_TOKENS.POINT.KIND.CONTROL &&
      point.controlForId === pointId &&
      point.controlRole === role
  )
}

const resolveAutoUpdateConnectedHandleTarget = (
  elementId: string,
  continuation: PathEditingContinuationState | null
): VectorHandleTarget | null => {
  if (!continuation) {
    return null
  }

  const topology = elementApis.getVectorTopology(elementId)
  const network = topology.networks[continuation.networkId]
  if (
    !network ||
    network.closed ||
    network.pointIds.length !== 1 ||
    network.segmentIds.length !== 0 ||
    network.pointIds[0] !== continuation.pointId
  ) {
    return null
  }

  const target = getConnectedHandleTargetForSide(continuation.side)
  return hasActualControlRecord(elementId, continuation.pointId, target)
    ? null
    : target
}

const flushSelectedVectorPointMirror = (
  next: SelectedVectorPointState | null
) => {
  systemContextApis.setSelectedVectorPoint(next)
}

const computeFirstSegmentStyleHandles = (
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

const getHandleTargetPosition = (
  point: VectorAnchorPoint | null | undefined,
  target: VectorHandleTarget
): Vec2 | null => {
  if (!point) {
    return null
  }

  return target === VECTOR_TOKENS.POINT.TARGET.IN_HANDLE
    ? point.inHandle
    : point.outHandle
}

const getNewPointSegmentHandleTarget = (
  connectionSide: VectorEndpointSide
): VectorHandleTarget =>
  connectionSide === VECTOR_TOKENS.ENDPOINT.SIDE.START
    ? VECTOR_TOKENS.POINT.TARGET.OUT_HANDLE
    : VECTOR_TOKENS.POINT.TARGET.IN_HANDLE

const getNewPointOppositeHandleTarget = (
  connectionSide: VectorEndpointSide
): VectorHandleTarget =>
  connectionSide === VECTOR_TOKENS.ENDPOINT.SIDE.START
    ? VECTOR_TOKENS.POINT.TARGET.IN_HANDLE
    : VECTOR_TOKENS.POINT.TARGET.OUT_HANDLE

const getAutoUpdatedConnectedHandleTarget = (
  connectionSide: VectorEndpointSide,
  autoUpdateConnectedHandleTarget: VectorHandleTarget | null
): VectorHandleTarget =>
  autoUpdateConnectedHandleTarget ??
  getConnectedHandleTargetForSide(connectionSide)

const getBezierDragInitialHandlePositions = (
  elementId: string,
  pointId: string,
  connectedPointId: string | null,
  connectionSide: VectorEndpointSide,
  autoUpdateConnectedHandleTarget: VectorHandleTarget | null
): VectorHandleInitialPosition[] => {
  const newPoint = elementApis.getVectorAnchorPointById(elementId, pointId)
  const connectedPoint = connectedPointId
    ? elementApis.getVectorAnchorPointById(elementId, connectedPointId)
    : null
  const positions: VectorHandleInitialPosition[] = []

  if (connectedPointId) {
    const target = getAutoUpdatedConnectedHandleTarget(
      connectionSide,
      autoUpdateConnectedHandleTarget
    )
    positions.push({
      pointId: connectedPointId,
      target,
      position: getHandleTargetPosition(connectedPoint?.point, target)
    })
  }

  const segmentTarget = getNewPointSegmentHandleTarget(connectionSide)
  positions.push({
    pointId,
    target: segmentTarget,
    position: getHandleTargetPosition(newPoint?.point, segmentTarget)
  })

  const oppositeTarget = getNewPointOppositeHandleTarget(connectionSide)
  positions.push({
    pointId,
    target: oppositeTarget,
    position: getHandleTargetPosition(newPoint?.point, oppositeTarget)
  })

  return positions
}

const resetBezierDragHandlesToInitial = (state: PenState) => {
  if (state.initialHandlePositions.length === 0) {
    return
  }

  elementApis.updateVectorAnchorPointHandles(
    state.elementId,
    state.initialHandlePositions.map((handle) => ({
      pointId: handle.pointId,
      target: handle.target,
      position: handle.position
    })),
    {
      undoable: false,
      skipResult: true
    }
  )
}

const syncSelectedVectorPointMirror = (
  elementId: string,
  selectedPoint: { point: VectorAnchorPoint; index: number } | null,
  target: VectorPointTarget
) => {
  if (!selectedPoint) {
    return false
  }

  const targetPosition = getVectorPointTargetPosition(
    selectedPoint.point,
    target
  )
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

  flushSelectedVectorPointMirror(nextState)
  return true
}

const updateVectorPointTargetPosition = (
  targetState: VectorPointDragTargetState,
  position: { x: number; y: number },
  options?: EVENT_OPTIONS & { skipResult?: boolean }
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
  mouseWorkspacePos: { x: number; y: number },
  options?: EVENT_OPTIONS & { skipResult?: boolean }
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
  const connectedTarget = getAutoUpdatedConnectedHandleTarget(
    state.connectionSide,
    state.autoUpdateConnectedHandleTarget
  )
  const currentSegmentTarget = getNewPointSegmentHandleTarget(
    state.connectionSide
  )
  const currentOppositeTarget = getNewPointOppositeHandleTarget(
    state.connectionSide
  )

  const firstSegmentHandles =
    state.autoUpdateConnectedHandleTarget ===
      VECTOR_TOKENS.POINT.TARGET.OUT_HANDLE &&
    state.connectionSide === VECTOR_TOKENS.ENDPOINT.SIDE.END
      ? computeFirstSegmentStyleHandles(
          connectedPoint,
          newPoint,
          mouseWorkspacePos
        )
      : null

  let connectedHandle =
    state.connectionSide === VECTOR_TOKENS.ENDPOINT.SIDE.START
      ? computeConnectedInHandle(connectedPoint)
      : computeConnectedOutHandle(connectedPoint)
  if (firstSegmentHandles) {
    connectedHandle = firstSegmentHandles.connectedOutHandle
  }
  const currentSegmentHandle = firstSegmentHandles
    ? firstSegmentHandles.currentInHandle
    : symmetric.inHandle
  const currentOppositeHandle = firstSegmentHandles
    ? firstSegmentHandles.currentOutHandle
    : symmetric.outHandle

  elementApis.updateVectorAnchorPointHandles(
    state.elementId,
    [
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
    ],
    options
  )

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

const removeSelectedSinglePointSubpathOnCancel = (
  elementId: string | null
): boolean => {
  if (!elementId) {
    return false
  }

  const subpaths = elementApis.getVectorAnchorSubpaths(elementId)
  const lastSubpath = subpaths[subpaths.length - 1]
  if (!lastSubpath || lastSubpath.length !== 1) {
    return false
  }

  const singlePointId = lastSubpath[0].id
  const selectedPoint = systemContextApis.getSelectedVectorPoint()
  const continuation = systemContextApis.getPathEditingContinuation()
  let activePointId: string | null = null
  if (continuation?.elementId === elementId) {
    activePointId = continuation.pointId
  }
  if (
    selectedPoint?.elementId === elementId &&
    selectedPoint.target === VECTOR_TOKENS.POINT.TARGET.ANCHOR
  ) {
    activePointId = selectedPoint.pointId
  }

  if (activePointId !== singlePointId) {
    return false
  }

  const removed = elementApis.removeLastSinglePointSubpath(elementId)
  if (!removed) {
    return false
  }

  systemContextApis.setPathEditingStartNewSubpath(true)
  systemContextApis.setPathEditingContinuation(null)
  systemContextApis.setHoveredVectorSegment(null)
  systemContextApis.setHoveredVectorSegmentInsertPoint(null)
  cursorApis.resetCanvasCursor()
  return true
}

export const penFeature = defineFeature<Record<string, unknown>, PenState>(
  FeatureNames.PEN,
  InputSystemEvents.INPUT_DRAG,
  {
    priority: 15,
    exclusive: true,
    cancelPolicy: 'commit-current',
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

        const runtimeBefore = captureVectorEditingRuntimeState()

        const selectedIds = selectionApis.getSelectedIds()
        const pathEditingVectorId = systemContextApis.getPathEditingVectorId()
        const startNewSubpath =
          systemContextApis.getPathEditingStartNewSubpath()

        if (isPathEditingVectorSelected(selectedIds, pathEditingVectorId)) {
          const clickedPoint = elementApis.getVectorEditablePointAtClientPos(
            pathEditingVectorId,
            snapshot.mousePosition
          )
          const hoveredPoint = systemContextApis.getHoveredVectorPoint()
          const hoveredSegment = systemContextApis.getHoveredVectorSegment()
          const hoveredSegmentInsertPoint =
            systemContextApis.getHoveredVectorSegmentInsertPoint()

          if (
            clickedPoint &&
            clickedPoint.target === VECTOR_TOKENS.POINT.TARGET.ANCHOR
          ) {
            const selectedVectorPoint =
              systemContextApis.getSelectedVectorPoint()
            const sourceContinuation =
              selectedVectorPoint?.elementId === pathEditingVectorId &&
              selectedVectorPoint.target === VECTOR_TOKENS.POINT.TARGET.ANCHOR
                ? elementApis.getVectorAnchorContinuation(
                    pathEditingVectorId,
                    selectedVectorPoint.pointId
                  )
                : null
            const selectedPoint = elementApis.getVectorAnchorPointById(
              pathEditingVectorId,
              clickedPoint.point.id
            )
            setSelectedAnchorPoint(pathEditingVectorId, selectedPoint)
            systemContextApis.setSelectedVectorSegment(null)
            systemContextApis.setHoveredVectorSegment(null)
            systemContextApis.setHoveredVectorSegmentInsertPoint(null)
            systemContextApis.setHoveredVectorPoint(null)

            if (
              startNewSubpath ||
              !sourceContinuation ||
              sourceContinuation.pointId === clickedPoint.point.id
            ) {
              systemContextApis.setPathEditingStartNewSubpath(false)
              return null
            }

            const structuralOperationIntent =
              createStructuralVectorOperationPatchIntent({
                elementId: pathEditingVectorId,
                operation: 'connect-anchors',
                inputIds: [sourceContinuation.pointId, clickedPoint.point.id],
                changedRecords: ['segment:create'],
                undoable: true
              })
            if (!structuralOperationIntent) {
              return null
            }

            const connected = elementApis.connectVectorAnchorPoints(
              pathEditingVectorId,
              sourceContinuation.pointId,
              clickedPoint.point.id,
              {
                structuralOperationIntent
              }
            )
            if (!connected) {
              return null
            }

            selectionApis.selectElements([pathEditingVectorId])
            const nextSelectedPoint = elementApis.getVectorAnchorPointById(
              pathEditingVectorId,
              clickedPoint.point.id
            )
            setSelectedAnchorPoint(pathEditingVectorId, nextSelectedPoint)
            systemContextApis.setSelectedVectorSegment(null)
            systemContextApis.setHoveredVectorSegment(null)
            systemContextApis.setHoveredVectorSegmentInsertPoint(null)
            systemContextApis.setHoveredVectorPoint(null)
            systemContextApis.setPathEditingStartNewSubpath(false)
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
            const structuralOperationIntent =
              createStructuralVectorOperationPatchIntent({
                elementId: pathEditingVectorId,
                operation: 'split-segment',
                inputIds: [activeHoveredSegmentHit.segmentId],
                changedRecords: ['segment:replace', 'point:create'],
                undoable: true
              })
            if (!structuralOperationIntent) {
              return null
            }

            const insertedPoint = elementApis.splitVectorSegmentAtWorkspacePos(
              pathEditingVectorId,
              activeHoveredSegmentHit.segmentId,
              activeHoveredSegmentHit.position,
              {
                structuralOperationIntent
              }
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

          const continuation = systemContextApis.getPathEditingContinuation()
          const connectedPointId = continuation?.pointId ?? null
          const connectionSide =
            continuation?.side ?? VECTOR_TOKENS.ENDPOINT.SIDE.END
          const autoUpdateConnectedHandleTarget =
            resolveAutoUpdateConnectedHandleTarget(
              pathEditingVectorId,
              continuation ?? null
            )
          const newPoint = createAnchorPoint(dragStartWorkspace)
          const structuralOperationIntent =
            createStructuralVectorOperationPatchIntent({
              elementId: pathEditingVectorId,
              operation: 'append-anchor',
              inputIds: [
                newPoint.id,
                ...(connectedPointId ? [connectedPointId] : [])
              ],
              changedRecords: connectedPointId
                ? ['point:create', 'segment:create']
                : ['point:create'],
              undoable: true
            })
          if (!structuralOperationIntent) {
            return null
          }

          const newSelectedPoint = elementApis.appendVectorAnchorPoint(
            pathEditingVectorId,
            newPoint,
            {
              startNewSubpath,
              continuation,
              sharedDelivery: 'immediate',
              structuralOperationIntent
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
            autoUpdateConnectedHandleTarget,
            initialHandlePositions: getBezierDragInitialHandlePositions(
              pathEditingVectorId,
              newPoint.id,
              connectedPointId,
              connectionSide,
              autoUpdateConnectedHandleTarget
            ),
            structuralOperationIntent,
            runtimeBefore
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
          autoUpdateConnectedHandleTarget: null,
          initialHandlePositions: [],
          structuralOperationIntent: createStructuralVectorOperationPatchIntent(
            {
              elementId,
              operation: 'append-anchor',
              inputIds: [firstPoint.id],
              changedRecords: ['point:create'],
              undoable: true
            }
          ),
          runtimeBefore
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

        applyBezierDragForNewPoint(state, mouseWorkspacePos, {
          undoable: false,
          sharedDelivery: 'immediate',
          skipResult: true
        })

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
          resetBezierDragHandlesToInitial(state)
          applyBezierDragForNewPoint(state, mouseWorkspacePos, {
            undoable: true,
            skipResult: true
          })
        }

        const selectedPoint = elementApis.getVectorAnchorPointById(
          state.elementId,
          state.pointId
        )
        setSelectedAnchorPoint(state.elementId, selectedPoint)
        return
      },
      onCancel: (_snapshot, state): undefined => {
        restoreVectorEditingRuntimeState(state.runtimeBefore)
        cursorApis.resetCanvasCursor()
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
  cancelPolicy: 'commit-current',
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

      const runtimeBefore = captureVectorEditingRuntimeState()

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
          const operationRequest = createPathEditingVectorOperationRequest({
            selectedElementIds: selectedIds,
            pathEditingVectorId,
            hoveredPoint: null,
            hoveredSegment: {
              elementId: pathEditingVectorId,
              segmentId: activeHoveredSegmentId
            }
          })

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
            dragTarget: null,
            operationRequest,
            runtimeBefore
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
        activeHoveredPoint.target === VECTOR_TOKENS.POINT.TARGET.ANCHOR
          ? selectedPoint &&
            getVectorPointTargetPosition(
              selectedPoint.point,
              activeHoveredPoint.target
            )
          : {
              x: activeHoveredPoint.x,
              y: activeHoveredPoint.y
            }
      const operationRequest = createPathEditingVectorOperationRequest({
        selectedElementIds: selectedIds,
        pathEditingVectorId,
        hoveredPoint: activeHoveredPoint,
        hoveredSegment: null
      })

      return {
        operationRequest,
        runtimeBefore,
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

      const computedPatchIntent = createPointHandleComputedPatchIntent({
        dragTarget,
        currentWorkspacePos,
        phase: 'update'
      })
      if (!computedPatchIntent) {
        return
      }

      const updatedPoint = measureBrowserDragPhase(
        'pen-tool:drag-point-update',
        () =>
          updateVectorPointTargetPosition(
            dragTarget,
            computedPatchIntent.patch.position,
            {
              undoable: computedPatchIntent.patch.undoable,
              sharedDelivery: 'immediate',
              skipResult: computedPatchIntent.patch.skipResult
            }
          )
      )
      if (updatedPoint === null) {
        return
      }

      state.computedPatchIntent = computedPatchIntent
      dragTarget.hasMoved = true
      return
    },
    onEnd: (snapshot: SystemContextSnapshot, state: SelectVectorPointState) => {
      const dragTarget = state.dragTarget
      if (!dragTarget) {
        return
      }

      try {
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

        const computedPatchIntent = createPointHandleComputedPatchIntent({
          dragTarget,
          currentWorkspacePos,
          phase: 'commit'
        })
        if (!computedPatchIntent) {
          return
        }

        const currentPoint = elementApis.getVectorAnchorPointById(
          dragTarget.elementId,
          dragTarget.pointId
        )
        const currentTargetPos =
          currentPoint &&
          getVectorPointTargetPosition(currentPoint.point, dragTarget.target)
        if (
          !currentTargetPos ||
          currentTargetPos.x !== computedPatchIntent.patch.position.x ||
          currentTargetPos.y !== computedPatchIntent.patch.position.y
        ) {
          updateVectorPointTargetPosition(
            dragTarget,
            computedPatchIntent.patch.position,
            {
              undoable: false,
              skipResult: true
            }
          )
        }

        updateVectorPointTargetPosition(
          dragTarget,
          dragTarget.initialTargetPos,
          {
            undoable: false,
            skipResult: true
          }
        )
        updateVectorPointTargetPosition(
          dragTarget,
          computedPatchIntent.patch.position,
          {
            undoable: computedPatchIntent.patch.undoable,
            skipResult: computedPatchIntent.patch.skipResult
          }
        )
        state.computedPatchIntent = computedPatchIntent
        const committedPoint = elementApis.getVectorAnchorPointById(
          dragTarget.elementId,
          dragTarget.pointId
        )
        if (!committedPoint) {
          return
        }
        syncSelectedVectorPointMirror(
          dragTarget.elementId,
          committedPoint,
          dragTarget.target
        )
      } finally {
        state.dragTarget = null
      }
      return
    },
    onCancel: (_snapshot, state): undefined => {
      state.dragTarget = null
      restoreVectorEditingRuntimeState(state.runtimeBefore)
      cursorApis.resetCanvasCursor()
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

        if (rawHoveredPoint.target !== VECTOR_TOKENS.POINT.TARGET.ANCHOR) {
          return null
        }

        return rawHoveredPoint
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
      let hoveredSegment: SelectedVectorSegmentState | null = null
      const suppressConnectedSegmentHover =
        snapshot.primaryTool === PrimaryToolType.PEN &&
        previewMode === PenHoverPreviewMode.CONNECTED_SEGMENT_PREVIEW
      if (hoveredSegmentHit && !suppressConnectedSegmentHover) {
        hoveredSegment = {
          elementId: pathEditingVectorId,
          segmentId: hoveredSegmentHit.segmentId
        }
      }

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
        if (snapshot.primaryTool === PrimaryToolType.PEN) {
          const startNewSubpath =
            systemContextApis.getPathEditingStartNewSubpath()

          if (!startNewSubpath) {
            if (removeSelectedSinglePointSubpathOnCancel(editingVectorId)) {
              return {
                cancelled: true,
                elementId: editingVectorId,
                mode: 'remove-single-point-subpath'
              }
            }

            systemContextApis.setPathEditingStartNewSubpath(true)
            systemContextApis.setPathEditingContinuation(null)
            systemContextApis.setHoveredVectorSegment(null)
            systemContextApis.setHoveredVectorSegmentInsertPoint(null)
            cursorApis.resetCanvasCursor()
            return {
              cancelled: true,
              elementId: editingVectorId,
              mode: 'disconnect-pen-continuation'
            }
          }

          systemContextApis.exitPathEditingMode()
          cursorApis.resetCanvasCursor()
          return {
            cancelled: true,
            elementId: editingVectorId,
            mode: 'exit-path-editing'
          }
        }

        systemContextApis.exitPathEditingMode()
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
