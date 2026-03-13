import type {
  VectorAnchorType,
  VectorEndpointSide,
  VectorNetwork,
  VectorPointNode,
  VectorSegment,
  VectorTopology
} from '@asyra/core'
import { VECTOR_TOKENS } from '@asyra/core'
import type { DataTypes, PositionData } from '@asyra/utils'
import { VectorHandleModes, type VectorHandleMode } from '../../constants'
import type { VectorPointTarget } from './types'
import {
  appendAnchorPointToTopology,
  connectAnchorEndpointsInTopology,
  getAnchorEndpointInTopology,
  getControlId,
  isClosedVectorTopology,
  removeAnchorPointFromTopology,
  setAnchorHandleInTopology,
  setAnchorTypeInTopology,
  splitSegmentInTopology,
  updateAnchorPositionInTopology,
  type VectorTopologyData
} from './vector-topology'
import {
  calculateVectorBounds,
  normalizeVectorTopology
} from './vector-geometry'
import {
  resolveHandleModeDragUpdate,
  resolveHandleModeSwitchUpdate
} from './handle-mode'

type AnchorHandleSnapshot = {
  anchor: PositionData
  inHandle: PositionData | null
  outHandle: PositionData | null
}

const isAnchorNode = (
  node: VectorPointNode | undefined
): node is VectorPointNode & { kind: typeof VECTOR_TOKENS.POINT.KIND.ANCHOR } =>
  !!node && node.kind === VECTOR_TOKENS.POINT.KIND.ANCHOR

const isControlNode = (
  node: VectorPointNode | undefined
): node is VectorPointNode & {
  kind: typeof VECTOR_TOKENS.POINT.KIND.CONTROL
} => !!node && node.kind === VECTOR_TOKENS.POINT.KIND.CONTROL

const getAnchorHandleSnapshot = (
  topology: VectorTopology,
  pointId: string
): AnchorHandleSnapshot | null => {
  const anchor = topology.points[pointId]
  if (!isAnchorNode(anchor)) {
    return null
  }

  const inHandleNode =
    topology.points[getControlId(pointId, VECTOR_TOKENS.CONTROL.ROLE.IN)]
  const outHandleNode =
    topology.points[getControlId(pointId, VECTOR_TOKENS.CONTROL.ROLE.OUT)]

  return {
    anchor: { x: anchor.x, y: anchor.y },
    inHandle:
      inHandleNode && inHandleNode.kind === VECTOR_TOKENS.POINT.KIND.CONTROL
        ? { x: inHandleNode.x, y: inHandleNode.y }
        : null,
    outHandle:
      outHandleNode && outHandleNode.kind === VECTOR_TOKENS.POINT.KIND.CONTROL
        ? { x: outHandleNode.x, y: outHandleNode.y }
        : null
  }
}

const throwTopologyError = (message: string, label?: string): never => {
  const prefix = label ? `vector-topology:${label}` : 'vector-topology'
  throw new Error(`[${prefix}] ${message}`)
}

