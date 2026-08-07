import type {
  ElementPropertyPatchUpdate,
  ElementPropertyRecordFields,
  ElementPropertyRecordPatch,
  ElementPropertyValuesUpdate,
  VectorAnchorPoint,
  VectorEndpointSide,
  VectorPathStyle,
  VectorPointNode,
  VectorTopology
} from '@asyra/core'
import {
  VECTOR_TOKENS,
  getVectorControlId as getControlId,
  isVectorAnchorNode as isAnchorNode,
  isVectorControlNode as isControlNode,
  runTransaction
} from '@asyra/core'
import type {
  ComputedDataPatch,
  CreateElementData,
  DataTypes,
  PositionData,
  EVENT_OPTIONS
} from '@asyra/utils'
import {
  StrokeJoinTypes,
  createDefaultStrokes,
  emitDiagnosticCounter,
  measureBrowserDragPhase
} from '@asyra/utils'
import { isEqual } from 'lodash'
import {
  PresetSystemPropertyKeys,
  getVectorRenderLocalPoint,
  getVectorRenderWorkspacePoint
} from '@asyra/preset'
import core, { render, sceneTree } from '../../contexts'
import {
  DEFAULT_VECTOR_STROKE_COLOR,
  type VectorHandleMode
} from '../../constants'
import {
  createEmptyVectorTopology,
  createVectorTopologyFromSinglePoint,
  getAnchorContinuationInTopology,
  getAnchorEndpointInTopology,
  getOrderedNetworks,
  isClosedVectorTopology,
  isVectorTopology,
  removeLastSinglePointSubpath,
  setAnchorHandleInTopology,
  setAnchorTypeInTopology,
  setTopologyClosed,
  vectorTopologyToAnchorPoints,
  vectorTopologyToAnchorSubpaths
} from './vector-topology'
import {
  calculateVectorBounds,
  normalizeVectorTopology
} from './vector-geometry'
import {
  isVectorComputedData,
  vectorGeometry,
  type VectorComputedData,
  type VectorPointUpdate
} from './vector-consistency'
import { getVectorAnchorHandleMode } from './handle-mode'
import { projectPointToCubicBezier } from './bezier-adapter'
import type {
  CreateElementOptions,
  VectorEditablePointHit,
  VectorPointTarget,
  VectorSegmentHit
} from './types'
import { selectionApis } from '../selection'
import { systemContextApis } from '../system-context'
import type {
  StructuralVectorChangedRecord,
  StructuralVectorOperation,
  StructuralVectorOperationPatchIntent
} from './vector-operation-intent'

const DEFAULT_VECTOR_STYLE: VectorPathStyle = {
  closed: false,
  fills: [],
  strokes: createDefaultStrokes({
    color: DEFAULT_VECTOR_STROKE_COLOR,
    joinType: StrokeJoinTypes.MITER
  })
}

const VECTOR_POINT_HIT_RADIUS = 6
const VECTOR_SEGMENT_HIT_RADIUS = 8

interface VectorHandleUpdate {
  pointId: string
  target: Exclude<VectorPointTarget, typeof VECTOR_TOKENS.POINT.TARGET.ANCHOR>
  position: PositionData | null
  forceSmooth?: boolean
}

interface AppendAnchorOperation {
  type: 'appendAnchor'
  pointId: string
}

interface RemoveAnchorOperation {
  type: 'removeAnchor'
  pointId: string
}

interface SplitSegmentOperation {
  type: 'splitSegment'
  segmentId: string
  pointId: string
}

interface ConnectEndpointsOperation {
  type: 'connectEndpoints'
  sourcePointId: string
  targetPointId: string
}

interface ConnectAnchorsOperation {
  type: 'connectAnchors'
  sourcePointId: string
  targetPointId: string
}

interface SetClosedOperation {
  type: 'setClosed'
  closed: boolean
}

interface SetAnchorTypeOperation {
  type: 'setAnchorType'
  pointId: string
}

interface SetHandleModeOperation {
  type: 'setHandleMode'
  pointId: string
  mode: VectorHandleMode
}

interface SetHandlesOperation {
  type: 'setHandles'
  updates: VectorHandleUpdate[]
}

interface RemoveLastSinglePointSubpathOperation {
  type: 'removeLastSinglePointSubpath'
}

type VectorTopologyOperation =
  | AppendAnchorOperation
  | RemoveAnchorOperation
  | SplitSegmentOperation
  | ConnectEndpointsOperation
  | ConnectAnchorsOperation
  | SetClosedOperation
  | SetAnchorTypeOperation
  | SetHandleModeOperation
  | SetHandlesOperation
  | RemoveLastSinglePointSubpathOperation

interface VectorOperationIntentOptions {
  structuralOperationIntent?: StructuralVectorOperationPatchIntent | null
  transientPreview?: boolean
}

type VectorPointMutationOptions = EVENT_OPTIONS &
  VectorOperationIntentOptions & {
    skipResult?: boolean
  }

type VectorTopologyOperationOptions = EVENT_OPTIONS &
  VectorOperationIntentOptions & {
    closed?: boolean
  }

type VectorOperationOptions = EVENT_OPTIONS &
  VectorOperationIntentOptions & {
    skipResult?: boolean
    closed?: boolean
  }

export interface AppendVectorAnchorPointOptions extends EVENT_OPTIONS {
  startNewSubpath?: boolean
  continuation?: {
    networkId: string
    pointId: string
    side: VectorEndpointSide
  } | null
  structuralOperationIntent?: StructuralVectorOperationPatchIntent | null
}

export interface ValidatedVectorComputedPatchRequest {
  kind: 'validated-computed-patch-request'
  routeId: 'common-api-domain-adapter'
  ownerStage: 'Model Commit'
  sourceRouteId: 'structural-vector-operation'
  elementId: string
  operation: StructuralVectorOperation
  patch: ComputedDataPatch
  eventOptions: {
    undoable: boolean
  }
  inputEvidence: {
    intentRevision: string
    inputIds: string[]
    changedRecords: StructuralVectorChangedRecord[]
  }
  validation: {
    elementMatched: true
    operationMatched: true
    hasPatchOperations: true
    renderFieldsAbsent: true
  }
}

const toVectorEventOptions = (
  options?: VectorOperationOptions
): EVENT_OPTIONS | undefined => {
  if (!options) {
    return
  }

  const {
    skipResult: _skipResult,
    closed: _closed,
    structuralOperationIntent: _structuralOperationIntent,
    transientPreview: _transientPreview,
    ...eventOptions
  } = options
  return eventOptions
}

const transientWorkspaceTopologyCache = new Map<string, VectorTopology>()
const transientComputedSnapshotCache = new Map<string, VectorComputedData>()

const getDistanceSquared = (a: PositionData, b: PositionData) => {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return dx * dx + dy * dy
}

const getProjectedPointOnLineSegment = (
  from: PositionData,
  to: PositionData,
  point: PositionData
): { position: PositionData; t: number } => {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const lenSquared = dx * dx + dy * dy
  if (lenSquared === 0) {
    return {
      position: { x: from.x, y: from.y },
      t: 0
    }
  }

  const t = Math.max(
    0,
    Math.min(
      1,
      ((point.x - from.x) * dx + (point.y - from.y) * dy) / lenSquared
    )
  )

  return {
    position: {
      x: from.x + dx * t,
      y: from.y + dy * t
    },
    t
  }
}

const hasComputedDataPatchOperations = (patch: ComputedDataPatch) => {
  if (Object.keys(patch.values ?? {}).length > 0) {
    return true
  }

  return Object.values(patch.records ?? {}).some(
    (recordPatch) =>
      Object.keys(recordPatch.set ?? {}).length > 0 ||
      (recordPatch.remove?.length ?? 0) > 0
  )
}

const hasForbiddenRenderProductField = (value: unknown): boolean => {
  if (!value || typeof value !== 'object') {
    return false
  }

  for (const [key, child] of Object.entries(value)) {
    if (
      [
        'render',
        'geometry',
        'packet',
        'descriptor',
        'mask',
        'stroke',
        'join',
        'miterAngle',
        'resolvedJoin',
        'vertexAngle',
        'product'
      ].includes(key)
    ) {
      return true
    }
    if (hasForbiddenRenderProductField(child)) {
      return true
    }
  }

  return false
}

