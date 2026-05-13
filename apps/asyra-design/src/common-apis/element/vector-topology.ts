import type {
  VectorAnchorPoint,
  VectorAnchorType,
  VectorControlRole,
  VectorEndpointSide,
  VectorNetwork,
  VectorPointNode,
  VectorSegment,
  VectorTopology
} from '@asyra/core'
import {
  VECTOR_TOKENS,
  VECTOR_TOPOLOGY_NETWORK_ID_TYPE,
  VECTOR_TOPOLOGY_POINT_ID_TYPE,
  VECTOR_TOPOLOGY_SEGMENT_ID_TYPE
} from '@asyra/core'
import { id, type PositionData } from '@asyra/utils'
import { splitCubicBezierAtT } from './bezier-adapter'

export type VectorAnchorSubpaths = VectorAnchorPoint[][]
export type VectorTopologyEndpointSide = VectorEndpointSide

export interface VectorTopologyEndpoint {
  networkId: string
  pointId: string
  side: VectorTopologyEndpointSide
}

export const VECTOR_TOPOLOGY_DATA_KEYS = [
  'points',
  'segments',
  'networks'
] as const

export type VectorTopologyData = Pick<
  VectorTopology,
  (typeof VECTOR_TOPOLOGY_DATA_KEYS)[number]
>

type VectorTopologyLike = VectorTopologyData

const hasObjectValue = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

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

const omitKey = <T extends Record<string, unknown>>(
  source: T,
  key: string
): T => {
  const { [key]: _omitted, ...rest } = source
  return rest as T
}

const omitKeys = <T extends Record<string, unknown>>(
  source: T,
  keys: string[]
): T => keys.reduce((acc, key) => omitKey(acc, key), source)

const isAnchorNode = (
  node: VectorPointNode | undefined
): node is VectorPointNode & { kind: typeof VECTOR_TOKENS.POINT.KIND.ANCHOR } =>
  !!node && node.kind === VECTOR_TOKENS.POINT.KIND.ANCHOR

const isControlNode = (
  node: VectorPointNode | undefined
): node is VectorPointNode & {
  kind: typeof VECTOR_TOKENS.POINT.KIND.CONTROL
} => !!node && node.kind === VECTOR_TOKENS.POINT.KIND.CONTROL

export const getControlId = (anchorId: string, role: VectorControlRole) =>
  `${anchorId}:${role}`

export const createEmptyVectorTopology = (): VectorTopology => ({
  points: {},
  segments: {},
  networks: {}
})

export const isVectorTopology = (
  value: unknown
): value is VectorTopologyData => {
  if (!hasObjectValue(value)) {
    return false
  }

  return (
    hasObjectValue(value.points) &&
    hasObjectValue(value.segments) &&
    hasObjectValue(value.networks)
  )
}

export const hasVectorTopologyData = (
  value: unknown
): value is VectorTopologyData => {
  if (!isVectorTopology(value)) {
    return false
  }

  return Object.keys(value.points).length > 0
}

export const isClosedVectorTopology = (
  topology: Pick<VectorTopology, 'networks'>
): boolean =>
  Object.values(topology.networks).some((network) => network.closed === true)

export const getOrderedNetworks = (
  topology: VectorTopologyLike
): VectorNetwork[] => sortByStableId(Object.values(topology.networks))

export const getAnchorEndpointInTopology = (
  topology: VectorTopologyLike,
  pointId: string
): VectorTopologyEndpoint | null => {
  const networks = getOrderedNetworks(topology)
  for (const network of networks) {
    if (network.closed || network.pointIds.length === 0) {
      continue
    }

    const firstPointId = network.pointIds[0]
    const lastPointId = network.pointIds[network.pointIds.length - 1]
    if (firstPointId === pointId && lastPointId === pointId) {
      return {
        networkId: network.id,
        pointId,
        side: VECTOR_TOKENS.ENDPOINT.SIDE.END
      }
    }

    if (firstPointId === pointId) {
      return {
        networkId: network.id,
        pointId,
        side: VECTOR_TOKENS.ENDPOINT.SIDE.START
      }
    }
    if (lastPointId === pointId) {
      return {
        networkId: network.id,
        pointId,
        side: VECTOR_TOKENS.ENDPOINT.SIDE.END
      }
    }
  }

  return null
}

