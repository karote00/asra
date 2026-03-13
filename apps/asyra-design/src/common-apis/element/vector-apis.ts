import type {
  VectorAnchorPoint,
  VectorEndpointSide,
  VectorPathStyle,
  VectorTopology,
  VectorPointNode
} from '@asyra/core'
import { VECTOR_TOKENS } from '@asyra/core'
import { createDefaultFills } from '@asyra/utils'
import type { DataTypes, PositionData, EVENT_OPTIONS } from '@asyra/utils'
import { startTransaction, endTransaction } from '@asyra/reactive-events'
import { isEqual } from 'lodash'
import core, { render, sceneTree } from '../../contexts'
import {
  DEFAULT_VECTOR_FILL_COLOR,
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
  buildVectorComputedPatch,
  isVectorComputedData,
  vectorGeometry,
  type VectorComputedData,
  type VectorPointUpdate
} from './vector-consistency'
import { getVectorHandleMode, setVectorHandleMode } from './handle-mode'
import { projectPointToCubicBezier } from './bezier-adapter'
import type {
  CreateElementOptions,
  VectorComputedSnapshot,
  VectorEditablePointHit,
  VectorPointTarget,
  VectorSegmentHit
} from './types'
import { changeComputedData as applyComputedDataChange } from './change-computed-data'
import { selectionApis } from '../selection'
import { systemContextApis } from '../system-context'

const DEFAULT_VECTOR_STYLE: VectorPathStyle = {
  closed: false,
  fills: createDefaultFills({
    color: DEFAULT_VECTOR_FILL_COLOR,
    visible: false
  }),
  stroke: DEFAULT_VECTOR_STROKE_COLOR,
  strokeWidth: 1
}

const VECTOR_POINT_HIT_RADIUS = 6
const VECTOR_SEGMENT_HIT_RADIUS = 8

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

const getVectorComputed = (elementId: string) => {
  const element = sceneTree.getElementById(elementId)
  if (!element) {
    return null
  }

  const computedRaw = element.getAllComputedData() as Partial<VectorComputedData>
  if (!isVectorComputedData(computedRaw)) {
    return null
  }

  return computedRaw
}

const getVectorOffset = (computed: { x?: number; y?: number }) => ({
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

const isAnchorNode = (
  point: VectorPointNode | undefined
): point is VectorPointNode & { kind: typeof VECTOR_TOKENS.POINT.KIND.ANCHOR } =>
  !!point && point.kind === VECTOR_TOKENS.POINT.KIND.ANCHOR

const isControlNode = (
  point: VectorPointNode | undefined
): point is VectorPointNode & { kind: typeof VECTOR_TOKENS.POINT.KIND.CONTROL } =>
  !!point && point.kind === VECTOR_TOKENS.POINT.KIND.CONTROL

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
  const previousTopology = getVectorTopologyWorkspace(elementId)
  const nextData: Record<string, DataTypes> = buildVectorComputedPatch(
    topologyInWorkspace,
    options
  )

  const patch = createVectorComputedPatch(elementId, nextData)
  if (Object.keys(patch).length === 0) {
    return
  }

  reconcileVectorSelectionAfterTopologyChange(
    elementId,
    previousTopology,
    topologyInWorkspace
  )
  applyComputedDataChange([elementId], patch, options)
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
    const anchorPoints = vectorApis.getVectorAnchorPoints(elementId)
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

    commitVectorTopology(elementId, nextTopology)
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
    const nextTopology = vectorGeometry.removePoint(topology, pointId)
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

    const splitResult = vectorGeometry.splitSegment(topology, segmentId, {
      t: projectedHit.t
    })
    if (!splitResult) {
      return null
    }

    commitVectorTopology(elementId, splitResult.topology)
    return vectorApis.getVectorAnchorPointById(elementId, splitResult.pointId)
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
    const nextTopology = vectorGeometry.movePoint(topology, pointId, position)
    if (!nextTopology) {
      return null
    }
    commitVectorTopology(elementId, nextTopology, options)
    return vectorApis.getVectorAnchorPointById(elementId, pointId)
  },

  updateVectorAnchorPointType: (
    elementId: string,
    pointId: string,
    type: 'smooth' | 'sharp'
  ): { point: VectorAnchorPoint; index: number } | null => {
    const topology = getVectorTopologyWorkspace(elementId)
    const nextTopology = setAnchorTypeInTopology(topology, pointId, type)
    commitVectorTopology(elementId, nextTopology)
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
    commitVectorTopology(elementId, nextTopology)
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
    options?: EVENT_OPTIONS
  ): { point: VectorAnchorPoint; index: number } | null => {
    const topology = getVectorTopologyWorkspace(elementId)
    const handleMode = getVectorHandleMode(elementId, pointId)
    const nextTopology = vectorGeometry.updateHandle(
      topology,
      pointId,
      target,
      position,
      handleMode
    )
    if (!nextTopology) {
      return null
    }

    commitVectorTopology(elementId, nextTopology, options)
    return vectorApis.getVectorAnchorPointById(elementId, pointId)
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
        points: normalizedTopology.points,
        segments: normalizedTopology.segments,
        networks: normalizedTopology.networks,
        closed,
        fills: DEFAULT_VECTOR_STYLE.fills,
        stroke: DEFAULT_VECTOR_STYLE.stroke,
        strokeWidth: DEFAULT_VECTOR_STYLE.strokeWidth
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