export const createValidatedVectorComputedPatchRequest = ({
  intent,
  elementId,
  operation,
  patch
}: {
  intent: StructuralVectorOperationPatchIntent | null | undefined
  elementId: string
  operation: StructuralVectorOperation
  patch: ComputedDataPatch
}): ValidatedVectorComputedPatchRequest | null => {
  if (
    !intent ||
    intent.kind !== 'operation-scoped-topology-patch-intent' ||
    intent.routeId !== 'structural-vector-operation' ||
    intent.ownerStage !== 'Interaction' ||
    intent.elementId !== elementId ||
    intent.operation !== operation ||
    intent.inputEvidence.operation !== operation ||
    intent.inputEvidence.inputIds.length === 0 ||
    intent.patch.changedRecords.length === 0 ||
    !hasComputedDataPatchOperations(patch) ||
    hasForbiddenRenderProductField(patch)
  ) {
    return null
  }

  return {
    kind: 'validated-computed-patch-request',
    routeId: 'common-api-domain-adapter',
    ownerStage: 'Model Commit',
    sourceRouteId: 'structural-vector-operation',
    elementId,
    operation,
    patch,
    eventOptions: {
      undoable: intent.patch.undoable
    },
    inputEvidence: {
      intentRevision: intent.outputRevision,
      inputIds: [...intent.inputEvidence.inputIds],
      changedRecords: [...intent.patch.changedRecords]
    },
    validation: {
      elementMatched: true,
      operationMatched: true,
      hasPatchOperations: true,
      renderFieldsAbsent: true
    }
  }
}

const getStructuralOperationForTopologyOperation = (
  operation: VectorTopologyOperation
): StructuralVectorOperation | null => {
  if (operation.type === 'appendAnchor') {
    return 'append-anchor'
  }
  if (operation.type === 'removeAnchor') {
    return 'remove-anchor'
  }
  if (operation.type === 'splitSegment') {
    return 'split-segment'
  }
  if (
    operation.type === 'connectAnchors' ||
    operation.type === 'connectEndpoints'
  ) {
    return 'connect-anchors'
  }
  if (operation.type === 'setClosed' && operation.closed) {
    return 'close-subpath'
  }
  if (operation.type === 'setAnchorType') {
    return 'set-anchor-type'
  }
  if (operation.type === 'setHandleMode') {
    return 'set-handle-mode'
  }
  if (operation.type === 'setHandles') {
    return 'update-handle-position'
  }
  return null
}

const getValidatedVectorComputedPatchRequest = ({
  structuralOperationIntent,
  elementId,
  operation,
  patch
}: {
  structuralOperationIntent:
    | StructuralVectorOperationPatchIntent
    | null
    | undefined
  elementId: string
  operation: StructuralVectorOperation | null
  patch: ComputedDataPatch
}) => {
  if (!structuralOperationIntent) {
    return null
  }
  if (!operation) {
    throw new Error(
      'Structural vector operation intent cannot be attached to this common API operation.'
    )
  }

  const request = createValidatedVectorComputedPatchRequest({
    intent: structuralOperationIntent,
    elementId,
    operation,
    patch
  })
  if (!request) {
    throw new Error(
      `Invalid structural vector operation intent for "${elementId}".`
    )
  }
  return request
}

const getComputedDataPatchOperationCount = (patch: ComputedDataPatch) =>
  Object.keys(patch.values ?? {}).length +
  Object.values(patch.records ?? {}).reduce(
    (count, recordPatch) =>
      count +
      Object.keys(recordPatch.set ?? {}).length +
      (recordPatch.remove?.length ?? 0),
    0
  )

const toCanonicalPropertyRecordPatches = (
  patch: ComputedDataPatch
): readonly ElementPropertyRecordPatch[] =>
  Object.entries(patch.records ?? {}).map(([key, recordPatch]) => ({
    key,
    ...(recordPatch.set === undefined
      ? {}
      : {
          set: Object.fromEntries(
            Object.entries(recordPatch.set).map(
              ([recordId, recordDescriptor]) => {
                const descriptor = recordDescriptor as Readonly<
                  Record<string, unknown>
                >
                if (descriptor.id !== undefined && descriptor.id !== recordId) {
                  throw new Error(
                    `Vector record key "${recordId}" does not match its id`
                  )
                }
                const {
                  id: _recordId,
                  type: _recordType,
                  ...recordFields
                } = descriptor
                return [
                  recordId,
                  recordFields satisfies ElementPropertyRecordFields
                ]
              }
            )
          )
        }),
    ...(recordPatch.remove === undefined
      ? {}
      : {
          remove: recordPatch.remove
        })
  }))

const toCanonicalVectorPropertyPatch = (
  elementId: string,
  patch: ComputedDataPatch
): ElementPropertyPatchUpdate => ({
  elementId,
  ...(patch.values === undefined ? {} : { values: patch.values }),
  records: toCanonicalPropertyRecordPatches(patch)
})

const commitCanonicalVectorPropertyPatch = (
  elementId: string,
  patch: ComputedDataPatch,
  options?: EVENT_OPTIONS
) =>
  core.patchElementProperties(
    [toCanonicalVectorPropertyPatch(elementId, patch)],
    options
  )

const setPatchValueIfChanged = (
  patch: ComputedDataPatch,
  computed: Partial<VectorComputedData> | null,
  key: keyof VectorComputedData,
  value: DataTypes
) => {
  if (computed && isEqual(computed[key], value)) {
    return
  }

  patch.values ??= {}
  patch.values[key] = value
}

const createRecordComputedPatch = <T extends Record<string, unknown>>(
  previous: T,
  next: T,
  options?: {
    setAll?: boolean
  }
): NonNullable<ComputedDataPatch['records']>[string] | null => {
  const recordPatch: NonNullable<ComputedDataPatch['records']>[string] = {}

  Object.entries(next).forEach(([recordId, value]) => {
    if (!options?.setAll && isEqual(previous[recordId], value)) {
      return
    }

    recordPatch.set ??= {}
    recordPatch.set[recordId] = value as DataTypes
  })

  Object.keys(previous).forEach((recordId) => {
    if (recordId in next) {
      return
    }

    recordPatch.remove ??= []
    recordPatch.remove.push(recordId)
  })

  if (
    Object.keys(recordPatch.set ?? {}).length === 0 &&
    (recordPatch.remove?.length ?? 0) === 0
  ) {
    return null
  }

  return recordPatch
}

const isTransientVectorPointDragUpdate = (options?: VectorOperationOptions) => {
  if (options?.transientPreview !== true || options.undoable !== false) {
    return false
  }

  const pathEditingMode =
    core.getSystemProperty<boolean>(
      PresetSystemPropertyKeys.PATH_EDITING_MODE
    ) ?? false
  if (!pathEditingMode) {
    return false
  }

  const mouseDragging =
    core.getSystemProperty<boolean>(PresetSystemPropertyKeys.MOUSE_DRAGGING) ??
    false
  const mouseDown =
    core.getSystemProperty<boolean>(PresetSystemPropertyKeys.MOUSE_DOWN) ??
    false
  return mouseDragging || mouseDown
}

const canReadTransientWorkspaceTopologyCache = () => {
  const pathEditingMode =
    core.getSystemProperty<boolean>(
      PresetSystemPropertyKeys.PATH_EDITING_MODE
    ) ?? false
  if (!pathEditingMode) {
    return false
  }

  return (
    core.getSystemProperty<boolean>(PresetSystemPropertyKeys.MOUSE_DRAGGING) ??
    false
  )
}

const getVectorOffset = (computed: { x?: number; y?: number }) => ({
  x: typeof computed.x === 'number' ? computed.x : 0,
  y: typeof computed.y === 'number' ? computed.y : 0
})

const getVectorComputed = (elementId: string) => {
  const element = sceneTree.getElementById(elementId)
  if (!element) {
    return null
  }

  const computedRaw =
    element.getAllComputedData() as Partial<VectorComputedData>
  if (!isVectorComputedData(computedRaw)) {
    return null
  }

  return computedRaw
}

const getVectorComputedForPointMutation = (elementId: string) => {
  if (canReadTransientWorkspaceTopologyCache()) {
    const cached = transientComputedSnapshotCache.get(elementId)
    if (cached) {
      return cached
    }
  }

  return getVectorComputed(elementId)
}

const clearTransientVectorCaches = (elementId: string) => {
  transientWorkspaceTopologyCache.delete(elementId)
  transientComputedSnapshotCache.delete(elementId)
}