const getAnchorViewFromTopology = (
  topology: VectorTopologyLike,
  pointId: string,
  isMove: boolean
): VectorAnchorPoint | null => {
  const anchor = topology.points[pointId]
  if (!isAnchorNode(anchor)) {
    return null
  }

  const inHandleNode =
    topology.points[getControlId(pointId, VECTOR_TOKENS.CONTROL.ROLE.IN)]
  const outHandleNode =
    topology.points[getControlId(pointId, VECTOR_TOKENS.CONTROL.ROLE.OUT)]

  return {
    id: pointId,
    x: anchor.x,
    y: anchor.y,
    type: anchor.anchorType ?? 'sharp',
    isMove: isMove ? true : undefined,
    inHandle:
      inHandleNode && inHandleNode.kind === 'control'
        ? { x: inHandleNode.x, y: inHandleNode.y }
        : null,
    outHandle:
      outHandleNode && outHandleNode.kind === 'control'
        ? { x: outHandleNode.x, y: outHandleNode.y }
        : null
  }
}

export const vectorTopologyToAnchorSubpaths = (
  topology: VectorTopologyLike
): VectorAnchorSubpaths => {
  const networks = getOrderedNetworks(topology)
  const subpaths: VectorAnchorSubpaths = []

  networks.forEach((network) => {
    const subpath: VectorAnchorPoint[] = []
    network.pointIds.forEach((pointId) => {
      const view = getAnchorViewFromTopology(topology, pointId, false)
      if (view) {
        subpath.push(view)
      }
    })

    if (subpath.length > 0) {
      subpaths.push(subpath)
    }
  })

  return subpaths
}

export const vectorTopologyToAnchorPoints = (
  topology: VectorTopologyLike
): VectorAnchorPoint[] => {
  const networks = getOrderedNetworks(topology)
  const points: VectorAnchorPoint[] = []

  networks.forEach((network, networkIndex) => {
    network.pointIds.forEach((pointId, pointIndex) => {
      const view = getAnchorViewFromTopology(
        topology,
        pointId,
        networkIndex > 0 && pointIndex === 0
      )
      if (view) {
        points.push(view)
      }
    })
  })

  return points
}

export const toWorkspaceTopology = (
  topology: VectorTopologyLike,
  offset: PositionData
): VectorTopology => {
  const points: Record<string, VectorPointNode> = {}
  Object.entries(topology.points).forEach(([pointId, point]) => {
    points[pointId] = {
      ...point,
      x: point.x + offset.x,
      y: point.y + offset.y
    }
  })

  return {
    points,
    segments: { ...topology.segments },
    networks: { ...topology.networks }
  }
}

export const toLocalTopology = (
  topology: VectorTopologyLike,
  offset: PositionData
): VectorTopology => {
  const points: Record<string, VectorPointNode> = {}
  Object.entries(topology.points).forEach(([pointId, point]) => {
    points[pointId] = {
      ...point,
      x: point.x - offset.x,
      y: point.y - offset.y
    }
  })

  return {
    points,
    segments: { ...topology.segments },
    networks: { ...topology.networks }
  }
}

export const createVectorTopologyFromSinglePoint = (
  pointId: string,
  position: PositionData,
  anchorType: VectorAnchorType = 'sharp'
): VectorTopology => {
  const networkId = id(VECTOR_TOPOLOGY_NETWORK_ID_TYPE)
  return {
    points: {
      [pointId]: {
        id: pointId,
        kind: VECTOR_TOKENS.POINT.KIND.ANCHOR,
        anchorType,
        x: position.x,
        y: position.y
      }
    },
    segments: {},
    networks: {
      [networkId]: {
        id: networkId,
        pointIds: [pointId],
        segmentIds: [],
        closed: false
      }
    }
  }
}