export const assertVectorTopologyConsistency = (
  topology: VectorTopology,
  label?: string
) => {
  const anchorIds = new Set<string>()

  Object.entries(topology.points).forEach(([pointId, point]) => {
    if (point.kind === VECTOR_TOKENS.POINT.KIND.ANCHOR) {
      anchorIds.add(pointId)
    }
  })

  if (anchorIds.size > 0 && Object.keys(topology.networks).length === 0) {
    throwTopologyError('Vector topology missing network entries.', label)
  }

  const referencedSegmentIds = new Set<string>()

  Object.entries(topology.segments).forEach(([segmentId, segment]) => {
    if (!anchorIds.has(segment.startId)) {
      throwTopologyError(
        `Segment ${segmentId} startId ${segment.startId} is not an anchor.`,
        label
      )
    }
    if (!anchorIds.has(segment.endId)) {
      throwTopologyError(
        `Segment ${segmentId} endId ${segment.endId} is not an anchor.`,
        label
      )
    }

    if (segment.outControlId) {
      const outControl = topology.points[segment.outControlId]
      if (
        !isControlNode(outControl) ||
        outControl.controlForId !== segment.startId ||
        outControl.controlRole !== VECTOR_TOKENS.CONTROL.ROLE.OUT
      ) {
        throwTopologyError(
          `Segment ${segmentId} outControlId ${segment.outControlId} is invalid.`,
          label
        )
      }
    }

    if (segment.inControlId) {
      const inControl = topology.points[segment.inControlId]
      if (
        !isControlNode(inControl) ||
        inControl.controlForId !== segment.endId ||
        inControl.controlRole !== VECTOR_TOKENS.CONTROL.ROLE.IN
      ) {
        throwTopologyError(
          `Segment ${segmentId} inControlId ${segment.inControlId} is invalid.`,
          label
        )
      }
    }
  })

  Object.entries(topology.networks).forEach(([networkId, network]) => {
    if (network.pointIds.length === 0) {
      if (network.segmentIds.length > 0) {
        throwTopologyError(
          `Network ${networkId} has segments without points.`,
          label
        )
      }
      return
    }

    network.pointIds.forEach((pointId) => {
      if (!anchorIds.has(pointId)) {
        throwTopologyError(
          `Network ${networkId} references missing anchor ${pointId}.`,
          label
        )
      }
    })

    const expectedPairs: { startId: string; endId: string }[] = []
    for (let i = 1; i < network.pointIds.length; i += 1) {
      expectedPairs.push({
        startId: network.pointIds[i - 1],
        endId: network.pointIds[i]
      })
    }
    if (network.closed && network.pointIds.length > 1) {
      expectedPairs.push({
        startId: network.pointIds[network.pointIds.length - 1],
        endId: network.pointIds[0]
      })
    }

    if (network.segmentIds.length !== expectedPairs.length) {
      throwTopologyError(
        `Network ${networkId} segment count does not match point order.`,
        label
      )
    }

    expectedPairs.forEach((pair, index) => {
      const segmentId = network.segmentIds[index]
      const segment = segmentId ? topology.segments[segmentId] : undefined
      if (!segment) {
        throwTopologyError(
          `Network ${networkId} missing segment for index ${index}.`,
          label
        )
      }
      if (segment.startId !== pair.startId || segment.endId !== pair.endId) {
        throwTopologyError(
          `Network ${networkId} segment ${segmentId} does not match point order.`,
          label
        )
      }
      referencedSegmentIds.add(segmentId)
    })
  })

  Object.keys(topology.segments).forEach((segmentId) => {
    if (!referencedSegmentIds.has(segmentId)) {
      throwTopologyError(
        `Segment ${segmentId} is not referenced by any network.`,
        label
      )
    }
  })
}

export const translateAnchorAndHandles = (
  topology: VectorTopology,
  pointId: string,
  position: PositionData
): VectorTopology | null => {
  if (!isAnchorNode(topology.points[pointId])) {
    return null
  }

  return updateAnchorPositionInTopology(topology, pointId, position)
}

export const updateHandleWithMode = (
  topology: VectorTopology,
  pointId: string,
  target: Exclude<VectorPointTarget, typeof VECTOR_TOKENS.POINT.TARGET.ANCHOR>,
  position: PositionData,
  mode: VectorHandleMode
): VectorTopology | null => {
  const snapshot = getAnchorHandleSnapshot(topology, pointId)
  if (!snapshot) {
    return null
  }

  const handleUpdates = resolveHandleModeDragUpdate({
    anchor: snapshot.anchor,
    inHandle: snapshot.inHandle,
    outHandle: snapshot.outHandle,
    target,
    position,
    mode
  })

  let nextTopology = setAnchorTypeInTopology(topology, pointId, 'smooth')
  if (handleUpdates.nextIn !== undefined) {
    nextTopology = setAnchorHandleInTopology(
      nextTopology,
      pointId,
      VECTOR_TOKENS.CONTROL.ROLE.IN,
      handleUpdates.nextIn
    )
  }
  if (handleUpdates.nextOut !== undefined) {
    nextTopology = setAnchorHandleInTopology(
      nextTopology,
      pointId,
      VECTOR_TOKENS.CONTROL.ROLE.OUT,
      handleUpdates.nextOut
    )
  }

  return nextTopology
}

export const setHandleModeAndRepair = (
  topology: VectorTopology,
  pointId: string,
  mode: VectorHandleMode
): VectorTopology | null => {
  const snapshot = getAnchorHandleSnapshot(topology, pointId)
  if (!snapshot) {
    return null
  }

  if (mode === VectorHandleModes.NONE) {
    let nextTopology = topology
    nextTopology = setAnchorHandleInTopology(
      nextTopology,
      pointId,
      VECTOR_TOKENS.CONTROL.ROLE.IN,
      null
    )
    nextTopology = setAnchorHandleInTopology(
      nextTopology,
      pointId,
      VECTOR_TOKENS.CONTROL.ROLE.OUT,
      null
    )
    return nextTopology
  }

  const nextHandles = resolveHandleModeSwitchUpdate({
    anchor: snapshot.anchor,
    inHandle: snapshot.inHandle,
    outHandle: snapshot.outHandle,
    mode
  })

  if (!nextHandles) {
    return topology
  }

  let nextTopology = setAnchorTypeInTopology(topology, pointId, 'smooth')
  nextTopology = setAnchorHandleInTopology(
    nextTopology,
    pointId,
    VECTOR_TOKENS.CONTROL.ROLE.IN,
    nextHandles.inHandle
  )
  nextTopology = setAnchorHandleInTopology(
    nextTopology,
    pointId,
    VECTOR_TOKENS.CONTROL.ROLE.OUT,
    nextHandles.outHandle
  )
  return nextTopology
}