const updateTransientComputedSnapshotFromPatch = (
  elementId: string,
  patch: ComputedDataPatch
) => {
  const cached = transientComputedSnapshotCache.get(elementId)
  if (!cached) {
    return
  }

  const nextSnapshot = {
    ...cached,
    ...(patch.values ?? {})
  } as VectorComputedData

  Object.entries(patch.records ?? {}).forEach(([key, recordPatch]) => {
    const currentRecord = nextSnapshot[key as keyof VectorComputedData]
    const nextRecord =
      currentRecord &&
      typeof currentRecord === 'object' &&
      !Array.isArray(currentRecord)
        ? {
            ...(currentRecord as unknown as Record<
              string,
              DataTypes | undefined
            >)
          }
        : {}

    Object.entries(recordPatch.set ?? {}).forEach(([recordId, value]) => {
      nextRecord[recordId] = value
    })
    const removeIds = new Set(recordPatch.remove ?? [])
    const retainedRecord = Object.fromEntries(
      Object.entries(nextRecord).filter(
        ([recordId]) => !removeIds.has(recordId)
      )
    )
    ;(nextSnapshot as unknown as Record<string, DataTypes>)[key] =
      retainedRecord
  })

  transientComputedSnapshotCache.set(elementId, nextSnapshot)
}

const getVectorTopologyLocal = (elementId: string): VectorTopology => {
  const computed = getVectorComputed(elementId)
  if (!computed) {
    return createEmptyVectorTopology()
  }

  const offset = getVectorOffset(computed)
  return {
    points: Object.fromEntries(
      Object.entries(computed.points).map(([pointId, point]) => [
        pointId,
        {
          ...point,
          x: point.x - offset.x,
          y: point.y - offset.y
        }
      ])
    ),
    segments: computed.segments,
    networks: computed.networks
  }
}

const getVectorTopologyStored = (elementId: string): VectorTopology => {
  return measureBrowserDragPhase('vector-api:topology-read', () => {
    if (canReadTransientWorkspaceTopologyCache()) {
      const cachedTopology = transientWorkspaceTopologyCache.get(elementId)
      if (cachedTopology) {
        emitDiagnosticCounter('vector-api-transient-topology-cache-hit')
        return cachedTopology
      }
      emitDiagnosticCounter('vector-api-transient-topology-cache-miss')
    }

    const computed = getVectorComputed(elementId)
    if (!computed) {
      return createEmptyVectorTopology()
    }

    if (canReadTransientWorkspaceTopologyCache()) {
      transientComputedSnapshotCache.set(elementId, computed)
    }

    return {
      points: computed.points,
      segments: computed.segments,
      networks: computed.networks
    }
  })
}

const projectStoredVectorPositionToWorkspace = (
  elementId: string,
  position: PositionData
): PositionData | null => {
  if (!render) {
    return position
  }
  const renderElement = render.getElementById(elementId)
  if (!renderElement) {
    return null
  }
  const localPosition = getVectorRenderLocalPoint(renderElement, position)
  return localPosition
    ? render.elementLocalToWorkspace(elementId, localPosition)
    : null
}

const projectStoredVectorAnchorPointToWorkspace = (
  elementId: string,
  point: VectorAnchorPoint
): VectorAnchorPoint | null => {
  const anchor = projectStoredVectorPositionToWorkspace(elementId, point)
  const inHandle = point.inHandle
    ? projectStoredVectorPositionToWorkspace(elementId, point.inHandle)
    : null
  const outHandle = point.outHandle
    ? projectStoredVectorPositionToWorkspace(elementId, point.outHandle)
    : null
  if (
    !anchor ||
    (point.inHandle && !inHandle) ||
    (point.outHandle && !outHandle)
  ) {
    return null
  }

  return {
    ...point,
    x: anchor.x,
    y: anchor.y,
    inHandle,
    outHandle
  }
}

const projectWorkspacePositionToStoredVector = (
  elementId: string,
  position: PositionData
): PositionData | null => {
  if (!render) {
    return position
  }
  const renderElement = render.getElementById(elementId)
  if (!renderElement) {
    return null
  }
  const localPosition = render.workspaceToElementLocal(elementId, position)
  return localPosition
    ? getVectorRenderWorkspacePoint(renderElement, localPosition)
    : null
}

const getVectorTopologyWorkspace = (elementId: string): VectorTopology => {
  const topology = getVectorTopologyStored(elementId)
  if (!render) {
    return topology
  }

  const points: Record<string, VectorPointNode> = {}
  for (const [pointId, point] of Object.entries(topology.points)) {
    const workspacePosition = projectStoredVectorPositionToWorkspace(
      elementId,
      point
    )
    if (!workspacePosition) {
      return createEmptyVectorTopology()
    }
    points[pointId] = {
      ...point,
      x: workspacePosition.x,
      y: workspacePosition.y
    }
  }
  return {
    points,
    segments: topology.segments,
    networks: topology.networks
  }
}

const measureVectorTopologyUpdate = <T>(operationName: string, run: () => T) =>
  measureBrowserDragPhase(`vector-api:topology-update:${operationName}`, run)

const hasHandleTarget = (
  topology: VectorTopology,
  pointId: string,
  target: Exclude<VectorPointTarget, typeof VECTOR_TOKENS.POINT.TARGET.ANCHOR>
) => {
  const controlId = getControlId(
    pointId,
    target === VECTOR_TOKENS.POINT.TARGET.IN_HANDLE
      ? VECTOR_TOKENS.CONTROL.ROLE.IN
      : VECTOR_TOKENS.CONTROL.ROLE.OUT
  )

  return isControlNode(topology.points[controlId])
}

const reconcileVectorSelectionAfterTopologyChange = (
  elementId: string,
  previousTopology: VectorTopology,
  nextTopology: VectorTopology
) => {
  const removedAnchorIds = new Set<string>()
  Object.entries(previousTopology.points).forEach(([pointId, point]) => {
    if (isAnchorNode(point) && !nextTopology.points[pointId]) {
      removedAnchorIds.add(pointId)
    }
  })

  const removedSegmentIds = new Set<string>()
  Object.keys(previousTopology.segments).forEach((segmentId) => {
    if (!nextTopology.segments[segmentId]) {
      removedSegmentIds.add(segmentId)
    }
  })

  const selectedVectorPoints = selectionApis
    .getSelectedVectorPoints()
    .filter((selection) => selection.elementId === elementId)
  const hasInvalidPointSelection = selectedVectorPoints.some((selection) => {
    if (removedAnchorIds.has(selection.pointId)) {
      return true
    }

    return (
      selection.target !== VECTOR_TOKENS.POINT.TARGET.ANCHOR &&
      !hasHandleTarget(nextTopology, selection.pointId, selection.target)
    )
  })

  if (hasInvalidPointSelection) {
    selectionApis.clearVectorPointSelection({ undoable: false })
    systemContextApis.setSelectedVectorPoint(null)
  }

  const hoveredVectorPoint = systemContextApis.getHoveredVectorPoint()
  if (
    hoveredVectorPoint &&
    hoveredVectorPoint.elementId === elementId &&
    (removedAnchorIds.has(hoveredVectorPoint.pointId) ||
      (hoveredVectorPoint.target !== VECTOR_TOKENS.POINT.TARGET.ANCHOR &&
        !hasHandleTarget(
          nextTopology,
          hoveredVectorPoint.pointId,
          hoveredVectorPoint.target
        )))
  ) {
    systemContextApis.setHoveredVectorPoint(null)
  }

  const selectedVectorPoint = systemContextApis.getSelectedVectorPoint()
  if (
    selectedVectorPoint &&
    selectedVectorPoint.elementId === elementId &&
    (removedAnchorIds.has(selectedVectorPoint.pointId) ||
      (selectedVectorPoint.target !== VECTOR_TOKENS.POINT.TARGET.ANCHOR &&
        !hasHandleTarget(
          nextTopology,
          selectedVectorPoint.pointId,
          selectedVectorPoint.target
        )))
  ) {
    systemContextApis.setSelectedVectorPoint(null)
  }

  const selectedSegments = selectionApis
    .getSelectedVectorSegments()
    .filter((selection) => selection.elementId === elementId)
  const hasInvalidSegmentSelection = selectedSegments.some((selection) =>
    removedSegmentIds.has(selection.segmentId)
  )

  if (hasInvalidSegmentSelection) {
    selectionApis.clearVectorSegmentSelection({ undoable: false })
    systemContextApis.setSelectedVectorSegment(null)
  }

  const hoveredVectorSegment = systemContextApis.getHoveredVectorSegment()
  if (
    hoveredVectorSegment &&
    hoveredVectorSegment.elementId === elementId &&
    removedSegmentIds.has(hoveredVectorSegment.segmentId)
  ) {
    systemContextApis.setHoveredVectorSegment(null)
  }

  const hoveredInsertPoint =
    systemContextApis.getHoveredVectorSegmentInsertPoint()
  if (
    hoveredInsertPoint &&
    hoveredInsertPoint.elementId === elementId &&
    removedSegmentIds.has(hoveredInsertPoint.segmentId)
  ) {
    systemContextApis.setHoveredVectorSegmentInsertPoint(null)
  }
}