export const appendAnchorPointToTopology = (
  topology: VectorTopologyLike,
  pointId: string,
  position: PositionData,
  options?: {
    startNewSubpath?: boolean
    anchorType?: VectorAnchorType
    continuation?: VectorTopologyEndpoint | null
  }
): VectorTopology => {
  const nextPoints: Record<string, VectorPointNode> = {
    ...topology.points,
    [pointId]: {
      id: pointId,
      kind: VECTOR_TOKENS.POINT.KIND.ANCHOR,
      anchorType: options?.anchorType ?? 'sharp',
      x: position.x,
      y: position.y
    }
  }
  const nextSegments = { ...topology.segments }
  const nextNetworks = { ...topology.networks }
  const networks = getOrderedNetworks(topology)

  if (options?.startNewSubpath || networks.length === 0) {
    const networkId = id(VECTOR_TOPOLOGY_NETWORK_ID_TYPE)
    nextNetworks[networkId] = {
      id: networkId,
      pointIds: [pointId],
      segmentIds: [],
      closed: false
    }

    return {
      points: nextPoints,
      segments: nextSegments,
      networks: nextNetworks
    }
  }

  const continuation = options?.continuation
  const resolvedContinuation =
    continuation && nextNetworks[continuation.networkId] ? continuation : null
  const targetNetwork = resolvedContinuation
    ? nextNetworks[resolvedContinuation.networkId]
    : networks[networks.length - 1]
  const continuationSide: VectorTopologyEndpointSide =
    resolvedContinuation?.side ?? VECTOR_TOKENS.ENDPOINT.SIDE.END
  const connectedPointId =
    continuationSide === VECTOR_TOKENS.ENDPOINT.SIDE.START
      ? targetNetwork.pointIds[0]
      : targetNetwork.pointIds[targetNetwork.pointIds.length - 1]
  const segmentId = id(VECTOR_TOPOLOGY_SEGMENT_ID_TYPE)
  const segmentStartId =
    continuationSide === VECTOR_TOKENS.ENDPOINT.SIDE.START
      ? pointId
      : connectedPointId
  const segmentEndId =
    continuationSide === VECTOR_TOKENS.ENDPOINT.SIDE.START
      ? connectedPointId
      : pointId

  nextSegments[segmentId] = {
    id: segmentId,
    startId: segmentStartId,
    endId: segmentEndId,
    outControlId: nextPoints[
      getControlId(segmentStartId, VECTOR_TOKENS.CONTROL.ROLE.OUT)
    ]
      ? getControlId(segmentStartId, VECTOR_TOKENS.CONTROL.ROLE.OUT)
      : null,
    inControlId: nextPoints[
      getControlId(segmentEndId, VECTOR_TOKENS.CONTROL.ROLE.IN)
    ]
      ? getControlId(segmentEndId, VECTOR_TOKENS.CONTROL.ROLE.IN)
      : null
  }

  nextNetworks[targetNetwork.id] = {
    ...targetNetwork,
    pointIds:
      continuationSide === VECTOR_TOKENS.ENDPOINT.SIDE.START
        ? [pointId, ...targetNetwork.pointIds]
        : [...targetNetwork.pointIds, pointId],
    segmentIds:
      continuationSide === VECTOR_TOKENS.ENDPOINT.SIDE.START
        ? [segmentId, ...targetNetwork.segmentIds]
        : [...targetNetwork.segmentIds, segmentId]
  }

  return { points: nextPoints, segments: nextSegments, networks: nextNetworks }
}

export const updateAnchorPositionInTopology = (
  topology: VectorTopologyLike,
  pointId: string,
  position: PositionData
): VectorTopology => {
  const point = topology.points[pointId]
  if (!isAnchorNode(point)) {
    return {
      points: { ...topology.points },
      segments: topology.segments,
      networks: topology.networks
    }
  }

  const dx = position.x - point.x
  const dy = position.y - point.y

  const nextPoints: Record<string, VectorPointNode> = {
    ...topology.points,
    [pointId]: {
      ...point,
      x: position.x,
      y: position.y
    }
  }

  if (dx !== 0 || dy !== 0) {
    const inControlId = getControlId(pointId, VECTOR_TOKENS.CONTROL.ROLE.IN)
    const outControlId = getControlId(pointId, VECTOR_TOKENS.CONTROL.ROLE.OUT)
    const inControl = topology.points[inControlId]
    const outControl = topology.points[outControlId]

    if (isControlNode(inControl)) {
      nextPoints[inControlId] = {
        ...inControl,
        x: inControl.x + dx,
        y: inControl.y + dy
      }
    }

    if (isControlNode(outControl)) {
      nextPoints[outControlId] = {
        ...outControl,
        x: outControl.x + dx,
        y: outControl.y + dy
      }
    }
  }

  return {
    points: nextPoints,
    segments: topology.segments,
    networks: topology.networks
  }
}

export const setAnchorTypeInTopology = (
  topology: VectorTopologyLike,
  pointId: string,
  type: VectorAnchorType
): VectorTopology => {
  const point = topology.points[pointId]
  if (!isAnchorNode(point)) {
    return {
      points: { ...topology.points },
      segments: topology.segments,
      networks: topology.networks
    }
  }

  if (point.anchorType === type && type !== 'sharp') {
    return {
      points: topology.points,
      segments: topology.segments,
      networks: topology.networks
    }
  }

  let nextTopology: VectorTopology = {
    points: {
      ...topology.points,
      [pointId]: {
        ...point,
        anchorType: type
      }
    },
    segments: topology.segments,
    networks: topology.networks
  }

  if (type === 'sharp') {
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
  }

  return nextTopology
}

