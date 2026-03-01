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
  type EVENT_OPTIONS
} from '@asyra/utils'
import type { VectorAnchorPoint, VectorPathStyle } from '@asyra/core'
import { isEqual } from 'lodash'
import { MOUSE_MOVEMENT_THRESHOLD } from '../../constants'
import core, { render, sceneTree } from '../../contexts'
import {
  calculateVectorBounds,
  normalizeVectorAnchorPoints,
  toWorkspaceAnchorPoint
} from './vector-geometry'
import type {
  CreateElementOptions,
  ElementBounds,
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
    const element = sceneTree.getElementById(elementId)
    if (!element) {
      return []
    }

    const computed = element.getAllComputedData() as {
      x?: number
      y?: number
      width?: number
      height?: number
      anchorPoints?: VectorAnchorPoint[]
    }

    if (!Array.isArray(computed.anchorPoints)) {
      return []
    }

    return computed.anchorPoints.map((point) =>
      toWorkspaceAnchorPoint(point, computed)
    )
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
    if (!editablePoint || editablePoint.target !== 'anchor') {
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
      checkTarget(point, index, 'inHandle', point.inHandle)
      checkTarget(point, index, 'outHandle', point.outHandle)
      checkTarget(point, index, 'anchor', { x: point.x, y: point.y })
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

  updateVectorGeometry: (
    elementId: string,
    anchorPoints: VectorAnchorPoint[]
  ) => {
    const bounds = calculateVectorBounds(anchorPoints)
    const normalizedAnchorPoints = normalizeVectorAnchorPoints(
      anchorPoints,
      bounds
    )
    const nextData: Record<string, DataTypes> = {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      anchorPoints: normalizedAnchorPoints
    }

    const patch = createVectorComputedPatch(elementId, nextData)
    if (Object.keys(patch).length === 0) {
      return
    }

    elementApis.changeComputedData([elementId], patch)
  },

  appendVectorAnchorPoint: (
    elementId: string,
    point: VectorAnchorPoint
  ): { point: VectorAnchorPoint; index: number } | null => {
    const currentAnchorPoints = elementApis.getVectorAnchorPoints(elementId)
    const nextAnchorPoints = [...currentAnchorPoints, point]
    elementApis.updateVectorGeometry(elementId, nextAnchorPoints)

    return elementApis.getVectorAnchorPointById(elementId, point.id)
  },

  setVectorClosed: (elementId: string, closed: boolean) => {
    const patch = createVectorComputedPatch(elementId, { closed })
    if (Object.keys(patch).length === 0) {
      return
    }

    elementApis.changeComputedData([elementId], patch)
  },

  updateVectorAnchorPointPosition: (
    elementId: string,
    pointId: string,
    position: PositionData
  ): { point: VectorAnchorPoint; index: number } | null => {
    const anchorPoints = elementApis.getVectorAnchorPoints(elementId)
    const index = anchorPoints.findIndex((point) => point.id === pointId)
    if (index === -1) {
      return null
    }

    const nextAnchorPoints = anchorPoints.map((point, pointIndex) => {
      if (pointIndex !== index) {
        return point
      }

      return {
        ...point,
        x: position.x,
        y: position.y
      }
    })

    elementApis.updateVectorGeometry(elementId, nextAnchorPoints)
    return elementApis.getVectorAnchorPointById(elementId, pointId)
  },

  updateVectorAnchorPointType: (
    elementId: string,
    pointId: string,
    type: 'smooth' | 'sharp'
  ): { point: VectorAnchorPoint; index: number } | null => {
    const anchorPoints = elementApis.getVectorAnchorPoints(elementId)
    const index = anchorPoints.findIndex((point) => point.id === pointId)
    if (index === -1) {
      return null
    }

    const nextAnchorPoints = anchorPoints.map((point, pointIndex) => {
      if (pointIndex !== index) {
        return point
      }

      if (type === 'sharp') {
        return {
          ...point,
          type,
          inHandle: null,
          outHandle: null
        }
      }

      return {
        ...point,
        type
      }
    })

    elementApis.updateVectorGeometry(elementId, nextAnchorPoints)
    return elementApis.getVectorAnchorPointById(elementId, pointId)
  },

  updateVectorAnchorPointHandlePosition: (
    elementId: string,
    pointId: string,
    target: Exclude<VectorPointTarget, 'anchor'>,
    position: PositionData
  ): { point: VectorAnchorPoint; index: number } | null => {
    const anchorPoints = elementApis.getVectorAnchorPoints(elementId)
    const index = anchorPoints.findIndex((point) => point.id === pointId)
    if (index === -1) {
      return null
    }

    const nextAnchorPoints = anchorPoints.map((point, pointIndex) => {
      if (pointIndex !== index) {
        return point
      }

      return {
        ...point,
        type: 'smooth',
        inHandle:
          target === 'inHandle'
            ? { x: position.x, y: position.y }
            : point.inHandle,
        outHandle:
          target === 'outHandle'
            ? { x: position.x, y: position.y }
            : point.outHandle
      }
    })

    elementApis.updateVectorGeometry(elementId, nextAnchorPoints)
    return elementApis.getVectorAnchorPointById(elementId, pointId)
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
    if (Array.isArray(createOptions.anchorPoints)) {
      const bounds = calculateVectorBounds(createOptions.anchorPoints)
      const normalizedAnchorPoints = normalizeVectorAnchorPoints(
        createOptions.anchorPoints,
        bounds
      )
      const workspacePos: PositionData = {
        x: bounds.x,
        y: bounds.y
      }

      return createElementAtWorkspacePos(
        createOptions.type,
        workspacePos,
        {
          width: bounds.width,
          height: bounds.height,
          anchorPoints: normalizedAnchorPoints,
          closed: DEFAULT_VECTOR_STYLE.closed,
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

  resetElementSize: (elementId: string) => {
    elementApis.changeComputedData([elementId], {
      width: DEFAULT_ELEMENT_SIZE,
      height: DEFAULT_ELEMENT_SIZE
    })
  },

  hasMovedBeyondThreshold: (
    clientDragStart: { x: number; y: number },
    clientCurrentPos: { x: number; y: number },
    threshold = MOUSE_MOVEMENT_THRESHOLD
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