const getVectorGeometryMutationValues = (
  previousComputed: Partial<VectorComputedData> | null,
  previousTopology: VectorTopology,
  nextTopology: VectorTopology
): Required<Pick<VectorComputedData, 'x' | 'y' | 'width' | 'height'>> => {
  const nextBounds = calculateVectorBounds(nextTopology)
  if (
    !previousComputed ||
    typeof previousComputed.x !== 'number' ||
    !Number.isFinite(previousComputed.x) ||
    typeof previousComputed.y !== 'number' ||
    !Number.isFinite(previousComputed.y) ||
    typeof previousComputed.width !== 'number' ||
    !Number.isFinite(previousComputed.width) ||
    previousComputed.width < 0 ||
    typeof previousComputed.height !== 'number' ||
    !Number.isFinite(previousComputed.height) ||
    previousComputed.height < 0
  ) {
    return nextBounds
  }

  const previousBounds = calculateVectorBounds(previousTopology)
  const finiteOr = (value: unknown, fallback: number) =>
    typeof value === 'number' && Number.isFinite(value) ? value : fallback
  const dimensionScaleX =
    previousBounds.width > 0 ? previousComputed.width / previousBounds.width : 1
  const dimensionScaleY =
    previousBounds.height > 0
      ? previousComputed.height / previousBounds.height
      : 1
  const scaleX = dimensionScaleX * finiteOr(previousComputed.scaleX, 1)
  const scaleY = dimensionScaleY * finiteOr(previousComputed.scaleY, 1)
  const rotation = finiteOr(previousComputed.rotation, 0)
  const skewX = finiteOr(previousComputed.skewX, 0)
  const skewY = finiteOr(previousComputed.skewY, 0)
  const deltaX = nextBounds.x - previousBounds.x
  const deltaY = nextBounds.y - previousBounds.y
  const rotationPlusSkewY = rotation + skewY
  const rotationMinusSkewX = rotation - skewX

  return {
    x:
      previousComputed.x +
      Math.cos(rotationPlusSkewY) * scaleX * deltaX -
      Math.sin(rotationMinusSkewX) * scaleY * deltaY,
    y:
      previousComputed.y +
      Math.sin(rotationPlusSkewY) * scaleX * deltaX +
      Math.cos(rotationMinusSkewX) * scaleY * deltaY,
    width:
      previousBounds.width > 0
        ? previousComputed.width * (nextBounds.width / previousBounds.width)
        : nextBounds.width,
    height:
      previousBounds.height > 0
        ? previousComputed.height * (nextBounds.height / previousBounds.height)
        : nextBounds.height
  }
}

const createVectorPointMutationPatch = (
  elementId: string,
  previousTopology: VectorTopology,
  nextTopology: VectorTopology,
  closed?: boolean
): ComputedDataPatch => {
  const geometry = getVectorGeometryMutationValues(
    getVectorComputedForPointMutation(elementId),
    previousTopology,
    nextTopology
  )
  const pointsSet: Record<string, DataTypes> = {}

  Object.entries(nextTopology.points).forEach(([pointId, point]) => {
    if (!isEqual(previousTopology.points[pointId], point)) {
      pointsSet[pointId] = point as unknown as DataTypes
    }
  })

  const values: Record<string, DataTypes> = {
    ...geometry,
    closed: closed ?? isClosedVectorTopology(nextTopology)
  }
  return {
    values,
    records:
      Object.keys(pointsSet).length > 0
        ? {
            points: {
              set: pointsSet
            }
          }
        : undefined
  }
}

export const createVectorComputedPatchFromTopologyChange = ({
  previousComputed,
  previousTopology,
  nextTopology,
  closed
}: {
  previousComputed: Partial<VectorComputedData> | null
  previousTopology: VectorTopology
  nextTopology: VectorTopology
  closed?: boolean
}): ComputedDataPatch => {
  const patch: ComputedDataPatch = {}
  const mustSetAllRecords = !previousComputed
  const geometry = getVectorGeometryMutationValues(
    previousComputed,
    previousTopology,
    nextTopology
  )

  setPatchValueIfChanged(patch, previousComputed, 'x', geometry.x)
  setPatchValueIfChanged(patch, previousComputed, 'y', geometry.y)
  setPatchValueIfChanged(patch, previousComputed, 'width', geometry.width)
  setPatchValueIfChanged(patch, previousComputed, 'height', geometry.height)
  setPatchValueIfChanged(
    patch,
    previousComputed,
    'closed',
    closed ?? isClosedVectorTopology(nextTopology)
  )
  const pointsPatch = createRecordComputedPatch(
    previousTopology.points,
    nextTopology.points,
    {
      setAll: mustSetAllRecords
    }
  )
  const segmentsPatch = createRecordComputedPatch(
    previousTopology.segments,
    nextTopology.segments,
    {
      setAll: mustSetAllRecords
    }
  )
  const networksPatch = createRecordComputedPatch(
    previousTopology.networks,
    nextTopology.networks,
    {
      setAll: mustSetAllRecords
    }
  )

  if (pointsPatch || segmentsPatch || networksPatch) {
    patch.records = {}
    if (pointsPatch) {
      patch.records.points = pointsPatch
    }
    if (segmentsPatch) {
      patch.records.segments = segmentsPatch
    }
    if (networksPatch) {
      patch.records.networks = networksPatch
    }
  }

  return patch
}

const createVectorTopologyMutationPatch = (
  elementId: string,
  previousTopology: VectorTopology,
  nextTopology: VectorTopology,
  closed?: boolean
): ComputedDataPatch =>
  createVectorComputedPatchFromTopologyChange({
    previousComputed: getVectorComputed(elementId),
    previousTopology,
    nextTopology,
    closed
  })

const getRecordSetIds = (patch: ComputedDataPatch, recordKey: string) =>
  Object.keys(patch.records?.[recordKey]?.set ?? {})

const getAddedRecordIds = <T extends Record<string, unknown>>(
  previous: T,
  next: T
) => Object.keys(next).filter((recordId) => !(recordId in previous))

const getControlPointIds = (pointId: string) => [
  getControlId(pointId, VECTOR_TOKENS.CONTROL.ROLE.IN),
  getControlId(pointId, VECTOR_TOKENS.CONTROL.ROLE.OUT)
]

const getAnchorAndControlPointIds = (pointId: string) => [
  pointId,
  ...getControlPointIds(pointId)
]

const getOperationAllowedPointSetIds = (
  operation: VectorTopologyOperation,
  previousTopology: VectorTopology,
  nextTopology: VectorTopology
) => {
  if (operation.type === 'appendAnchor' || operation.type === 'splitSegment') {
    return new Set(
      getAddedRecordIds(previousTopology.points, nextTopology.points)
    )
  }

  if (operation.type === 'setAnchorType') {
    return new Set(getAnchorAndControlPointIds(operation.pointId))
  }

  if (operation.type === 'setHandleMode') {
    return new Set(getAnchorAndControlPointIds(operation.pointId))
  }

  if (operation.type === 'setHandles') {
    return new Set(
      operation.updates.flatMap((update) =>
        getAnchorAndControlPointIds(update.pointId)
      )
    )
  }

  return new Set<string>()
}

const assertVectorTopologyOperationPatchScope = (
  operation: VectorTopologyOperation,
  patch: ComputedDataPatch,
  previousTopology: VectorTopology,
  nextTopology: VectorTopology
) => {
  const pointSetIds = getRecordSetIds(patch, 'points')
  if (pointSetIds.length === 0) {
    return
  }

  const allowedPointSetIds = getOperationAllowedPointSetIds(
    operation,
    previousTopology,
    nextTopology
  )
  const unexpectedPointSetIds = pointSetIds.filter(
    (pointId) => !allowedPointSetIds.has(pointId)
  )
  if (unexpectedPointSetIds.length === 0) {
    return
  }

  throw new Error(
    `Vector topology operation ${operation.type} tried to patch unrelated point records: ${unexpectedPointSetIds.join(
      ', '
    )}`
  )
}

const createVectorTopologyOperationPatch = (
  elementId: string,
  operation: VectorTopologyOperation,
  previousTopology: VectorTopology,
  nextTopology: VectorTopology,
  closed?: boolean
): ComputedDataPatch => {
  const patch = createVectorTopologyMutationPatch(
    elementId,
    previousTopology,
    nextTopology,
    closed
  )

  assertVectorTopologyOperationPatchScope(
    operation,
    patch,
    previousTopology,
    nextTopology
  )

  return patch
}