export const setAnchorHandleInTopology = (
  topology: VectorTopologyLike,
  pointId: string,
  role: VectorControlRole,
  position: PositionData | null
): VectorTopology => {
  const controlId = getControlId(pointId, role)
  let nextPoints = { ...topology.points }
  const nextSegments: Record<string, VectorSegment> = {}
  const nextControlId = position ? controlId : null

  if (position) {
    nextPoints[controlId] = {
      id: controlId,
      kind: VECTOR_TOKENS.POINT.KIND.CONTROL,
      controlForId: pointId,
      controlRole: role,
      x: position.x,
      y: position.y
    }
  } else {
    nextPoints = omitKey(nextPoints, controlId)
  }

  Object.entries(topology.segments).forEach(([segmentId, segment]) => {
    if (
      role === VECTOR_TOKENS.CONTROL.ROLE.OUT &&
      segment.startId === pointId
    ) {
      nextSegments[segmentId] =
        segment.outControlId === nextControlId
          ? segment
          : {
              ...segment,
              outControlId: nextControlId
            }
      return
    }

    if (role === VECTOR_TOKENS.CONTROL.ROLE.IN && segment.endId === pointId) {
      nextSegments[segmentId] =
        segment.inControlId === nextControlId
          ? segment
          : {
              ...segment,
              inControlId: nextControlId
            }
      return
    }

    nextSegments[segmentId] = segment
  })

  return {
    points: nextPoints,
    segments: nextSegments,
    networks: topology.networks
  }
}

export const removeLastSinglePointSubpath = (
  topology: VectorTopologyLike
): VectorTopology | null => {
  const networks = getOrderedNetworks(topology)
  if (networks.length <= 1) {
    return null
  }

  const lastNetwork = networks[networks.length - 1]
  if (lastNetwork.pointIds.length !== 1) {
    return null
  }

  const pointId = lastNetwork.pointIds[0]
  const inControlId = getControlId(pointId, VECTOR_TOKENS.CONTROL.ROLE.IN)
  const outControlId = getControlId(pointId, VECTOR_TOKENS.CONTROL.ROLE.OUT)

  const nextPoints = omitKeys({ ...topology.points }, [
    pointId,
    inControlId,
    outControlId
  ])

  const nextNetworks = omitKey({ ...topology.networks }, lastNetwork.id)

  return {
    points: nextPoints,
    segments: { ...topology.segments },
    networks: nextNetworks
  }
}

const createSegmentChain = (
  points: Record<string, VectorPointNode>,
  pointIds: string[],
  closed: boolean
): {
  segments: Record<string, VectorSegment>
  segmentIds: string[]
} => {
  if (pointIds.length < 2) {
    return {
      segments: {},
      segmentIds: []
    }
  }

  const segmentPairs: { startId: string; endId: string }[] = []
  for (let i = 1; i < pointIds.length; i += 1) {
    segmentPairs.push({
      startId: pointIds[i - 1],
      endId: pointIds[i]
    })
  }

  if (closed && pointIds.length > 1) {
    segmentPairs.push({
      startId: pointIds[pointIds.length - 1],
      endId: pointIds[0]
    })
  }

  const segments: Record<string, VectorSegment> = {}
  const segmentIds: string[] = []

  segmentPairs.forEach(({ startId, endId }) => {
    const segmentId = id(VECTOR_TOPOLOGY_SEGMENT_ID_TYPE)
    const outControlId = getControlId(startId, VECTOR_TOKENS.CONTROL.ROLE.OUT)
    const inControlId = getControlId(endId, VECTOR_TOKENS.CONTROL.ROLE.IN)
    const outControl = points[outControlId]
    const inControl = points[inControlId]

    segments[segmentId] = {
      id: segmentId,
      startId,
      endId,
      outControlId: isControlNode(outControl) ? outControlId : null,
      inControlId: isControlNode(inControl) ? inControlId : null
    }
    segmentIds.push(segmentId)
  })

  return {
    segments,
    segmentIds
  }
}

const pruneUnusedControls = (
  points: Record<string, VectorPointNode>,
  segments: Record<string, VectorSegment>
) => {
  const usedControlIds = new Set<string>()

  Object.values(segments).forEach((segment) => {
    if (segment.outControlId) {
      usedControlIds.add(segment.outControlId)
    }
    if (segment.inControlId) {
      usedControlIds.add(segment.inControlId)
    }
  })

  const nextPoints: Record<string, VectorPointNode> = {}
  Object.entries(points).forEach(([pointId, point]) => {
    if (
      point.kind === VECTOR_TOKENS.POINT.KIND.CONTROL &&
      !usedControlIds.has(pointId)
    ) {
      return
    }

    nextPoints[pointId] = point
  })

  return nextPoints
}

const SPLIT_T_EPSILON = 1e-6
const CONTROL_POINT_EPSILON_SQUARED = 1e-8

const clampUnit = (value: number) => Math.max(0, Math.min(1, value))

