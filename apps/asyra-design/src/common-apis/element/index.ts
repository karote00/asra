/**
 * Element Utility APIs - common element operations
 * Used in: create-element, and future features
 */

import { startTransaction, endTransaction } from '@asyra/reactive-events'
import {
  DEFAULT_ELEMENT_SIZE,
  EntityTypes,
  type EntityType,
  type DataTypes,
  type PositionData,
  type EVENT_OPTIONS,
  type GroupInstanceTypes
} from '@asyra/utils'
import type {
  VectorAnchorPoint,
  VectorEndpointSide,
  VectorNetwork,
  VectorPathStyle,
  VectorPointNode,
  VectorSegment,
  VectorTopology
} from '@asyra/core'
import { VECTOR_TOKENS } from '@asyra/core'
import { isEqual } from 'lodash'
import core, { render, sceneTree } from '../../contexts'
import {
  calculateVectorBounds,
  normalizeVectorTopology
} from './vector-geometry'
import {
  appendAnchorPointToTopology,
  connectAnchorEndpointsInTopology,
  createEmptyVectorTopology,
  createVectorTopologyFromSinglePoint,
  getAnchorEndpointInTopology,
  getOrderedNetworks,
  hasVectorTopologyData,
  isClosedVectorTopology,
  isVectorTopology,
  removeAnchorPointFromTopology,
  removeLastSinglePointSubpath,
  setAnchorHandleInTopology,
  setAnchorTypeInTopology,
  splitSegmentInTopology,
  setTopologyClosed,
  toWorkspaceTopology,
  updateAnchorPositionInTopology,
  type VectorTopologyData,
  vectorTopologyToAnchorPoints,
  vectorTopologyToAnchorSubpaths
} from './vector-topology'
import { projectPointToCubicBezier } from './bezier-adapter'
import type {
  CreateElementOptions,
  ElementBounds,
  VectorSegmentHit,
  VectorComputedSnapshot,
  VectorEditablePointHit,
  VectorPointTarget
} from './types'
export type { VectorPointTarget } from './types'

const DEFAULT_VECTOR_STYLE: VectorPathStyle = {
  closed: false,
  fill: 'none',
  stroke: '#cccccc',
  strokeWidth: 1
}
const VECTOR_POINT_HIT_RADIUS = 6
const VECTOR_SEGMENT_HIT_RADIUS = 8