const assertVectorTopologyOperationCanPatch = (elementId: string) => {
  const computed = getVectorComputed(elementId)
  if (!computed) {
    throw new Error(
      `Vector topology operation requires existing computed vector data for "${elementId}".`
    )
  }
}

const commitVectorTopologyOperation = (
  elementId: string,
  operation: VectorTopologyOperation,
  previousTopology: VectorTopology,
  nextTopology: VectorTopology,
  options?: VectorTopologyOperationOptions
) => {
  measureBrowserDragPhase(`vector-api:operation:${operation.type}`, () => {
    const transientVectorPointDrag = isTransientVectorPointDragUpdate(options)
    assertVectorTopologyOperationCanPatch(elementId)

    emitDiagnosticCounter('vector-api-operation-commit-count')
    let patch: ComputedDataPatch
    try {
      patch = measureBrowserDragPhase(
        'vector-api:operation:build-patch',
        () => {
          vectorGeometry.validate(
            nextTopology,
            `commitVectorTopologyOperation:${operation.type}`
          )
          return createVectorTopologyOperationPatch(
            elementId,
            operation,
            previousTopology,
            nextTopology,
            options?.closed
          )
        }
      )
    } catch (error) {
      emitDiagnosticCounter('vector-api-operation-build-patch-error-count')
      throw error
    }

    const patchKeyCount = getComputedDataPatchOperationCount(patch)
    emitDiagnosticCounter('vector-api-operation-patch-key-count', patchKeyCount)
    if (!hasComputedDataPatchOperations(patch)) {
      emitDiagnosticCounter('vector-api-operation-empty-patch-count')
      if (!transientVectorPointDrag) {
        clearTransientVectorCaches(elementId)
      }
      return
    }

    if (!transientVectorPointDrag) {
      clearTransientVectorCaches(elementId)
    }
    const validatedPatchRequest = getValidatedVectorComputedPatchRequest({
      structuralOperationIntent: options?.structuralOperationIntent,
      elementId,
      operation: getStructuralOperationForTopologyOperation(operation),
      patch
    })
    const commitPatch = validatedPatchRequest?.patch ?? patch
    const eventOptions = validatedPatchRequest
      ? {
          ...toVectorEventOptions(options),
          ...validatedPatchRequest.eventOptions
        }
      : toVectorEventOptions(options)
    if (transientVectorPointDrag) {
      core.patchLocalComputedData([
        {
          elementId,
          patch: commitPatch
        }
      ])
    } else {
      runTransaction(() => {
        reconcileVectorSelectionAfterTopologyChange(
          elementId,
          previousTopology,
          nextTopology
        )
        commitCanonicalVectorPropertyPatch(elementId, commitPatch, eventOptions)
      })
    }
    if (transientVectorPointDrag) {
      transientWorkspaceTopologyCache.set(elementId, nextTopology)
      updateTransientComputedSnapshotFromPatch(elementId, commitPatch)
    }
  })
}

const commitVectorPointMutation = (
  elementId: string,
  previousTopology: VectorTopology,
  nextTopology: VectorTopology,
  options?: VectorPointMutationOptions & {
    closed?: boolean
  }
) => {
  measureBrowserDragPhase('vector-api:commit', () => {
    const transientVectorPointDrag = isTransientVectorPointDragUpdate(options)
    emitDiagnosticCounter('vector-api-commit-enter-count')
    emitDiagnosticCounter(
      transientVectorPointDrag
        ? 'vector-api-commit-transient-count'
        : 'vector-api-commit-non-transient-count'
    )

    const patch = measureBrowserDragPhase('vector-api:commit:build-patch', () =>
      createVectorPointMutationPatch(
        elementId,
        previousTopology,
        nextTopology,
        options?.closed
      )
    )
    emitDiagnosticCounter('vector-api-commit-build-patch-observed')

    const pointPatchCount = Object.keys(patch.records?.points?.set ?? {}).length
    const patchKeyCount =
      Object.keys(patch.values ?? {}).length +
      Object.values(patch.records ?? {}).reduce(
        (count, recordPatch) =>
          count +
          Object.keys(recordPatch.set ?? {}).length +
          (recordPatch.remove?.length ?? 0),
        0
      )
    emitDiagnosticCounter('vector-api-commit-patch-key-count-observed')
    emitDiagnosticCounter('vector-api-commit-patch-key-count', patchKeyCount)
    emitDiagnosticCounter('vector-api-point-mutation-patch-count')
    emitDiagnosticCounter(
      'vector-api-point-mutation-point-patch-count',
      pointPatchCount
    )

    if (
      pointPatchCount === 0 &&
      Object.keys(patch.values ?? {}).every((key) => {
        const computed = getVectorComputed(elementId)
        return isEqual(
          computed?.[key as keyof VectorComputedData],
          patch.values?.[key]
        )
      })
    ) {
      emitDiagnosticCounter('vector-api-point-mutation-empty-patch-count')
      return
    }

    const validatedPatchRequest = getValidatedVectorComputedPatchRequest({
      structuralOperationIntent: options?.structuralOperationIntent,
      elementId,
      operation: options?.structuralOperationIntent?.operation ?? null,
      patch
    })
    const commitPatch = validatedPatchRequest?.patch ?? patch
    const eventOptions =
      validatedPatchRequest?.eventOptions ?? toVectorEventOptions(options)

    if (transientVectorPointDrag) {
      core.patchLocalComputedData([
        {
          elementId,
          patch: commitPatch
        }
      ])
    } else {
      runTransaction(() => {
        commitCanonicalVectorPropertyPatch(elementId, commitPatch, eventOptions)
      })
    }

    if (transientVectorPointDrag) {
      transientWorkspaceTopologyCache.set(elementId, nextTopology)
      updateTransientComputedSnapshotFromPatch(elementId, commitPatch)
    } else {
      clearTransientVectorCaches(elementId)
    }
  })
}

const getVectorSegmentProjection = (
  topology: VectorTopology,
  segmentId: string,
  workspacePos: PositionData
): VectorSegmentHit | null => {
  const segment = topology.segments[segmentId]
  if (!segment) {
    return null
  }

  const start = topology.points[segment.startId]
  const end = topology.points[segment.endId]
  if (
    !start ||
    !end ||
    start.kind !== VECTOR_TOKENS.POINT.KIND.ANCHOR ||
    end.kind !== VECTOR_TOKENS.POINT.KIND.ANCHOR
  ) {
    return null
  }

  const outControl =
    segment.outControlId &&
    topology.points[segment.outControlId]?.kind === 'control'
      ? topology.points[segment.outControlId]
      : null
  const inControl =
    segment.inControlId &&
    topology.points[segment.inControlId]?.kind === 'control'
      ? topology.points[segment.inControlId]
      : null

  const startPosition = { x: start.x, y: start.y }
  const endPosition = { x: end.x, y: end.y }

  if (outControl || inControl) {
    const firstControl = outControl
      ? { x: outControl.x, y: outControl.y }
      : startPosition
    const secondControl = inControl
      ? { x: inControl.x, y: inControl.y }
      : endPosition

    const projected = projectPointToCubicBezier(
      startPosition,
      firstControl,
      secondControl,
      endPosition,
      workspacePos
    )

    return {
      segmentId,
      position: projected.position,
      t: projected.t
    }
  }

  const projected = getProjectedPointOnLineSegment(
    startPosition,
    endPosition,
    workspacePos
  )

  return {
    segmentId,
    position: projected.position,
    t: projected.t
  }
}

const getNearestVectorSegmentHit = (
  topology: VectorTopology,
  workspacePos: PositionData,
  hitRadius: number
): VectorSegmentHit | null => {
  if (Object.keys(topology.segments).length === 0) {
    return null
  }

  const radiusSquared = hitRadius * hitRadius
  const orderedNetworks = getOrderedNetworks(topology)
  let nearestHit: VectorSegmentHit | null = null
  let nearestDistanceSquared = Number.POSITIVE_INFINITY

  for (const network of orderedNetworks) {
    for (const segmentId of network.segmentIds) {
      const hit = getVectorSegmentProjection(topology, segmentId, workspacePos)
      if (!hit) {
        continue
      }

      const distanceSquared = getDistanceSquared(hit.position, workspacePos)
      if (
        distanceSquared <= radiusSquared &&
        distanceSquared < nearestDistanceSquared
      ) {
        nearestDistanceSquared = distanceSquared
        nearestHit = hit
      }
    }
  }

  return nearestHit
}

