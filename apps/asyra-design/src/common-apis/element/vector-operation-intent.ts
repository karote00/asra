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