const isNonDegenerateControl = (
  control: PositionData,
  anchor: PositionData
): boolean => {
  const dx = control.x - anchor.x
  const dy = control.y - anchor.y
  return dx * dx + dy * dy > CONTROL_POINT_EPSILON_SQUARED
}

const upsertControlPoint = (
  points: Record<string, VectorPointNode>,
  anchorId: string,
  role: VectorControlRole,
  controlPosition: PositionData | null,
  anchorPosition: PositionData
): { points: Record<string, VectorPointNode>; controlId: string | null } => {
  const controlId = getControlId(anchorId, role)
  if (
    !controlPosition ||
    !isNonDegenerateControl(controlPosition, anchorPosition)
  ) {
    return {
      points: omitKey(points, controlId) as Record<string, VectorPointNode>,
      controlId: null
    }
  }

  return {
    points: {
      ...points,
      [controlId]: {
        id: controlId,
        kind: VECTOR_TOKENS.POINT.KIND.CONTROL,
        controlForId: anchorId,
        controlRole: role,
        x: controlPosition.x,
        y: controlPosition.y
      }
    },
    controlId
  }
}

export const splitSegmentInTopology = (
  topology: VectorTopologyLike,
  segmentId: string,
  split: { t: number }
): { topology: VectorTopology; pointId: string } | null => {
  const segment = topology.segments[segmentId]
  if (!segment) {
    return null
  }

  const startAnchor = topology.points[segment.startId]
  const endAnchor = topology.points[segment.endId]
  if (!isAnchorNode(startAnchor) || !isAnchorNode(endAnchor)) {
    return null
  }

  const t = clampUnit(split.t)
  if (t <= SPLIT_T_EPSILON || t >= 1 - SPLIT_T_EPSILON) {
    return null
  }

  const orderedNetworks = getOrderedNetworks(topology)
  const targetNetwork = orderedNetworks.find((network) =>
    network.segmentIds.includes(segmentId)
  )
  if (!targetNetwork) {
    return null
  }

  const startIndex = targetNetwork.pointIds.indexOf(segment.startId)
  const endIndex = targetNetwork.pointIds.indexOf(segment.endId)
  if (startIndex === -1 || endIndex === -1) {
    return null
  }

  const isSequential = endIndex === startIndex + 1
  const isClosingSegment =
    targetNetwork.closed &&
    startIndex === targetNetwork.pointIds.length - 1 &&
    endIndex === 0
  if (!isSequential && !isClosingSegment) {
    return null
  }

  const outControl =
    segment.outControlId && isControlNode(topology.points[segment.outControlId])
      ? topology.points[segment.outControlId]
      : null
  const inControl =
    segment.inControlId && isControlNode(topology.points[segment.inControlId])
      ? topology.points[segment.inControlId]
      : null
  const splitGeometry = splitCubicBezierAtT(
    { x: startAnchor.x, y: startAnchor.y },
    outControl
      ? { x: outControl.x, y: outControl.y }
      : { x: startAnchor.x, y: startAnchor.y },
    inControl
      ? { x: inControl.x, y: inControl.y }
      : { x: endAnchor.x, y: endAnchor.y },
    { x: endAnchor.x, y: endAnchor.y },
    t
  )
  const hasCurve = !!(outControl || inControl)

  const splitPointId = id(VECTOR_TOPOLOGY_POINT_ID_TYPE)
  const splitPointPosition = splitGeometry.splitPoint
  let nextPoints: Record<string, VectorPointNode> = {
    ...topology.points,
    [splitPointId]: {
      id: splitPointId,
      kind: VECTOR_TOKENS.POINT.KIND.ANCHOR,
      anchorType: hasCurve ? 'smooth' : 'sharp',
      x: splitPointPosition.x,
      y: splitPointPosition.y
    }
  }

  const nextSegments = omitKey(topology.segments, segmentId) as Record<
    string,
    VectorSegment
  >

  const firstSegmentId = id(VECTOR_TOPOLOGY_SEGMENT_ID_TYPE)
  const secondSegmentId = id(VECTOR_TOPOLOGY_SEGMENT_ID_TYPE)

  let startOutControlId: string | null = null
  let splitInControlId: string | null = null
  let splitOutControlId: string | null = null
  let endInControlId: string | null = null

  if (hasCurve) {
    const startOutResult = upsertControlPoint(
      nextPoints,
      segment.startId,
      VECTOR_TOKENS.CONTROL.ROLE.OUT,
      splitGeometry.startOutControl,
      { x: startAnchor.x, y: startAnchor.y }
    )
    nextPoints = startOutResult.points
    startOutControlId = startOutResult.controlId

    const splitInResult = upsertControlPoint(
      nextPoints,
      splitPointId,
      VECTOR_TOKENS.CONTROL.ROLE.IN,
      splitGeometry.splitInControl,
      splitPointPosition
    )
    nextPoints = splitInResult.points
    splitInControlId = splitInResult.controlId

    const splitOutResult = upsertControlPoint(
      nextPoints,
      splitPointId,
      VECTOR_TOKENS.CONTROL.ROLE.OUT,
      splitGeometry.splitOutControl,
      splitPointPosition
    )
    nextPoints = splitOutResult.points
    splitOutControlId = splitOutResult.controlId

    const endInResult = upsertControlPoint(
      nextPoints,
      segment.endId,
      VECTOR_TOKENS.CONTROL.ROLE.IN,
      splitGeometry.endInControl,
      { x: endAnchor.x, y: endAnchor.y }
    )
    nextPoints = endInResult.points
    endInControlId = endInResult.controlId
  }

  nextSegments[firstSegmentId] = {
    id: firstSegmentId,
    startId: segment.startId,
    endId: splitPointId,
    outControlId: startOutControlId,
    inControlId: splitInControlId
  }
  nextSegments[secondSegmentId] = {
    id: secondSegmentId,
    startId: splitPointId,
    endId: segment.endId,
    outControlId: splitOutControlId,
    inControlId: endInControlId
  }

  const networkSegmentIndex = targetNetwork.segmentIds.indexOf(segmentId)
  if (networkSegmentIndex === -1) {
    return null
  }

  const insertPointIndex = isClosingSegment
    ? targetNetwork.pointIds.length
    : endIndex
  const nextPointIds = [...targetNetwork.pointIds]
  nextPointIds.splice(insertPointIndex, 0, splitPointId)

  const nextSegmentIds = [...targetNetwork.segmentIds]
  nextSegmentIds.splice(networkSegmentIndex, 1, firstSegmentId, secondSegmentId)

  const nextNetworks: Record<string, VectorNetwork> = {
    ...topology.networks,
    [targetNetwork.id]: {
      ...targetNetwork,
      pointIds: nextPointIds,
      segmentIds: nextSegmentIds
    }
  }

  const prunedPoints = pruneUnusedControls(nextPoints, nextSegments)

  return {
    topology: {
      points: prunedPoints,
      segments: nextSegments,
      networks: nextNetworks
    },
    pointId: splitPointId
  }
}