interface VectorComputedData {
  x?: number
  y?: number
  closed?: boolean
  points: Record<string, VectorPointNode>
  segments: Record<string, VectorSegment>
  networks: Record<string, VectorNetwork>
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

const createVectorComputedPatch = (
  elementId: string,
  nextData: Record<string, DataTypes>
) => {
  const element = sceneTree.getElementById(elementId)
  if (!element) {
    return nextData
  }

  const computed = element.getAllComputedData() as VectorComputedSnapshot
  const patch: Record<string, DataTypes> = {}

  Object.entries(nextData).forEach(([key, value]) => {
    const current = computed[key as keyof VectorComputedSnapshot]
    if (!isEqual(current, value)) {
      patch[key] = value
    }
  })

  return patch
}

const getElementChildren = (element: unknown): string[] => {
  const maybeGetter = element as { get?: (key: string) => unknown }
  const value = maybeGetter.get?.('children')
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter(
    (childId): childId is string => typeof childId === 'string'
  )
}

const createElementAtWorkspacePos = (
  type: EntityType,
  workspacePos: PositionData,
  extraData: Record<string, DataTypes> = {},
  options?: EVENT_OPTIONS
): string => {
  startTransaction()
  const elementId = core.createElement(
    {
      type,
      x: workspacePos.x,
      y: workspacePos.y,
      ...extraData
    },
    undefined,
    undefined,
    options
  )
  endTransaction()

  return elementId
}

const getVectorComputed = (elementId: string): VectorComputedData | null => {
  const element = sceneTree.getElementById(elementId)
  if (!element) {
    return null
  }

  const computedRaw =
    element.getAllComputedData() as Partial<VectorComputedData>
  if (!hasVectorTopologyData(computedRaw)) {
    return null
  }
  const computed = computedRaw as Partial<VectorComputedData> &
    VectorTopologyData

  return {
    x: computed.x,
    y: computed.y,
    closed: computed.closed,
    points: computed.points,
    segments: computed.segments,
    networks: computed.networks
  }
}

const getVectorOffset = (computed: Pick<VectorComputedData, 'x' | 'y'>) => ({
  x: typeof computed.x === 'number' ? computed.x : 0,
  y: typeof computed.y === 'number' ? computed.y : 0
})

const getVectorTopologyLocal = (elementId: string): VectorTopology => {
  const computed = getVectorComputed(elementId)
  if (!computed) {
    return createEmptyVectorTopology()
  }

  return {
    points: computed.points,
    segments: computed.segments,
    networks: computed.networks
  }
}

const getVectorTopologyWorkspace = (elementId: string): VectorTopology => {
  const computed = getVectorComputed(elementId)
  if (!computed) {
    return createEmptyVectorTopology()
  }

  return toWorkspaceTopology(
    {
      points: computed.points,
      segments: computed.segments,
      networks: computed.networks
    },
    getVectorOffset(computed)
  )
}

const commitVectorTopology = (
  elementId: string,
  topologyInWorkspace: VectorTopology,
  options?: EVENT_OPTIONS & {
    closed?: boolean
  }
) => {
  const bounds = calculateVectorBounds(topologyInWorkspace)
  const normalizedTopology = normalizeVectorTopology(
    topologyInWorkspace,
    bounds
  )
  const nextClosed =
    options?.closed ?? isClosedVectorTopology(normalizedTopology)

  const nextData: Record<string, DataTypes> = {
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    points: normalizedTopology.points,
    segments: normalizedTopology.segments,
    networks: normalizedTopology.networks,
    closed: nextClosed
  }

  const patch = createVectorComputedPatch(elementId, nextData)
  if (Object.keys(patch).length === 0) {
    return
  }

  elementApis.changeComputedData([elementId], patch, options)
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

export const elementApis = {
  isContainerType: (type: string): boolean => {
    return core.isContainerType(type)
  },

  getElementIdAtWorkspacePos: (workspacePos: PositionData): string | null => {
    const workspace =
      sceneTree.currentWorkspace ??
      sceneTree.getElementById(sceneTree.workspace)
    if (!workspace) {
      return null
    }

    const orderedIds: string[] = []
    const visit = (elementId: string) => {
      const element = sceneTree.getElementById(elementId)
      if (!element) {
        return
      }

      const elementType = element.get('type') as string
      const isContainer = elementApis.isContainerType(elementType)

      if (isContainer) {
        const elementData = (element as { data?: Record<string, unknown> }).data
        const canReadChildren =
          elementData &&
          Object.prototype.hasOwnProperty.call(elementData, 'children')
        if (canReadChildren) {
          const children = getElementChildren(element)
          if (children.length > 0) {
            children.forEach((childId) => visit(childId))
          }
        }

        orderedIds.push(elementId)
        return
      }

      orderedIds.push(elementId)
    }

    const workspaceChildren = getElementChildren(workspace)
    if (workspaceChildren.length > 0) {
      workspaceChildren.forEach((childId) => visit(childId))
    }

    for (let i = orderedIds.length - 1; i >= 0; i -= 1) {
      const elementId = orderedIds[i]
      const element = sceneTree.getElementById(elementId)
      if (!element) {
        continue
      }

      const type = element.get('type')
      if (type === EntityTypes.WORKSPACE) {
        continue
      }

      if (elementApis.isPointInsideElement(elementId, workspacePos)) {
        return elementId
      }
    }

    return null
  },

  getElementIdAtClientPos: (clientPos: PositionData): string | null => {
    const workspacePos = elementApis.getMousePosInWorkspace(clientPos)
    if (!workspacePos) {
      return null
    }

    return elementApis.getElementIdAtWorkspacePos(workspacePos)
  },

  getElementType: (elementId: string): string | undefined => {
    return sceneTree.getElementById(elementId)?.get('type')
  },

  isElementLocked: (elementId: string): boolean => {
    const lockValue = sceneTree.getElementById(elementId)?.get('lock')
    return lockValue === true
  },

  getElementBounds: (elementId: string): ElementBounds | null => {
    const element = sceneTree.getElementById(elementId)
    if (!element) {
      return null
    }

    const computed = element.getAllComputedData() as Partial<ElementBounds>
    const { x, y, width, height } = computed

    if (
      typeof x !== 'number' ||
      typeof y !== 'number' ||
      typeof width !== 'number' ||
      typeof height !== 'number'
    ) {
      return null
    }

    return { x, y, width, height }
  },

  getElementPosition: (elementId: string): PositionData | null => {
    const bounds = elementApis.getElementBounds(elementId)
    if (!bounds) {
      return null
    }

    return {
      x: bounds.x,
      y: bounds.y
    }
  },

  isPointInsideElement: (
    elementId: string,
    point: { x: number; y: number },
    padding = 0
  ): boolean => {
    const bounds = elementApis.getElementBounds(elementId)
    if (!bounds) {
      return false
    }

    const minX = bounds.x - padding
    const minY = bounds.y - padding
    const maxX = bounds.x + bounds.width + padding
    const maxY = bounds.y + bounds.height + padding

    return (
      point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY
    )
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

  getVectorAnchorPointAtWorkspacePos: (
    elementId: string,
    workspacePos: PositionData,
    hitRadius?: number
  ): { point: VectorAnchorPoint; index: number } | null => {
    const editablePoint = elementApis.getVectorEditablePointAtWorkspacePos(
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
    const anchorPoints = elementApis.getVectorAnchorPoints(elementId)
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

    return elementApis.getVectorAnchorPointAtWorkspacePos(
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

    return elementApis.getVectorEditablePointAtWorkspacePos(
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
      elementApis.getVectorSegmentHitAtWorkspacePos(
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
      elementApis.getVectorSegmentHitAtWorkspacePos(
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

    return elementApis.getVectorSegmentHitAtWorkspacePos(
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
      elementApis.getVectorSegmentAtWorkspacePos(
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

    return elementApis.isPointNearVectorPathAtWorkspacePos(
      elementId,
      workspacePos,
      scaledHitRadius
    )
  },

  getVectorAnchorPointById: (
    elementId: string,
    pointId: string
  ): { point: VectorAnchorPoint; index: number } | null => {
    const anchorPoints = elementApis.getVectorAnchorPoints(elementId)
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
    const nextTopology = appendAnchorPointToTopology(
      topology,
      point.id,
      { x: point.x, y: point.y },
      {
        startNewSubpath: options?.startNewSubpath,
        anchorType: point.type,
        continuation: options?.continuation
      }
    )

    commitVectorTopology(elementId, nextTopology)
    return elementApis.getVectorAnchorPointById(elementId, point.id)
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
    const sourceEndpoint = getAnchorEndpointInTopology(topology, sourcePointId)
    const targetEndpoint = getAnchorEndpointInTopology(topology, targetPointId)
    if (!sourceEndpoint || !targetEndpoint) {
      return null
    }

    const connected = connectAnchorEndpointsInTopology(
      topology,
      sourceEndpoint,
      targetEndpoint
    )
    if (!connected) {
      return null
    }

    commitVectorTopology(elementId, connected.topology, {
      closed: isClosedVectorTopology(connected.topology)
    })
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

    commitVectorTopology(elementId, nextTopology)
    return true
  },

  removeVectorAnchorPoint: (elementId: string, pointId: string): boolean => {
    const topology = getVectorTopologyWorkspace(elementId)
    const nextTopology = removeAnchorPointFromTopology(topology, pointId)
    if (!nextTopology) {
      return false
    }

    commitVectorTopology(elementId, nextTopology, {
      closed: isClosedVectorTopology(nextTopology)
    })
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

    const splitResult = splitSegmentInTopology(topology, segmentId, {
      t: projectedHit.t
    })
    if (!splitResult) {
      return null
    }

    commitVectorTopology(elementId, splitResult.topology)
    return elementApis.getVectorAnchorPointById(elementId, splitResult.pointId)
  },

  setVectorClosed: (elementId: string, closed: boolean) => {
    const topology = getVectorTopologyWorkspace(elementId)
    const nextTopology = setTopologyClosed(topology, closed)
    commitVectorTopology(elementId, nextTopology, { closed })
  },

  updateVectorAnchorPointPosition: (
    elementId: string,
    pointId: string,
    position: PositionData,
    options?: EVENT_OPTIONS
  ): { point: VectorAnchorPoint; index: number } | null => {
    const topology = getVectorTopologyWorkspace(elementId)
    const nextTopology = updateAnchorPositionInTopology(
      topology,
      pointId,
      position
    )
    commitVectorTopology(elementId, nextTopology, options)
    return elementApis.getVectorAnchorPointById(elementId, pointId)
  },

  updateVectorAnchorPointType: (
    elementId: string,
    pointId: string,
    type: 'smooth' | 'sharp'
  ): { point: VectorAnchorPoint; index: number } | null => {
    const topology = getVectorTopologyWorkspace(elementId)
    const nextTopology = setAnchorTypeInTopology(topology, pointId, type)
    commitVectorTopology(elementId, nextTopology)
    return elementApis.getVectorAnchorPointById(elementId, pointId)
  },

  updateVectorAnchorPointHandlePosition: (
    elementId: string,
    pointId: string,
    target: Exclude<
      VectorPointTarget,
      typeof VECTOR_TOKENS.POINT.TARGET.ANCHOR
    >,
    position: PositionData,
    options?: EVENT_OPTIONS
  ): { point: VectorAnchorPoint; index: number } | null => {
    const topology = getVectorTopologyWorkspace(elementId)
    let nextTopology = setAnchorTypeInTopology(topology, pointId, 'smooth')
    nextTopology = setAnchorHandleInTopology(
      nextTopology,
      pointId,
      target === VECTOR_TOKENS.POINT.TARGET.IN_HANDLE
        ? VECTOR_TOKENS.CONTROL.ROLE.IN
        : VECTOR_TOKENS.CONTROL.ROLE.OUT,
      position
    )

    commitVectorTopology(elementId, nextTopology, options)
    return elementApis.getVectorAnchorPointById(elementId, pointId)
  },

  updateVectorAnchorPointHandles: (
    elementId: string,
    updates: {
      pointId: string
      target: Exclude<
        VectorPointTarget,
        typeof VECTOR_TOKENS.POINT.TARGET.ANCHOR
      >
      position: PositionData | null
      forceSmooth?: boolean
    }[]
  ) => {
    if (updates.length === 0) {
      return
    }

    let topology = getVectorTopologyWorkspace(elementId)
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

    commitVectorTopology(elementId, topology)
  },

  getMousePosInWorkspace: (clientPos: { x: number; y: number }) => {
    if (!render) {
      return null
    }

    return render.getMousePosInWorkspace({
      clientX: clientPos.x,
      clientY: clientPos.y
    })
  },

  createElement: (
    createOptions: CreateElementOptions,
    options?: EVENT_OPTIONS
  ): string | null => {
    if (createOptions.type === 'vector') {
      if (!isVectorTopology(createOptions)) {
        return null
      }

      const topology: VectorTopology = {
        points: createOptions.points,
        segments: createOptions.segments,
        networks: createOptions.networks
      }
      const bounds = calculateVectorBounds(topology)
      const normalizedTopology = normalizeVectorTopology(topology, bounds)
      const closed =
        createOptions.closed ?? isClosedVectorTopology(normalizedTopology)

      return createElementAtWorkspacePos(
        createOptions.type,
        { x: bounds.x, y: bounds.y },
        {
          width: bounds.width,
          height: bounds.height,
          points: normalizedTopology.points,
          segments: normalizedTopology.segments,
          networks: normalizedTopology.networks,
          closed,
          fill: DEFAULT_VECTOR_STYLE.fill,
          stroke: DEFAULT_VECTOR_STYLE.stroke,
          strokeWidth: DEFAULT_VECTOR_STYLE.strokeWidth
        },
        options
      )
    }

    if (!render || !createOptions.clientPosition) {
      return null
    }

    const workspacePos = render.getMousePosInWorkspace({
      clientX: createOptions.clientPosition.x,
      clientY: createOptions.clientPosition.y
    })

    return createElementAtWorkspacePos(
      createOptions.type,
      workspacePos,
      {},
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
    return elementApis.createElement(
      {
        type: 'vector',
        points: topology.points,
        segments: topology.segments,
        networks: topology.networks,
        closed: false
      },
      options
    )
  },

  deleteElement: (elementId: string, options?: EVENT_OPTIONS): boolean => {
    const element = sceneTree.getElementById(elementId)
    if (!element || element.get('type') === EntityTypes.WORKSPACE) {
      return false
    }

    const parentId = element.get('parentId') as string
    if (!parentId) {
      return false
    }

    const parent = sceneTree.getElementById(parentId) as
      | GroupInstanceTypes
      | undefined
    if (!parent) {
      return false
    }

    startTransaction()
    try {
      return sceneTree.removeElement({ id: elementId }, parent, options)
    } finally {
      endTransaction()
    }
  },

  resetElementSize: (elementId: string) => {
    elementApis.changeComputedData([elementId], {
      width: DEFAULT_ELEMENT_SIZE,
      height: DEFAULT_ELEMENT_SIZE
    })
  },

  setElementPositions: (
    positionsById: Record<string, PositionData>,
    options?: EVENT_OPTIONS
  ) => {
    const entries = Object.entries(positionsById ?? {})
    if (entries.length === 0) {
      return
    }

    startTransaction()
    try {
      entries.forEach(([elementId, position]) => {
        if (
          typeof position?.x !== 'number' ||
          typeof position?.y !== 'number'
        ) {
          return
        }

        const currentPosition = elementApis.getElementPosition(elementId)
        if (!currentPosition) {
          return
        }

        if (
          currentPosition.x === position.x &&
          currentPosition.y === position.y
        ) {
          return
        }

        core.changeComputedData(
          [elementId],
          {
            x: position.x,
            y: position.y
          },
          options
        )
      })
    } finally {
      endTransaction()
    }
  },

  hasMovedBeyondThreshold: (
    clientDragStart: { x: number; y: number },
    clientCurrentPos: { x: number; y: number },
    threshold: number
  ) => {
    if (!render) {
      return false
    }

    const dragStartWorkspace = render.getMousePosInWorkspace({
      clientX: clientDragStart.x,
      clientY: clientDragStart.y
    })
    const currentWorkspace = render.getMousePosInWorkspace({
      clientX: clientCurrentPos.x,
      clientY: clientCurrentPos.y
    })

    return (
      Math.abs(currentWorkspace.x - dragStartWorkspace.x) > threshold ||
      Math.abs(currentWorkspace.y - dragStartWorkspace.y) > threshold
    )
  },

  changeComputedData: (
    elementIds: string[],
    data: Record<string, DataTypes>,
    options?: EVENT_OPTIONS
  ) => {
    const entries = Object.entries(data ?? {})
    if (entries.length === 0) {
      return
    }

    startTransaction()
    core.changeComputedData(elementIds, data, options)
    endTransaction()
  }
}
