import type { VectorPointTarget } from '@asyra/core'

export interface PathEditingHoveredPointInput {
  elementId: string
  pointId: string
  index: number
  target: VectorPointTarget
  x: number
  y: number
}

export interface PathEditingHoveredSegmentInput {
  elementId: string
  segmentId: string
}

interface PathEditingIntentEvidence {
  selectedElementIds: string[]
  pathEditingVectorId: string
  source: 'path-editing-hover-state'
}

interface PathEditingIntentBase {
  kind: 'bounded-vector-operation-request'
  routeId: 'path-editing-intent'
  ownerStage: 'Interaction'
  elementId: string
  inputEvidence: PathEditingIntentEvidence
  outputRevision: string
}

export type PathEditingVectorPointOperationRequest = PathEditingIntentBase & {
  operation: 'select-vector-point'
  target: {
    pointId: string
    index: number
    target: VectorPointTarget
    position: {
      x: number
      y: number
    }
  }
}

export type PathEditingVectorSegmentOperationRequest = PathEditingIntentBase & {
  operation: 'select-vector-segment'
  target: {
    segmentId: string
  }
}

export type PathEditingVectorOperationRequest =
  | PathEditingVectorPointOperationRequest
  | PathEditingVectorSegmentOperationRequest

export type PointHandleDragPhase = 'update' | 'commit'

export interface PointHandleDragTargetInput {
  elementId: string
  pointId: string
  index?: number
  target: VectorPointTarget
  dragStartWorkspacePos: {
    x: number
    y: number
  }
  initialTargetPos: {
    x: number
    y: number
  }
}

export interface PointHandleComputedPatchIntent {
  kind: 'point-handle-computed-patch-intent'
  routeId: 'point-handle-drag-operation'
  ownerStage: 'Interaction'
  operation: 'move-vector-point-target'
  phase: PointHandleDragPhase
  elementId: string
  pointId: string
  target: VectorPointTarget
  patch: {
    position: {
      x: number
      y: number
    }
    undoable: boolean
    skipResult: true
  }
  inputEvidence: {
    pointId: string
    target: VectorPointTarget
    dragStartWorkspacePos: {
      x: number
      y: number
    }
    currentWorkspacePos: {
      x: number
      y: number
    }
  }
  outputRevision: string
}

export type StructuralVectorOperation =
  | 'append-anchor'
  | 'remove-anchor'
  | 'split-segment'
  | 'connect-anchors'
  | 'close-subpath'
  | 'set-anchor-type'
  | 'set-handle-mode'
  | 'update-handle-position'

export type StructuralVectorChangedRecord =
  | 'point:create'
  | 'point:remove'
  | 'point:position'
  | 'point:type'
  | 'point:handleMode'
  | 'point:inHandle'
  | 'point:outHandle'
  | 'segment:create'
  | 'segment:remove'
  | 'segment:replace'
  | 'network:close'

export interface StructuralVectorOperationPatchIntent {
  kind: 'operation-scoped-topology-patch-intent'
  routeId: 'structural-vector-operation'
  ownerStage: 'Interaction'
  operation: StructuralVectorOperation
  elementId: string
  patch: {
    changedRecords: StructuralVectorChangedRecord[]
    undoable: boolean
  }
  inputEvidence: {
    operation: StructuralVectorOperation
    inputIds: string[]
  }
  outputRevision: string
}