export const removeAnchorPointFromTopology = (
  topology: VectorTopologyLike,
  pointId: string
): VectorTopology | null => {
  const point = topology.points[pointId]
  if (!isAnchorNode(point)) {
    return null
  }

  const sourceNetworks = getOrderedNetworks(topology)
  const targetNetwork = sourceNetworks.find((network) =>
    network.pointIds.includes(pointId)
  )
  if (!targetNetwork) {
    return null
  }

  const inControlId = getControlId(pointId, VECTOR_TOKENS.CONTROL.ROLE.IN)
  const outControlId = getControlId(pointId, VECTOR_TOKENS.CONTROL.ROLE.OUT)
  let nextPoints = omitKeys({ ...topology.points }, [
    pointId,
    inControlId,
    outControlId
  ])
  const nextSegments: Record<string, VectorSegment> = {}
  const nextNetworks: Record<string, VectorNetwork> = {}

  const addRebuiltNetwork = (
    networkId: string,
    pointIds: string[],
    closed: boolean
  ) => {
    const normalizedClosed = closed && pointIds.length > 2
    const rebuilt = createSegmentChain(nextPoints, pointIds, normalizedClosed)

    nextNetworks[networkId] = {
      id: networkId,
      pointIds,
      segmentIds: rebuilt.segmentIds,
      closed: normalizedClosed
    }
    Object.assign(nextSegments, rebuilt.segments)
  }

  sourceNetworks.forEach((network) => {
    if (network.id !== targetNetwork.id) {
      nextNetworks[network.id] = {
        ...network,
        pointIds: [...network.pointIds],
        segmentIds: [...network.segmentIds]
      }

      network.segmentIds.forEach((segmentId) => {
        const segment = topology.segments[segmentId]
        if (!segment) {
          return
        }
        nextSegments[segmentId] = segment
      })
      return
    }

    const pointIndex = network.pointIds.indexOf(pointId)
    if (pointIndex === -1) {
      return
    }

    if (network.closed) {
      const remainingPointIds = network.pointIds.filter((id) => id !== pointId)
      if (remainingPointIds.length === 0) {
        return
      }

      addRebuiltNetwork(network.id, remainingPointIds, true)
      return
    }

    const isEndpoint =
      pointIndex === 0 || pointIndex === network.pointIds.length - 1
    if (isEndpoint) {
      const remainingPointIds = network.pointIds.filter((id) => id !== pointId)
      if (remainingPointIds.length === 0) {
        return
      }

      addRebuiltNetwork(network.id, remainingPointIds, false)
      return
    }

    const leftPointIds = network.pointIds.slice(0, pointIndex)
    const rightPointIds = network.pointIds.slice(pointIndex + 1)

    if (leftPointIds.length > 0) {
      addRebuiltNetwork(network.id, leftPointIds, false)
    }
    if (rightPointIds.length > 0) {
      addRebuiltNetwork(
        id(VECTOR_TOPOLOGY_NETWORK_ID_TYPE),
        rightPointIds,
        false
      )
    }
  })

  nextPoints = pruneUnusedControls(nextPoints, nextSegments)

  return {
    points: nextPoints,
    segments: nextSegments,
    networks: nextNetworks
  }
}

