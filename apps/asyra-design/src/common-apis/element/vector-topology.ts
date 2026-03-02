import type {
  VectorAnchorPoint,
  VectorAnchorType,
  VectorNetwork,
  VectorPointNode,
  VectorSegment,
  VectorTopology
} from '@asyra/core'
import type { PositionData } from '@asyra/utils'

export type VectorAnchorSubpaths = VectorAnchorPoint[][]

type VectorTopologyLike = Pick<
  VectorTopology,
  'points' | 'segments' | 'networks'
>

const hasObjectValue = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const getNumericSuffix = (value: string) => {
  const match = value.match(/_(\d+)$/)
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
): node is VectorPointNode & { kind: 'anchor' } =>
  !!node && node.kind === 'anchor'

export const getControlId = (anchorId: string, role: 'in' | 'out') =>
  `${anchorId}:${role}`

export const createEmptyVectorTopology = (): VectorTopology => ({
  points: {},
  segments: {},
  networks: {}
})

export const isVectorTopology = (
  value: unknown
): value is Pick<VectorTopology, 'points' | 'segments' | 'networks'> => {
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
): value is Pick<VectorTopology, 'points' | 'segments' | 'networks'> => {
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

const getNextNumericId = (prefix: string, ids: string[]): string => {
  const max = ids.reduce((currentMax, id) => {
    const rank = getNumericSuffix(id)
    if (Number.isNaN(rank)) {
      return currentMax
    }

    return Math.max(currentMax, rank)
  }, -1)

  return `${prefix}_${max + 1}`
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

  const inHandleNode = topology.points[getControlId(pointId, 'in')]
  const outHandleNode = topology.points[getControlId(pointId, 'out')]

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
  const networkId = 'network_0'
  return {
    points: {
      [pointId]: {
        id: pointId,
        kind: 'anchor',
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
  }
): VectorTopology => {
  const nextPoints: Record<string, VectorPointNode> = {
    ...topology.points,
    [pointId]: {
      id: pointId,
      kind: 'anchor',
      anchorType: options?.anchorType ?? 'sharp',
      x: position.x,
      y: position.y
    }
  }
  const nextSegments = { ...topology.segments }
  const nextNetworks = { ...topology.networks }
  const networks = getOrderedNetworks(topology)

  if (options?.startNewSubpath || networks.length === 0) {
    const networkId = getNextNumericId('network', Object.keys(nextNetworks))
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

  const targetNetwork = networks[networks.length - 1]
  const lastPointId = targetNetwork.pointIds[targetNetwork.pointIds.length - 1]
  const segmentId = getNextNumericId('segment', Object.keys(nextSegments))

  nextSegments[segmentId] = {
    id: segmentId,
    startId: lastPointId,
    endId: pointId,
    outControlId: nextPoints[getControlId(lastPointId, 'out')]
      ? getControlId(lastPointId, 'out')
      : null,
    inControlId: nextPoints[getControlId(pointId, 'in')]
      ? getControlId(pointId, 'in')
      : null
  }

  nextNetworks[targetNetwork.id] = {
    ...targetNetwork,
    pointIds: [...targetNetwork.pointIds, pointId],
    segmentIds: [...targetNetwork.segmentIds, segmentId]
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
      segments: { ...topology.segments },
      networks: { ...topology.networks }
    }
  }

  return {
    points: {
      ...topology.points,
      [pointId]: {
        ...point,
        x: position.x,
        y: position.y
      }
    },
    segments: { ...topology.segments },
    networks: { ...topology.networks }
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
      segments: { ...topology.segments },
      networks: { ...topology.networks }
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
    segments: { ...topology.segments },
    networks: { ...topology.networks }
  }

  if (type === 'sharp') {
    nextTopology = setAnchorHandleInTopology(nextTopology, pointId, 'in', null)
    nextTopology = setAnchorHandleInTopology(nextTopology, pointId, 'out', null)
  }

  return nextTopology
}

export const setAnchorHandleInTopology = (
  topology: VectorTopologyLike,
  pointId: string,
  role: 'in' | 'out',
  position: PositionData | null
): VectorTopology => {
  const controlId = getControlId(pointId, role)
  let nextPoints = { ...topology.points }
  const nextSegments: Record<string, VectorSegment> = {}

  if (position) {
    nextPoints[controlId] = {
      id: controlId,
      kind: 'control',
      controlForId: pointId,
      controlRole: role,
      x: position.x,
      y: position.y
    }
  } else {
    nextPoints = omitKey(nextPoints, controlId)
  }

  Object.entries(topology.segments).forEach(([segmentId, segment]) => {
    if (role === 'out' && segment.startId === pointId) {
      nextSegments[segmentId] = {
        ...segment,
        outControlId: position ? controlId : null
      }
      return
    }

    if (role === 'in' && segment.endId === pointId) {
      nextSegments[segmentId] = {
        ...segment,
        inControlId: position ? controlId : null
      }
      return
    }

    nextSegments[segmentId] = segment
  })

  return {
    points: nextPoints,
    segments: nextSegments,
    networks: { ...topology.networks }
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
  const inControlId = getControlId(pointId, 'in')
  const outControlId = getControlId(pointId, 'out')

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
      const segmentId = getNextNumericId('segment', Object.keys(nextSegments))
      const startId = network.pointIds[network.pointIds.length - 1]
      const endId = network.pointIds[0]
      nextSegments[segmentId] = {
        id: segmentId,
        startId,
        endId,
        outControlId: topology.points[getControlId(startId, 'out')]
          ? getControlId(startId, 'out')
          : null,
        inControlId: topology.points[getControlId(endId, 'in')]
          ? getControlId(endId, 'in')
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