const createVectorElementAtWorkspacePos = (
  workspacePos: PositionData,
  data: CreateElementData,
  options?: EVENT_OPTIONS
): string => {
  return runTransaction(() =>
    core.createElement(
      {
        ...data,
        type: 'vector',
        x: workspacePos.x,
        y: workspacePos.y
      },
      undefined,
      undefined,
      options
    )
  )
}

export const prepareVectorElementData = (
  createOptions: CreateElementOptions
): CreateElementData | null => {
  if (!isVectorTopology(createOptions)) {
    return null
  }

  const topology: VectorTopology = {
    points: createOptions.points,
    segments: createOptions.segments,
    networks: createOptions.networks
  }
  vectorGeometry.validate(topology, 'createVectorElement')
  const bounds = calculateVectorBounds(topology)
  const parentWorkspaceOrigin = createOptions.parentWorkspaceOrigin
  if (
    parentWorkspaceOrigin !== undefined &&
    (!Number.isFinite(parentWorkspaceOrigin.x) ||
      !Number.isFinite(parentWorkspaceOrigin.y))
  ) {
    return null
  }
  const parentOrigin = parentWorkspaceOrigin ?? { x: 0, y: 0 }
  const normalizedTopology = normalizeVectorTopology(topology, bounds)
  const closed =
    createOptions.closed ?? isClosedVectorTopology(normalizedTopology)

  return {
    type: 'vector',
    x: bounds.x - parentOrigin.x,
    y: bounds.y - parentOrigin.y,
    width: bounds.width,
    height: bounds.height,
    points: topology.points,
    segments: normalizedTopology.segments,
    networks: normalizedTopology.networks,
    closed,
    pointCoordinateSpace: 'workspace',
    fills: createOptions.fills ?? DEFAULT_VECTOR_STYLE.fills ?? [],
    strokes: createOptions.strokes ?? DEFAULT_VECTOR_STYLE.strokes ?? []
  }
}