export const setTopologyClosed = (
  topology: VectorTopologyLike,
  closed: boolean
): VectorTopology => {
  const nextSegments: Record<string, VectorSegment> = {}
  const nextNetworks: Record<string, VectorNetwork> = {}
  const networks = getOrderedNetworks(topology)

  networks.forEach((network) => {
    const nextSegmentIds: string[] = []

    network.segmentIds.forEach((segmentId) => {
      const segment = topology.segments[segmentId]
      if (!segment) {
        return
      }

      const isClosingSegment =
        network.pointIds.length > 1 &&
        segment.startId === network.pointIds[network.pointIds.length - 1] &&
        segment.endId === network.pointIds[0]
      if (!isClosingSegment) {
        nextSegments[segmentId] = segment
        nextSegmentIds.push(segmentId)
      }
    })

    if (closed && network.pointIds.length > 1) {
      const segmentId = id(VECTOR_TOPOLOGY_SEGMENT_ID_TYPE)
      const startId = network.pointIds[network.pointIds.length - 1]
      const endId = network.pointIds[0]
      nextSegments[segmentId] = {
        id: segmentId,
        startId,
        endId,
        outControlId: topology.points[
          getControlId(startId, VECTOR_TOKENS.CONTROL.ROLE.OUT)
        ]
          ? getControlId(startId, VECTOR_TOKENS.CONTROL.ROLE.OUT)
          : null,
        inControlId: topology.points[
          getControlId(endId, VECTOR_TOKENS.CONTROL.ROLE.IN)
        ]
          ? getControlId(endId, VECTOR_TOKENS.CONTROL.ROLE.IN)
          : null
      }
      nextSegmentIds.push(segmentId)
    }

    nextNetworks[network.id] = {
      ...network,
      segmentIds: nextSegmentIds,
      closed
    }
  })

  return {
    points: { ...topology.points },
    segments: nextSegments,
    networks: nextNetworks
  }
}

const swapAnchorHandleRolesForPoints = (
  points: Record<string, VectorPointNode>,
  pointIds: string[]
): Record<string, VectorPointNode> => {
  let nextPoints = { ...points }

  pointIds.forEach((pointId) => {
    const anchor = nextPoints[pointId]
    if (!isAnchorNode(anchor)) {
      return
    }

    const inControlId = getControlId(pointId, VECTOR_TOKENS.CONTROL.ROLE.IN)
    const outControlId = getControlId(pointId, VECTOR_TOKENS.CONTROL.ROLE.OUT)
    const inControl = isControlNode(nextPoints[inControlId])
      ? nextPoints[inControlId]
      : null
    const outControl = isControlNode(nextPoints[outControlId])
      ? nextPoints[outControlId]
      : null

    if (outControl) {
      nextPoints[inControlId] = {
        ...outControl,
        id: inControlId,
        controlForId: pointId,
        controlRole: VECTOR_TOKENS.CONTROL.ROLE.IN
      }
    } else {
      nextPoints = omitKey(nextPoints, inControlId) as Record<
        string,
        VectorPointNode
      >
    }

    if (inControl) {
      nextPoints[outControlId] = {
        ...inControl,
        id: outControlId,
        controlForId: pointId,
        controlRole: VECTOR_TOKENS.CONTROL.ROLE.OUT
      }
    } else {
      nextPoints = omitKey(nextPoints, outControlId) as Record<
        string,
        VectorPointNode
      >
    }
  })

  return nextPoints
}