export const insertPointAndRepairTopology = (
  topology: VectorTopology,
  pointId: string,
  position: PositionData,
  options?: {
    startNewSubpath?: boolean
    anchorType?: VectorAnchorType
    continuation?: {
      networkId: string
      pointId: string
      side: VectorEndpointSide
    } | null
  }
): VectorTopology =>
  appendAnchorPointToTopology(topology, pointId, position, options)

export const splitSegmentAndRepairTopology = (
  topology: VectorTopology,
  segmentId: string,
  split: { t: number }
): { topology: VectorTopology; pointId: string } | null =>
  splitSegmentInTopology(topology, segmentId, split)

export const removePointAndRepairTopology = (
  topology: VectorTopology,
  pointId: string
): VectorTopology | null => removeAnchorPointFromTopology(topology, pointId)

export const connectEndpointsAndRepair = (
  topology: VectorTopology,
  sourcePointId: string,
  targetPointId: string
): { topology: VectorTopology; closed: boolean } | null => {
  const sourceEndpoint = getAnchorEndpointInTopology(topology, sourcePointId)
  const targetEndpoint = getAnchorEndpointInTopology(topology, targetPointId)

  if (!sourceEndpoint || !targetEndpoint) {
    return null
  }

  return connectAnchorEndpointsInTopology(topology, sourceEndpoint, targetEndpoint)
}

export type VectorPointUpdate = {
  position?: PositionData
  type?: VectorAnchorType
  handleMode?: VectorHandleMode
  handle?: {
    target: Exclude<VectorPointTarget, typeof VECTOR_TOKENS.POINT.TARGET.ANCHOR>
    position: PositionData
    mode: VectorHandleMode
  }
}

export const updatePoint = (
  topology: VectorTopology,
  pointId: string,
  update: VectorPointUpdate
): VectorTopology | null => {
  let nextTopology = topology

  if (update.position) {
    const moved = translateAnchorAndHandles(nextTopology, pointId, update.position)
    if (!moved) {
      return null
    }
    nextTopology = moved
  }

  if (update.type) {
    nextTopology = setAnchorTypeInTopology(nextTopology, pointId, update.type)
  }

  if (update.handleMode) {
    const repaired = setHandleModeAndRepair(nextTopology, pointId, update.handleMode)
    if (!repaired) {
      return null
    }
    nextTopology = repaired
  }

  if (update.handle) {
    const repaired = updateHandleWithMode(
      nextTopology,
      pointId,
      update.handle.target,
      update.handle.position,
      update.handle.mode
    )
    if (!repaired) {
      return null
    }
    nextTopology = repaired
  }

  return nextTopology
}

export const buildVectorComputedPatch = (
  topologyInWorkspace: VectorTopology,
  options?: {
    closed?: boolean
  }
): Record<string, DataTypes> => {
  assertVectorTopologyConsistency(topologyInWorkspace, 'buildVectorComputedPatch')
  const bounds = calculateVectorBounds(topologyInWorkspace)
  const normalizedTopology = normalizeVectorTopology(
    topologyInWorkspace,
    bounds
  )
  const nextClosed =
    options?.closed ?? isClosedVectorTopology(normalizedTopology)

  return {
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    points: normalizedTopology.points,
    segments: normalizedTopology.segments,
    networks: normalizedTopology.networks,
    closed: nextClosed
  } satisfies Record<string, DataTypes>
}

export type VectorComputedData = {
  x?: number
  y?: number
  closed?: boolean
  points: Record<string, VectorPointNode>
  segments: Record<string, VectorSegment>
  networks: Record<string, VectorNetwork>
}

export const isVectorComputedData = (
  data: Partial<VectorComputedData>
): data is VectorComputedData & VectorTopologyData => {
  return (
    !!data &&
    typeof data === 'object' &&
    data.points !== undefined &&
    data.segments !== undefined &&
    data.networks !== undefined
  )
}

export const vectorGeometry = {
  validate: assertVectorTopologyConsistency,
  addPoint: insertPointAndRepairTopology,
  movePoint: translateAnchorAndHandles,
  splitSegment: splitSegmentAndRepairTopology,
  updatePoint,
  removePoint: removePointAndRepairTopology,
  connectEndpoints: connectEndpointsAndRepair,
  setHandleMode: setHandleModeAndRepair,
  updateHandle: updateHandleWithMode,
  buildPatch: buildVectorComputedPatch
}