export const createPathEditingVectorOperationRequest = ({
  selectedElementIds,
  pathEditingVectorId,
  hoveredPoint,
  hoveredSegment
}: {
  selectedElementIds: string[]
  pathEditingVectorId: string | null
  hoveredPoint: PathEditingHoveredPointInput | null
  hoveredSegment: PathEditingHoveredSegmentInput | null
}): PathEditingVectorOperationRequest | null => {
  if (
    !pathEditingVectorId ||
    selectedElementIds.length !== 1 ||
    selectedElementIds[0] !== pathEditingVectorId
  ) {
    return null
  }

  const inputEvidence: PathEditingIntentEvidence = {
    selectedElementIds: [...selectedElementIds],
    pathEditingVectorId,
    source: 'path-editing-hover-state'
  }

  if (hoveredPoint?.elementId === pathEditingVectorId) {
    return {
      kind: 'bounded-vector-operation-request',
      routeId: 'path-editing-intent',
      ownerStage: 'Interaction',
      operation: 'select-vector-point',
      elementId: pathEditingVectorId,
      target: {
        pointId: hoveredPoint.pointId,
        index: hoveredPoint.index,
        target: hoveredPoint.target,
        position: {
          x: hoveredPoint.x,
          y: hoveredPoint.y
        }
      },
      inputEvidence,
      outputRevision: `select-vector-point:${pathEditingVectorId}:${hoveredPoint.pointId}:${hoveredPoint.target}`
    }
  }

  if (hoveredSegment?.elementId === pathEditingVectorId) {
    return {
      kind: 'bounded-vector-operation-request',
      routeId: 'path-editing-intent',
      ownerStage: 'Interaction',
      operation: 'select-vector-segment',
      elementId: pathEditingVectorId,
      target: {
        segmentId: hoveredSegment.segmentId
      },
      inputEvidence,
      outputRevision: `select-vector-segment:${pathEditingVectorId}:${hoveredSegment.segmentId}`
    }
  }

  return null
}

export const createPointHandleComputedPatchIntent = ({
  dragTarget,
  currentWorkspacePos,
  phase
}: {
  dragTarget: PointHandleDragTargetInput | null
  currentWorkspacePos: { x: number; y: number } | null
  phase: PointHandleDragPhase
}): PointHandleComputedPatchIntent | null => {
  if (!dragTarget || !currentWorkspacePos) {
    return null
  }

  const position = {
    x:
      dragTarget.initialTargetPos.x +
      currentWorkspacePos.x -
      dragTarget.dragStartWorkspacePos.x,
    y:
      dragTarget.initialTargetPos.y +
      currentWorkspacePos.y -
      dragTarget.dragStartWorkspacePos.y
  }
  const undoable = phase === 'commit'

  return {
    kind: 'point-handle-computed-patch-intent',
    routeId: 'point-handle-drag-operation',
    ownerStage: 'Interaction',
    operation: 'move-vector-point-target',
    phase,
    elementId: dragTarget.elementId,
    pointId: dragTarget.pointId,
    target: dragTarget.target,
    patch: {
      position,
      undoable,
      skipResult: true
    },
    inputEvidence: {
      pointId: dragTarget.pointId,
      target: dragTarget.target,
      dragStartWorkspacePos: {
        x: dragTarget.dragStartWorkspacePos.x,
        y: dragTarget.dragStartWorkspacePos.y
      },
      currentWorkspacePos: {
        x: currentWorkspacePos.x,
        y: currentWorkspacePos.y
      }
    },
    outputRevision: [
      'point-handle-drag-operation',
      phase,
      dragTarget.elementId,
      dragTarget.pointId,
      dragTarget.target,
      position.x,
      position.y,
      undoable ? 'undoable' : 'transient'
    ].join(':')
  }
}

export const createStructuralVectorOperationPatchIntent = ({
  elementId,
  operation,
  inputIds,
  changedRecords,
  undoable
}: {
  elementId: string
  operation: StructuralVectorOperation
  inputIds: readonly string[]
  changedRecords: readonly StructuralVectorChangedRecord[]
  undoable: boolean
}): StructuralVectorOperationPatchIntent | null => {
  if (!elementId || inputIds.length === 0 || changedRecords.length === 0) {
    return null
  }

  return {
    kind: 'operation-scoped-topology-patch-intent',
    routeId: 'structural-vector-operation',
    ownerStage: 'Interaction',
    operation,
    elementId,
    patch: {
      changedRecords: [...changedRecords],
      undoable
    },
    inputEvidence: {
      operation,
      inputIds: [...inputIds]
    },
    outputRevision: [
      'structural-vector-operation',
      operation,
      elementId,
      changedRecords.join('|'),
      undoable ? 'undoable' : 'transient'
    ].join(':')
  }
}