export const vectorApis = {
  discardTransientVectorPreviews: (elementIds: readonly string[]): void => {
    const seenElementIds = new Set<string>()
    const seenPropertyIds = new Set<string>()
    const propertyIds: string[] = []

    elementIds.forEach((elementId) => {
      if (
        typeof elementId !== 'string' ||
        elementId.length === 0 ||
        seenElementIds.has(elementId)
      ) {
        throw new Error(
          '[Vector APIs] Transient preview cancellation requires unique vector ids'
        )
      }
      seenElementIds.add(elementId)
      const element = sceneTree.getElementById(elementId)
      if (!element || element.get('type') !== 'vector') {
        throw new Error(
          `[Vector APIs] Transient preview cancellation requires active vector "${elementId}"`
        )
      }
      const props = element.props as typeof element.props & {
        getCanonicalRootPropertyIds: () => readonly string[]
      }
      props.getCanonicalRootPropertyIds().forEach((propertyId) => {
        if (!seenPropertyIds.has(propertyId)) {
          seenPropertyIds.add(propertyId)
          propertyIds.push(propertyId)
        }
      })
    })

    elementIds.forEach(clearTransientVectorCaches)
    core.projectLocalComputedDataFromPropertyIds(propertyIds)
  },

  getVectorAnchorPoints: (elementId: string): VectorAnchorPoint[] => {
    const topology = getVectorTopologyWorkspace(elementId)
    if (Object.keys(topology.points).length === 0) {
      return []
    }

    return vectorTopologyToAnchorPoints(topology)
  },

  getVectorAnchorSubpaths: (elementId: string) => {
    const topology = getVectorTopologyWorkspace(elementId)
    if (Object.keys(topology.points).length === 0) {
      return []
    }

    return vectorTopologyToAnchorSubpaths(topology)
  },

  getVectorTopology: (elementId: string) => {
    return getVectorTopologyLocal(elementId)
  },

  scaleVectorElementAroundCenter: (
    elementId: string,
    scale: {
      readonly scaleX: number
      readonly scaleY: number
    },
    options?: EVENT_OPTIONS
  ): boolean => {
    const computed = getVectorComputed(elementId)
    if (
      !computed ||
      !Number.isFinite(scale.scaleX) ||
      !Number.isFinite(scale.scaleY) ||
      scale.scaleX <= 0 ||
      scale.scaleY <= 0 ||
      typeof computed.x !== 'number' ||
      !Number.isFinite(computed.x) ||
      typeof computed.y !== 'number' ||
      !Number.isFinite(computed.y) ||
      typeof computed.width !== 'number' ||
      !Number.isFinite(computed.width) ||
      computed.width <= 0 ||
      typeof computed.height !== 'number' ||
      !Number.isFinite(computed.height) ||
      computed.height <= 0
    ) {
      return false
    }

    const width = computed.width * scale.scaleX
    const height = computed.height * scale.scaleY
    const x = computed.x + (computed.width - width) / 2
    const y = computed.y + (computed.height - height) / 2
    const updatedElementIds = runTransaction(() =>
      core.updateElementProperties(
        [
          {
            elementId,
            values: { x, y, width, height }
          }
        ],
        options
      )
    )
    return updatedElementIds.includes(elementId)
  },

  getVectorAnchorPointAtWorkspacePos: (
    elementId: string,
    workspacePos: PositionData,
    hitRadius?: number
  ): { point: VectorAnchorPoint; index: number } | null => {
    const editablePoint = vectorApis.getVectorEditablePointAtWorkspacePos(
      elementId,
      workspacePos,
      hitRadius
    )
    if (
      !editablePoint ||
      editablePoint.target !== VECTOR_TOKENS.POINT.TARGET.ANCHOR
    ) {
      return null
    }

    return {
      point: editablePoint.point,
      index: editablePoint.index
    }
  },

  getVectorEditablePointAtWorkspacePos: (
    elementId: string,
    workspacePos: PositionData,
    hitRadius?: number
  ): VectorEditablePointHit | null => {
    const topology = getVectorTopologyWorkspace(elementId)
    const anchorPoints = vectorTopologyToAnchorPoints(topology, {
      includeSyntheticHandles: true
    })
    if (anchorPoints.length === 0) {
      return null
    }

    const radius = hitRadius ?? VECTOR_POINT_HIT_RADIUS
    const radiusSquared = radius * radius

    let closestHit: VectorEditablePointHit | null = null
    let closestDist = Number.POSITIVE_INFINITY

    const checkTarget = (
      point: VectorAnchorPoint,
      index: number,
      target: VectorPointTarget,
      position: PositionData | null
    ) => {
      if (!position) {
        return
      }

      const dx = position.x - workspacePos.x
      const dy = position.y - workspacePos.y
      const dist = dx * dx + dy * dy
      if (dist > radiusSquared || dist > closestDist) {
        return
      }

      closestDist = dist
      closestHit = {
        point,
        index,
        target,
        position
      }
    }

    anchorPoints.forEach((point, index) => {
      checkTarget(
        point,
        index,
        VECTOR_TOKENS.POINT.TARGET.IN_HANDLE,
        point.inHandle
      )
      checkTarget(
        point,
        index,
        VECTOR_TOKENS.POINT.TARGET.OUT_HANDLE,
        point.outHandle
      )
      checkTarget(point, index, VECTOR_TOKENS.POINT.TARGET.ANCHOR, {
        x: point.x,
        y: point.y
      })
    })

    return closestHit
  },

  getVectorAnchorPointAtClientPos: (
    elementId: string,
    clientPos: PositionData
  ): { point: VectorAnchorPoint; index: number } | null => {
    if (!render) {
      return null
    }

    const workspacePos = render.getMousePosInWorkspace({
      clientX: clientPos.x,
      clientY: clientPos.y
    })
    const viewportScale = render.getViewportScale() || 1
    const hitRadius = VECTOR_POINT_HIT_RADIUS / viewportScale

    return vectorApis.getVectorAnchorPointAtWorkspacePos(
      elementId,
      workspacePos,
      hitRadius
    )
  },

  getVectorEditablePointAtClientPos: (
    elementId: string,
    clientPos: PositionData
  ): VectorEditablePointHit | null => {
    if (!render) {
      return null
    }

    const workspacePos = render.getMousePosInWorkspace({
      clientX: clientPos.x,
      clientY: clientPos.y
    })
    const viewportScale = render.getViewportScale() || 1
    const hitRadius = VECTOR_POINT_HIT_RADIUS / viewportScale

    return vectorApis.getVectorEditablePointAtWorkspacePos(
      elementId,
      workspacePos,
      hitRadius
    )
  },

  getVectorSegmentAtWorkspacePos: (
    elementId: string,
    workspacePos: PositionData,
    hitRadius = VECTOR_SEGMENT_HIT_RADIUS
  ): string | null => {
    return (
      vectorApis.getVectorSegmentHitAtWorkspacePos(
        elementId,
        workspacePos,
        hitRadius
      )?.segmentId ?? null
    )
  },

  getVectorSegmentHitAtWorkspacePos: (
    elementId: string,
    workspacePos: PositionData,
    hitRadius = VECTOR_SEGMENT_HIT_RADIUS
  ): VectorSegmentHit | null => {
    const topology = getVectorTopologyWorkspace(elementId)
    return getNearestVectorSegmentHit(topology, workspacePos, hitRadius)
  },

  getVectorSegmentAtClientPos: (
    elementId: string,
    clientPos: PositionData,
    hitRadius = VECTOR_SEGMENT_HIT_RADIUS
  ): string | null => {
    if (!render) {
      return null
    }

    const workspacePos = render.getMousePosInWorkspace({
      clientX: clientPos.x,
      clientY: clientPos.y
    })
    const viewportScale = render.getViewportScale() || 1
    const scaledHitRadius = hitRadius / viewportScale

    return (
      vectorApis.getVectorSegmentHitAtWorkspacePos(
        elementId,
        workspacePos,
        scaledHitRadius
      )?.segmentId ?? null
    )
  },

  getVectorSegmentHitAtClientPos: (
    elementId: string,
    clientPos: PositionData,
    hitRadius = VECTOR_SEGMENT_HIT_RADIUS
  ): VectorSegmentHit | null => {
    if (!render) {
      return null
    }

    const workspacePos = render.getMousePosInWorkspace({
      clientX: clientPos.x,
      clientY: clientPos.y
    })
    const viewportScale = render.getViewportScale() || 1
    const scaledHitRadius = hitRadius / viewportScale

    return vectorApis.getVectorSegmentHitAtWorkspacePos(
      elementId,
      workspacePos,
      scaledHitRadius
    )
  },

  isPointNearVectorPathAtWorkspacePos: (
    elementId: string,
    workspacePos: PositionData,
    hitRadius = VECTOR_SEGMENT_HIT_RADIUS
  ): boolean => {
    return (
      vectorApis.getVectorSegmentAtWorkspacePos(
        elementId,
        workspacePos,
        hitRadius
      ) !== null
    )
  },

  isPointNearVectorPathAtClientPos: (
    elementId: string,
    clientPos: PositionData,
    hitRadius = VECTOR_SEGMENT_HIT_RADIUS
  ): boolean => {
    if (!render) {
      return false
    }

    const workspacePos = render.getMousePosInWorkspace({
      clientX: clientPos.x,
      clientY: clientPos.y
    })
    const viewportScale = render.getViewportScale() || 1
    const scaledHitRadius = hitRadius / viewportScale

    return vectorApis.isPointNearVectorPathAtWorkspacePos(
      elementId,
      workspacePos,
      scaledHitRadius
    )
  },

  getVectorAnchorPointById: (
    elementId: string,
    pointId: string
  ): { point: VectorAnchorPoint; index: number } | null => {
    const anchorPoints = vectorApis.getVectorAnchorPoints(elementId)
    const index = anchorPoints.findIndex((point) => point.id === pointId)
    if (index === -1) {
      return null
    }

    return {
      point: anchorPoints[index],
      index
    }
  },

  appendVectorAnchorPoint: (
    elementId: string,
    point: VectorAnchorPoint,
    options?: AppendVectorAnchorPointOptions
  ): { point: VectorAnchorPoint; index: number } | null => {
    const {
      startNewSubpath,
      continuation,
      structuralOperationIntent,
      ...eventOptions
    } = options ?? {}
    const topology = getVectorTopologyStored(elementId)
    const storedPosition = projectWorkspacePositionToStoredVector(
      elementId,
      point
    )
    if (!storedPosition) {
      return null
    }
    const nextTopology = vectorGeometry.addPoint(
      topology,
      point.id,
      storedPosition,
      {
        startNewSubpath,
        anchorType: point.type,
        continuation
      }
    )

    commitVectorTopologyOperation(
      elementId,
      {
        type: 'appendAnchor',
        pointId: point.id
      },
      topology,
      nextTopology,
      {
        ...eventOptions,
        structuralOperationIntent
      }
    )
    return vectorApis.getVectorAnchorPointById(elementId, point.id)
  },

  getVectorAnchorEndpoint: (
    elementId: string,
    pointId: string
  ): {
    networkId: string
    pointId: string
    side: VectorEndpointSide
  } | null => {
    const topology = getVectorTopologyStored(elementId)
    return getAnchorEndpointInTopology(topology, pointId)
  },

  getVectorAnchorContinuation: (
    elementId: string,
    pointId: string
  ): {
    networkId: string
    pointId: string
    side: VectorEndpointSide
  } | null => {
    const topology = getVectorTopologyStored(elementId)
    return getAnchorContinuationInTopology(topology, pointId)
  },

  connectVectorAnchorEndpoints: (
    elementId: string,
    sourcePointId: string,
    targetPointId: string,
    options?: VectorOperationIntentOptions
  ): { closed: boolean } | null => {
    const topology = getVectorTopologyStored(elementId)
    const connected = vectorGeometry.connectEndpoints(
      topology,
      sourcePointId,
      targetPointId
    )
    if (!connected) {
      return null
    }

    commitVectorTopologyOperation(
      elementId,
      {
        type: 'connectEndpoints',
        sourcePointId,
        targetPointId
      },
      topology,
      connected.topology,
      {
        closed: isClosedVectorTopology(connected.topology),
        structuralOperationIntent: options?.structuralOperationIntent
      }
    )
    return {
      closed: connected.closed
    }
  },

  connectVectorAnchorPoints: (
    elementId: string,
    sourcePointId: string,
    targetPointId: string,
    options?: VectorOperationIntentOptions
  ): { closed: boolean } | null => {
    const topology = getVectorTopologyStored(elementId)
    const connected = vectorGeometry.connectAnchors(
      topology,
      sourcePointId,
      targetPointId
    )
    if (!connected) {
      return null
    }

    commitVectorTopologyOperation(
      elementId,
      {
        type: 'connectAnchors',
        sourcePointId,
        targetPointId
      },
      topology,
      connected.topology,
      {
        closed: isClosedVectorTopology(connected.topology),
        structuralOperationIntent: options?.structuralOperationIntent
      }
    )
    return {
      closed: connected.closed
    }
  },

  removeLastSinglePointSubpath: (elementId: string): boolean => {
    const topology = getVectorTopologyStored(elementId)
    const nextTopology = removeLastSinglePointSubpath(topology)
    if (!nextTopology) {
      return false
    }

    commitVectorTopologyOperation(
      elementId,
      {
        type: 'removeLastSinglePointSubpath'
      },
      topology,
      nextTopology
    )
    return true
  },

  removeVectorAnchorPoint: (
    elementId: string,
    pointId: string,
    options?: VectorOperationIntentOptions
  ): boolean => {
    const topology = getVectorTopologyStored(elementId)
    const nextTopology = vectorGeometry.removePoint(topology, pointId)
    if (!nextTopology) {
      return false
    }

    commitVectorTopologyOperation(
      elementId,
      {
        type: 'removeAnchor',
        pointId
      },
      topology,
      nextTopology,
      {
        closed: isClosedVectorTopology(nextTopology),
        structuralOperationIntent: options?.structuralOperationIntent
      }
    )
    return true
  },

  splitVectorSegmentAtWorkspacePos: (
    elementId: string,
    segmentId: string,
    workspacePos: PositionData,
    options?: VectorOperationIntentOptions
  ): { point: VectorAnchorPoint; index: number } | null => {
    const topology = getVectorTopologyStored(elementId)
    const storedWorkspacePos = projectWorkspacePositionToStoredVector(
      elementId,
      workspacePos
    )
    if (!storedWorkspacePos) {
      return null
    }
    const projectedHit = getVectorSegmentProjection(
      topology,
      segmentId,
      storedWorkspacePos
    )
    if (!projectedHit) {
      return null
    }

    const splitResult = vectorGeometry.splitSegment(topology, segmentId, {
      t: projectedHit.t
    })
    if (!splitResult) {
      return null
    }

    const anchorPoints = vectorTopologyToAnchorPoints(splitResult.topology)
    const insertedPointIndex = anchorPoints.findIndex(
      (point) => point.id === splitResult.pointId
    )
    const insertedPoint =
      insertedPointIndex === -1
        ? null
        : projectStoredVectorAnchorPointToWorkspace(
            elementId,
            anchorPoints[insertedPointIndex]
          )
    if (!insertedPoint) {
      return null
    }

    commitVectorTopologyOperation(
      elementId,
      {
        type: 'splitSegment',
        segmentId,
        pointId: splitResult.pointId
      },
      topology,
      splitResult.topology,
      {
        structuralOperationIntent: options?.structuralOperationIntent
      }
    )
    return {
      point: insertedPoint,
      index: insertedPointIndex
    }
  },

  setVectorClosed: (elementId: string, closed: boolean) => {
    const topology = getVectorTopologyStored(elementId)
    const nextTopology = setTopologyClosed(topology, closed)
    commitVectorTopologyOperation(
      elementId,
      {
        type: 'setClosed',
        closed
      },
      topology,
      nextTopology,
      { closed }
    )
  },

  updateVectorAnchorPointPosition: (
    elementId: string,
    pointId: string,
    position: PositionData,
    options?: VectorPointMutationOptions
  ): { point: VectorAnchorPoint; index: number } | true | null => {
    const topology = getVectorTopologyStored(elementId)
    const storedPosition = projectWorkspacePositionToStoredVector(
      elementId,
      position
    )
    if (!storedPosition) {
      return null
    }
    const nextTopology = measureVectorTopologyUpdate('move-point', () =>
      vectorGeometry.movePoint(topology, pointId, storedPosition)
    )
    if (!nextTopology) {
      return null
    }
    commitVectorPointMutation(elementId, topology, nextTopology, options)
    if (options?.skipResult) {
      return true
    }
    return vectorApis.getVectorAnchorPointById(elementId, pointId)
  },

  setVectorElementPositions: (
    updates: readonly {
      elementId: string
      position: PositionData
    }[],
    options?: EVENT_OPTIONS
  ): readonly string[] => {
    const propertyUpdates: ElementPropertyValuesUpdate[] = []

    updates.forEach(({ elementId, position }) => {
      if (!Number.isFinite(position?.x) || !Number.isFinite(position?.y)) {
        return
      }

      const computed = getVectorComputed(elementId)
      if (
        !computed ||
        typeof computed.x !== 'number' ||
        typeof computed.y !== 'number'
      ) {
        return
      }

      if (position.x === computed.x && position.y === computed.y) {
        return
      }

      propertyUpdates.push({
        elementId,
        values: {
          x: position.x,
          y: position.y
        }
      })
    })

    if (propertyUpdates.length === 0) {
      return Object.freeze([])
    }

    return runTransaction(() =>
      core.updateElementProperties(propertyUpdates, options)
    )
  },

  setVectorElementPosition: (
    elementId: string,
    position: PositionData,
    options?: EVENT_OPTIONS
  ): boolean =>
    vectorApis
      .setVectorElementPositions([{ elementId, position }], options)
      .includes(elementId),

  updateVectorAnchorPointType: (
    elementId: string,
    pointId: string,
    type: 'smooth' | 'sharp',
    options?: VectorOperationIntentOptions
  ): { point: VectorAnchorPoint; index: number } | null => {
    const topology = getVectorTopologyStored(elementId)
    const nextTopology = setAnchorTypeInTopology(topology, pointId, type)
    commitVectorTopologyOperation(
      elementId,
      {
        type: 'setAnchorType',
        pointId
      },
      topology,
      nextTopology,
      {
        structuralOperationIntent: options?.structuralOperationIntent
      }
    )
    return vectorApis.getVectorAnchorPointById(elementId, pointId)
  },

  getVectorAnchorPointHandleMode: (
    elementId: string,
    pointId: string
  ): VectorHandleMode => {
    const topology = getVectorTopologyStored(elementId)
    return getVectorAnchorHandleMode(topology.points[pointId])
  },

  setVectorAnchorPointHandleMode: (
    elementId: string,
    pointId: string,
    mode: VectorHandleMode,
    options?: VectorOperationIntentOptions
  ): { point: VectorAnchorPoint; index: number } | null => {
    const topology = getVectorTopologyStored(elementId)
    const nextTopology = vectorGeometry.setHandleMode(topology, pointId, mode)
    if (!nextTopology) {
      return null
    }

    commitVectorTopologyOperation(
      elementId,
      {
        type: 'setHandleMode',
        pointId,
        mode
      },
      topology,
      nextTopology,
      {
        structuralOperationIntent: options?.structuralOperationIntent
      }
    )
    return vectorApis.getVectorAnchorPointById(elementId, pointId)
  },

  updateVectorAnchorPointHandlePosition: (
    elementId: string,
    pointId: string,
    target: Exclude<
      VectorPointTarget,
      typeof VECTOR_TOKENS.POINT.TARGET.ANCHOR
    >,
    position: PositionData,
    options?: VectorPointMutationOptions
  ): { point: VectorAnchorPoint; index: number } | true | null => {
    const topology = getVectorTopologyStored(elementId)
    const storedPosition = projectWorkspacePositionToStoredVector(
      elementId,
      position
    )
    if (!storedPosition) {
      return null
    }
    const handleMode = getVectorAnchorHandleMode(topology.points[pointId])
    const nextTopology = measureVectorTopologyUpdate('update-handle', () =>
      vectorGeometry.updateHandle(
        topology,
        pointId,
        target,
        storedPosition,
        handleMode
      )
    )
    if (!nextTopology) {
      return null
    }

    commitVectorPointMutation(elementId, topology, nextTopology, options)
    if (options?.skipResult) {
      return true
    }
    return vectorApis.getVectorAnchorPointById(elementId, pointId)
  },

  updateVectorAnchorPointHandles: (
    elementId: string,
    updates: VectorHandleUpdate[],
    options?: VectorPointMutationOptions
  ) => {
    if (updates.length === 0) {
      return
    }

    const previousTopology = getVectorTopologyStored(elementId)
    let topology = previousTopology
    let projectionFailed = false
    updates.forEach((update) => {
      if (projectionFailed) {
        return
      }
      if (update.forceSmooth) {
        topology = setAnchorTypeInTopology(topology, update.pointId, 'smooth')
      }

      const storedPosition = update.position
        ? projectWorkspacePositionToStoredVector(elementId, update.position)
        : null
      if (update.position && !storedPosition) {
        projectionFailed = true
        return
      }
      topology = setAnchorHandleInTopology(
        topology,
        update.pointId,
        update.target === VECTOR_TOKENS.POINT.TARGET.IN_HANDLE
          ? VECTOR_TOKENS.CONTROL.ROLE.IN
          : VECTOR_TOKENS.CONTROL.ROLE.OUT,
        storedPosition
      )
    })
    if (projectionFailed) {
      return
    }

    commitVectorTopologyOperation(
      elementId,
      {
        type: 'setHandles',
        updates
      },
      previousTopology,
      topology,
      options
    )
  },

  createVectorElement: (
    createOptions: CreateElementOptions,
    options?: EVENT_OPTIONS
  ): string | null => {
    const data = prepareVectorElementData(createOptions)
    if (!data) {
      return null
    }
    if (
      createOptions.parentId &&
      createOptions.parentWorkspaceOrigin !== undefined
    ) {
      return (
        core.createElementsInParent(
          [data],
          createOptions.parentId,
          undefined,
          options
        )[0] ?? null
      )
    }

    return createVectorElementAtWorkspacePos(
      { x: data.x as number, y: data.y as number },
      data,
      options
    )
  },

  createVectorElementsInParent: (
    createOptions: readonly CreateElementOptions[],
    parentId: string,
    options?: EVENT_OPTIONS
  ): readonly string[] | null => {
    const data: CreateElementData[] = []
    for (const elementOptions of createOptions) {
      const prepared = prepareVectorElementData(elementOptions)
      if (!prepared) {
        return null
      }
      data.push(prepared)
    }
    return core.createElementsInParent(data, parentId, undefined, options)
  },

  createVectorElementFromSinglePoint: (
    pointId: string,
    position: PositionData,
    options?: EVENT_OPTIONS
  ): string | null => {
    const topology = createVectorTopologyFromSinglePoint(
      pointId,
      position,
      'sharp'
    )
    return vectorApis.createVectorElement(
      {
        type: 'vector',
        points: topology.points,
        segments: topology.segments,
        networks: topology.networks,
        closed: false
      },
      options
    )
  }
}

export { vectorGeometry }
export type { VectorPointUpdate }
