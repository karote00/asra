import type {
  VectorAnchorPoint,
  VectorEndpointSide,
  VectorPathStyle,
  VectorTopology,
  VectorPointNode
} from '@asyra/core'
import { VECTOR_TOKENS } from '@asyra/core'
import type {
  ComputedDataPatch,
  DataTypes,
  PositionData,
  EVENT_OPTIONS
} from '@asyra/utils'
import { StrokeJoinTypes, createDefaultStrokes } from '@asyra/utils'
import { startTransaction, endTransaction } from '@asyra/reactive-events'
import { isEqual } from 'lodash'
import core, { render, sceneTree } from '../../contexts'
import {
  DEFAULT_VECTOR_STROKE_COLOR,
  type VectorHandleMode
} from '../../constants'
import {
  createEmptyVectorTopology,
  createVectorTopologyFromSinglePoint,
  getAnchorEndpointInTopology,
  getControlId,
  getOrderedNetworks,
  isClosedVectorTopology,
  isVectorTopology,
  removeLastSinglePointSubpath,
  setAnchorHandleInTopology,
  setAnchorTypeInTopology,
  setTopologyClosed,
  toWorkspaceTopology,
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
import { getVectorHandleMode, setVectorHandleMode } from './handle-mode'
import { projectPointToCubicBezier } from './bezier-adapter'
import type {
  CreateElementOptions,
  VectorEditablePointHit,
  VectorPointTarget,
  VectorSegmentHit
} from './types'
import { selectionApis } from '../selection'
import { systemContextApis } from '../system-context'

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

type VectorPointMutationOptions = EVENT_OPTIONS & {
  skipResult?: boolean
}

interface VectorHandleUpdate {
  pointId: string
  target: Exclude<VectorPointTarget, typeof VECTOR_TOKENS.POINT.TARGET.ANCHOR>
  position: PositionData | null
  forceSmooth?: boolean
}

type VectorTopologyOperation =
  | {
      type: 'appendAnchor'
      pointId: string
    }
  | {
      type: 'removeAnchor'
      pointId: string
    }
  | {
      type: 'splitSegment'
      segmentId: string
      pointId: string
    }
  | {
      type: 'connectEndpoints'
      sourcePointId: string
      targetPointId: string
    }
  | {
      type: 'setClosed'
      closed: boolean
    }
  | {
      type: 'setAnchorType'
      pointId: string
    }
  | {
      type: 'setHandleMode'
      pointId: string
      mode: VectorHandleMode
    }
  | {
      type: 'setHandles'
      updates: VectorHandleUpdate[]
    }
  | {
      type: 'removeLastSinglePointSubpath'
    }

const toVectorEventOptions = (
  options?: VectorPointMutationOptions & { closed?: boolean }
): EVENT_OPTIONS | undefined => {
  if (!options) {
    return undefined
  }

  const { skipResult: _skipResult, closed: _closed, ...eventOptions } = options
  return eventOptions
}

const transientWorkspaceTopologyCache = new Map<string, VectorTopology>()
const transientComputedSnapshotCache = new Map<string, VectorComputedData>()

const measureBrowserDragPhase = <T>(phaseName: string, run: () => T): T => {
  const sink = (
    globalThis as typeof globalThis & {
      __asyraBrowserDragPhaseSink?: (
        phaseName: string,
        durationMs: number
      ) => void
    }
  ).__asyraBrowserDragPhaseSink
  if (!sink) {
    return run()
  }

  const start = performance.now()
  try {
    return run()
  } finally {
    sink(phaseName, performance.now() - start)
  }
}

const emitStrokePipelineCounter = (counterName: string, value = 1) => {
  ;(
    globalThis as typeof globalThis & {
      __asyraStrokePipelineCounterSink?: (
        counterName: string,
        value: number
      ) => void
    }
  ).__asyraStrokePipelineCounterSink?.(counterName, value)
}

const recordVectorCommitError = (error: unknown) => {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : ''
  if (!message) {
    return
  }
  const profile = (
    globalThis as typeof globalThis & {
      __asyraStrokeDragFrameProfile?: {
        errors?: { phaseName: string; message: string }[]
      }
    }
  ).__asyraStrokeDragFrameProfile
  if (!profile) {
    return
  }
  profile.errors = profile.errors ?? []
  profile.errors.push({
    phaseName: 'vector-api:commit:build-patch',
    message
  })
}

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

const getComputedDataPatchOperationCount = (patch: ComputedDataPatch) =>
  Object.keys(patch.values ?? {}).length +
  Object.values(patch.records ?? {}).reduce(
    (count, recordPatch) =>
      count +
      Object.keys(recordPatch.set ?? {}).length +
      (recordPatch.remove?.length ?? 0),
    0
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

const isTransientVectorPointDragUpdate = (options?: EVENT_OPTIONS) => {
  if (options?.undoable !== false) {
    return false
  }

  const pathEditingMode =
    core.getSystemProperty<boolean>('pathEditingMode') ?? false
  if (!pathEditingMode) {
    return false
  }

  const mouseDragging =
    core.getSystemProperty<boolean>('mouseDragging') ?? false
  const mouseDown = core.getSystemProperty<boolean>('mouseDown') ?? false
  return mouseDragging || mouseDown
}

const canReadTransientWorkspaceTopologyCache = () => {
  const pathEditingMode =
    core.getSystemProperty<boolean>('pathEditingMode') ?? false
  if (!pathEditingMode) {
    return false
  }

  return core.getSystemProperty<boolean>('mouseDragging') ?? false
}

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
        ? { ...(currentRecord as unknown as Record<string, DataTypes>) }
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

const getVectorOffset = (computed: { x?: number; y?: number }) => ({
  x: typeof computed.x === 'number' ? computed.x : 0,
  y: typeof computed.y === 'number' ? computed.y : 0
})

const usesWorkspacePointCoordinates = (
  computed: Pick<VectorComputedData, 'pointCoordinateSpace'>
) => computed.pointCoordinateSpace === 'workspace'

const getVectorTopologyLocal = (elementId: string): VectorTopology => {
  const computed = getVectorComputed(elementId)
  if (!computed) {
    return createEmptyVectorTopology()
  }

  if (usesWorkspacePointCoordinates(computed)) {
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

  return {
    points: computed.points,
    segments: computed.segments,
    networks: computed.networks
  }
}

const getVectorTopologyWorkspace = (elementId: string): VectorTopology => {
  return measureBrowserDragPhase('vector-api:topology-read', () => {
    if (canReadTransientWorkspaceTopologyCache()) {
      const cachedTopology = transientWorkspaceTopologyCache.get(elementId)
      if (cachedTopology) {
        emitStrokePipelineCounter('vector-api-transient-topology-cache-hit')
        return cachedTopology
      }
      emitStrokePipelineCounter('vector-api-transient-topology-cache-miss')
    }

    const computed = getVectorComputed(elementId)
    if (!computed) {
      return createEmptyVectorTopology()
    }

    if (canReadTransientWorkspaceTopologyCache()) {
      transientComputedSnapshotCache.set(elementId, computed)
    }

    if (usesWorkspacePointCoordinates(computed)) {
      return {
        points: computed.points,
        segments: computed.segments,
        networks: computed.networks
      }
    }

    return toWorkspaceTopology(
      {
        points: computed.points,
        segments: computed.segments,
        networks: computed.networks
      },
      getVectorOffset(computed)
    )
  })
}

const measureVectorTopologyUpdate = <T>(operationName: string, run: () => T) =>
  measureBrowserDragPhase(`vector-api:topology-update:${operationName}`, run)

const isAnchorNode = (
  point: VectorPointNode | undefined
): point is VectorPointNode & {
  kind: typeof VECTOR_TOKENS.POINT.KIND.ANCHOR
} => !!point && point.kind === VECTOR_TOKENS.POINT.KIND.ANCHOR

const isControlNode = (
  point: VectorPointNode | undefined
): point is VectorPointNode & {
  kind: typeof VECTOR_TOKENS.POINT.KIND.CONTROL
} => !!point && point.kind === VECTOR_TOKENS.POINT.KIND.CONTROL

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

const commitVectorTopology = (
  elementId: string,
  topologyInWorkspace: VectorTopology,
  options?: EVENT_OPTIONS & {
    closed?: boolean
  }
) => {
  measureBrowserDragPhase('vector-api:commit', () => {
    const transientVectorPointDrag = isTransientVectorPointDragUpdate(options)
    emitStrokePipelineCounter('vector-api-commit-enter-count')
    emitStrokePipelineCounter(
      transientVectorPointDrag
        ? 'vector-api-commit-transient-count'
        : 'vector-api-commit-non-transient-count'
    )
    const previousTopology = getVectorTopologyWorkspace(elementId)
    let patch: ComputedDataPatch
    try {
      patch = measureBrowserDragPhase('vector-api:commit:build-patch', () => {
        vectorGeometry.validate(topologyInWorkspace, 'commitVectorTopology')
        return createVectorTopologyMutationPatch(
          elementId,
          previousTopology,
          topologyInWorkspace,
          options?.closed
        )
      })
      emitStrokePipelineCounter('vector-api-commit-build-patch-observed')
    } catch (error) {
      emitStrokePipelineCounter('vector-api-commit-build-patch-error-count')
      recordVectorCommitError(error)
      throw error
    }

    const patchKeyCount = getComputedDataPatchOperationCount(patch)
    emitStrokePipelineCounter('vector-api-commit-patch-key-count-observed')
    emitStrokePipelineCounter(
      'vector-api-commit-patch-key-count',
      patchKeyCount
    )
    if (!transientVectorPointDrag) {
      clearTransientVectorCaches(elementId)
    }
    if (!hasComputedDataPatchOperations(patch)) {
      emitStrokePipelineCounter('vector-api-commit-empty-patch-count')
      return
    }

    startTransaction()
    if (!transientVectorPointDrag) {
      reconcileVectorSelectionAfterTopologyChange(
        elementId,
        previousTopology,
        topologyInWorkspace
      )
    }
    core.changeComputedDataPatch(
      [elementId],
      patch,
      toVectorEventOptions(options)
    )
    endTransaction()
    if (transientVectorPointDrag) {
      transientWorkspaceTopologyCache.set(elementId, topologyInWorkspace)
      updateTransientComputedSnapshotFromPatch(elementId, patch)
    }
  })
}

const createVectorPointMutationPatch = (
  elementId: string,
  previousTopology: VectorTopology,
  nextTopology: VectorTopology,
  closed?: boolean
): ComputedDataPatch => {
  const computed = getVectorComputed(elementId)
  const mustMigrateAllPoints =
    !computed || !usesWorkspacePointCoordinates(computed)
  const bounds = calculateVectorBounds(nextTopology)
  const pointsSet: Record<string, DataTypes> = {}

  Object.entries(nextTopology.points).forEach(([pointId, point]) => {
    if (
      mustMigrateAllPoints ||
      !isEqual(previousTopology.points[pointId], point)
    ) {
      pointsSet[pointId] = point as unknown as DataTypes
    }
  })

  const values: Record<string, DataTypes> = {
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    closed: closed ?? isClosedVectorTopology(nextTopology)
  }
  if (mustMigrateAllPoints) {
    values.pointCoordinateSpace = 'workspace'
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

const createVectorTopologyMutationPatch = (
  elementId: string,
  previousTopology: VectorTopology,
  nextTopology: VectorTopology,
  closed?: boolean
): ComputedDataPatch => {
  const computed = getVectorComputed(elementId)
  const patch: ComputedDataPatch = {}
  const mustMigrateAllPoints =
    !computed || !usesWorkspacePointCoordinates(computed)
  const mustSetAllRecords = !computed
  const bounds = calculateVectorBounds(nextTopology)

  setPatchValueIfChanged(patch, computed, 'x', bounds.x)
  setPatchValueIfChanged(patch, computed, 'y', bounds.y)
  setPatchValueIfChanged(patch, computed, 'width', bounds.width)
  setPatchValueIfChanged(patch, computed, 'height', bounds.height)
  setPatchValueIfChanged(
    patch,
    computed,
    'closed',
    closed ?? isClosedVectorTopology(nextTopology)
  )
  if (mustMigrateAllPoints) {
    patch.values ??= {}
    patch.values.pointCoordinateSpace = 'workspace'
  }

  const pointsPatch = createRecordComputedPatch(
    previousTopology.points,
    nextTopology.points,
    {
      setAll: mustMigrateAllPoints
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

const shouldUseVectorTopologyFallback = (elementId: string) => {
  const computed = getVectorComputed(elementId)
  return !computed || !usesWorkspacePointCoordinates(computed)
}

const commitVectorTopologyOperation = (
  elementId: string,
  operation: VectorTopologyOperation,
  previousTopology: VectorTopology,
  nextTopology: VectorTopology,
  options?: EVENT_OPTIONS & {
    closed?: boolean
  }
) => {
  measureBrowserDragPhase(`vector-api:operation:${operation.type}`, () => {
    const transientVectorPointDrag = isTransientVectorPointDragUpdate(options)
    if (shouldUseVectorTopologyFallback(elementId)) {
      emitStrokePipelineCounter('vector-api-operation-fallback-count')
      commitVectorTopology(elementId, nextTopology, options)
      return
    }

    emitStrokePipelineCounter('vector-api-operation-commit-count')
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
      emitStrokePipelineCounter('vector-api-operation-build-patch-error-count')
      recordVectorCommitError(error)
      throw error
    }

    const patchKeyCount = getComputedDataPatchOperationCount(patch)
    emitStrokePipelineCounter(
      'vector-api-operation-patch-key-count',
      patchKeyCount
    )
    if (!hasComputedDataPatchOperations(patch)) {
      emitStrokePipelineCounter('vector-api-operation-empty-patch-count')
      if (!transientVectorPointDrag) {
        clearTransientVectorCaches(elementId)
      }
      return
    }

    if (!transientVectorPointDrag) {
      clearTransientVectorCaches(elementId)
    }
    startTransaction()
    if (!transientVectorPointDrag) {
      reconcileVectorSelectionAfterTopologyChange(
        elementId,
        previousTopology,
        nextTopology
      )
    }
    core.changeComputedDataPatch(
      [elementId],
      patch,
      toVectorEventOptions(options)
    )
    endTransaction()
    if (transientVectorPointDrag) {
      transientWorkspaceTopologyCache.set(elementId, nextTopology)
      updateTransientComputedSnapshotFromPatch(elementId, patch)
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
    emitStrokePipelineCounter('vector-api-commit-enter-count')
    emitStrokePipelineCounter(
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
    emitStrokePipelineCounter('vector-api-commit-build-patch-observed')

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
    emitStrokePipelineCounter('vector-api-commit-patch-key-count-observed')
    emitStrokePipelineCounter(
      'vector-api-commit-patch-key-count',
      patchKeyCount
    )
    emitStrokePipelineCounter('vector-api-point-mutation-patch-count')
    emitStrokePipelineCounter(
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
      emitStrokePipelineCounter('vector-api-point-mutation-empty-patch-count')
      return
    }

    startTransaction()
    core.changeComputedDataPatch(
      [elementId],
      patch,
      toVectorEventOptions(options)
    )
    endTransaction()

    if (transientVectorPointDrag) {
      transientWorkspaceTopologyCache.set(elementId, nextTopology)
      updateTransientComputedSnapshotFromPatch(elementId, patch)
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
  data: Record<string, DataTypes>,
  options?: EVENT_OPTIONS
): string => {
  startTransaction()
  const elementId = core.createElement(
    {
      type: 'vector',
      x: workspacePos.x,
      y: workspacePos.y,
      ...data
    },
    undefined,
    undefined,
    options
  )
  endTransaction()
  return elementId
}

export const vectorApis = {
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
    options?: {
      startNewSubpath?: boolean
      continuation?: {
        networkId: string
        pointId: string
        side: VectorEndpointSide
      } | null
    }
  ): { point: VectorAnchorPoint; index: number } | null => {
    const topology = getVectorTopologyWorkspace(elementId)
    const nextTopology = vectorGeometry.addPoint(
      topology,
      point.id,
      { x: point.x, y: point.y },
      {
        startNewSubpath: options?.startNewSubpath,
        anchorType: point.type,
        continuation: options?.continuation
      }
    )

    commitVectorTopologyOperation(
      elementId,
      {
        type: 'appendAnchor',
        pointId: point.id
      },
      topology,
      nextTopology
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
    const topology = getVectorTopologyWorkspace(elementId)
    return getAnchorEndpointInTopology(topology, pointId)
  },

  connectVectorAnchorEndpoints: (
    elementId: string,
    sourcePointId: string,
    targetPointId: string
  ): { closed: boolean } | null => {
    const topology = getVectorTopologyWorkspace(elementId)
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
        closed: isClosedVectorTopology(connected.topology)
      }
    )
    return {
      closed: connected.closed
    }
  },

  removeLastSinglePointSubpath: (elementId: string): boolean => {
    const topology = getVectorTopologyWorkspace(elementId)
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

  removeVectorAnchorPoint: (elementId: string, pointId: string): boolean => {
    const topology = getVectorTopologyWorkspace(elementId)
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
        closed: isClosedVectorTopology(nextTopology)
      }
    )
    return true
  },

  splitVectorSegmentAtWorkspacePos: (
    elementId: string,
    segmentId: string,
    workspacePos: PositionData
  ): { point: VectorAnchorPoint; index: number } | null => {
    const topology = getVectorTopologyWorkspace(elementId)
    const projectedHit = getVectorSegmentProjection(
      topology,
      segmentId,
      workspacePos
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

    commitVectorTopologyOperation(
      elementId,
      {
        type: 'splitSegment',
        segmentId,
        pointId: splitResult.pointId
      },
      topology,
      splitResult.topology
    )
    return vectorApis.getVectorAnchorPointById(elementId, splitResult.pointId)
  },

  setVectorClosed: (elementId: string, closed: boolean) => {
    const topology = getVectorTopologyWorkspace(elementId)
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
    const topology = getVectorTopologyWorkspace(elementId)
    const nextTopology = measureVectorTopologyUpdate('move-point', () =>
      vectorGeometry.movePoint(topology, pointId, position)
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

  updateVectorAnchorPointType: (
    elementId: string,
    pointId: string,
    type: 'smooth' | 'sharp'
  ): { point: VectorAnchorPoint; index: number } | null => {
    const topology = getVectorTopologyWorkspace(elementId)
    const nextTopology = setAnchorTypeInTopology(topology, pointId, type)
    commitVectorTopologyOperation(
      elementId,
      {
        type: 'setAnchorType',
        pointId
      },
      topology,
      nextTopology
    )
    return vectorApis.getVectorAnchorPointById(elementId, pointId)
  },

  getVectorAnchorPointHandleMode: (
    elementId: string,
    pointId: string
  ): VectorHandleMode => getVectorHandleMode(elementId, pointId),

  setVectorAnchorPointHandleMode: (
    elementId: string,
    pointId: string,
    mode: VectorHandleMode
  ): { point: VectorAnchorPoint; index: number } | null => {
    const topology = getVectorTopologyWorkspace(elementId)
    const nextTopology = vectorGeometry.setHandleMode(topology, pointId, mode)
    if (!nextTopology) {
      return null
    }

    setVectorHandleMode(elementId, pointId, mode)
    commitVectorTopologyOperation(
      elementId,
      {
        type: 'setHandleMode',
        pointId,
        mode
      },
      topology,
      nextTopology
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
    const topology = getVectorTopologyWorkspace(elementId)
    const handleMode = getVectorHandleMode(elementId, pointId)
    const nextTopology = measureVectorTopologyUpdate('update-handle', () =>
      vectorGeometry.updateHandle(
        topology,
        pointId,
        target,
        position,
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

    const previousTopology = getVectorTopologyWorkspace(elementId)
    let topology = previousTopology
    updates.forEach((update) => {
      if (update.forceSmooth) {
        topology = setAnchorTypeInTopology(topology, update.pointId, 'smooth')
      }

      topology = setAnchorHandleInTopology(
        topology,
        update.pointId,
        update.target === VECTOR_TOKENS.POINT.TARGET.IN_HANDLE
          ? VECTOR_TOKENS.CONTROL.ROLE.IN
          : VECTOR_TOKENS.CONTROL.ROLE.OUT,
        update.position
      )
    })

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
    const normalizedTopology = normalizeVectorTopology(topology, bounds)
    const closed =
      createOptions.closed ?? isClosedVectorTopology(normalizedTopology)

    return createVectorElementAtWorkspacePos(
      { x: bounds.x, y: bounds.y },
      {
        width: bounds.width,
        height: bounds.height,
        points: topology.points,
        segments: normalizedTopology.segments,
        networks: normalizedTopology.networks,
        closed,
        pointCoordinateSpace: 'workspace',
        fills: DEFAULT_VECTOR_STYLE.fills ?? [],
        strokes: DEFAULT_VECTOR_STYLE.strokes ?? []
      },
      options
    )
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