export const connectAnchorEndpointsInTopology = (
  topology: VectorTopologyLike,
  sourceEndpoint: VectorTopologyEndpoint,
  targetEndpoint: VectorTopologyEndpoint
): { topology: VectorTopology; closed: boolean } | null => {
  const sourceNetwork = topology.networks[sourceEndpoint.networkId]
  const targetNetwork = topology.networks[targetEndpoint.networkId]
  if (!sourceNetwork || !targetNetwork) {
    return null
  }

  if (sourceNetwork.closed || targetNetwork.closed) {
    return null
  }

  if (sourceEndpoint.networkId === targetEndpoint.networkId) {
    if (sourceEndpoint.pointId === targetEndpoint.pointId) {
      return null
    }

    if (sourceEndpoint.side === targetEndpoint.side) {
      return null
    }

    const nextSegments: Record<string, VectorSegment> = {}
    const nextNetworks: Record<string, VectorNetwork> = {}

    getOrderedNetworks(topology).forEach((network) => {
      if (network.id === sourceNetwork.id) {
        return
      }

      nextNetworks[network.id] = {
        ...network,
        pointIds: [...network.pointIds],
        segmentIds: [...network.segmentIds]
      }

      network.segmentIds.forEach((segmentId) => {
        const segment = topology.segments[segmentId]
        if (segment) {
          nextSegments[segmentId] = segment
        }
      })
    })

    const rebuilt = createSegmentChain(
      topology.points,
      [...sourceNetwork.pointIds],
      true
    )

    nextNetworks[sourceNetwork.id] = {
      ...sourceNetwork,
      pointIds: [...sourceNetwork.pointIds],
      segmentIds: rebuilt.segmentIds,
      closed: true
    }
    Object.assign(nextSegments, rebuilt.segments)

    const nextPoints = pruneUnusedControls({ ...topology.points }, nextSegments)

    return {
      topology: {
        points: nextPoints,
        segments: nextSegments,
        networks: nextNetworks
      },
      closed: true
    }
  }

  const sourcePointIds = [...sourceNetwork.pointIds]
  const targetPointIds = [...targetNetwork.pointIds]
  if (sourcePointIds.length === 0 || targetPointIds.length === 0) {
    return null
  }

  let reverseTarget = false
  let mergedPointIds: string[] | null = null

  if (
    sourceEndpoint.side === VECTOR_TOKENS.ENDPOINT.SIDE.END &&
    targetEndpoint.side === VECTOR_TOKENS.ENDPOINT.SIDE.START
  ) {
    mergedPointIds = [...sourcePointIds, ...targetPointIds]
  } else if (
    sourceEndpoint.side === VECTOR_TOKENS.ENDPOINT.SIDE.START &&
    targetEndpoint.side === VECTOR_TOKENS.ENDPOINT.SIDE.END
  ) {
    mergedPointIds = [...targetPointIds, ...sourcePointIds]
  } else if (
    sourceEndpoint.side === VECTOR_TOKENS.ENDPOINT.SIDE.END &&
    targetEndpoint.side === VECTOR_TOKENS.ENDPOINT.SIDE.END
  ) {
    reverseTarget = true
    mergedPointIds = [...sourcePointIds, ...[...targetPointIds].reverse()]
  } else if (
    sourceEndpoint.side === VECTOR_TOKENS.ENDPOINT.SIDE.START &&
    targetEndpoint.side === VECTOR_TOKENS.ENDPOINT.SIDE.START
  ) {
    reverseTarget = true
    mergedPointIds = [...[...targetPointIds].reverse(), ...sourcePointIds]
  }

  if (!mergedPointIds || mergedPointIds.length < 2) {
    return null
  }

  const nextPoints = reverseTarget
    ? swapAnchorHandleRolesForPoints(
        { ...topology.points },
        targetNetwork.pointIds
      )
    : { ...topology.points }

  const nextSegments: Record<string, VectorSegment> = {}
  const nextNetworks: Record<string, VectorNetwork> = {}
  getOrderedNetworks(topology).forEach((network) => {
    if (network.id === sourceNetwork.id || network.id === targetNetwork.id) {
      return
    }

    nextNetworks[network.id] = {
      ...network,
      pointIds: [...network.pointIds],
      segmentIds: [...network.segmentIds]
    }

    network.segmentIds.forEach((segmentId) => {
      const segment = topology.segments[segmentId]
      if (segment) {
        nextSegments[segmentId] = segment
      }
    })
  })

  const rebuilt = createSegmentChain(nextPoints, mergedPointIds, false)
  nextNetworks[sourceNetwork.id] = {
    id: sourceNetwork.id,
    pointIds: mergedPointIds,
    segmentIds: rebuilt.segmentIds,
    closed: false
  }
  Object.assign(nextSegments, rebuilt.segments)
  const prunedPoints = pruneUnusedControls(nextPoints, nextSegments)

  return {
    topology: {
      points: prunedPoints,
      segments: nextSegments,
      networks: nextNetworks
    },
    closed: false
  }
}
