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
  type PositionData
} from '@asyra/utils'
import type { VectorAnchorPoint, VectorPathStyle } from '@asyra/core'
import { isEqual } from 'lodash'
import { MOUSE_MOVEMENT_THRESHOLD } from '../constants'
import core, { render, sceneTree } from '../contexts'

interface ElementBounds {
  x: number
  y: number
  width: number
  height: number
}

interface VectorComputedSnapshot extends Partial<VectorPathStyle> {
  x?: number
  y?: number
  width?: number
  height?: number
  anchorPoints?: VectorAnchorPoint[]
}

interface CreateElementOptions {
  type: EntityType
  clientPosition?: PositionData
  anchorPoints?: VectorAnchorPoint[]
}

const DEFAULT_VECTOR_STYLE: VectorPathStyle = {
  closed: false,
  fill: 'none',
  stroke: '#cccccc',
  strokeWidth: 1
}
const MIN_VECTOR_SIZE = 0.1
const VECTOR_POINT_HIT_RADIUS = 6

const calculateVectorBounds = (anchorPoints: VectorAnchorPoint[]) => {
  if (anchorPoints.length === 0) {
    return { x: 0, y: 0, width: MIN_VECTOR_SIZE, height: MIN_VECTOR_SIZE }
  }

  const xs = anchorPoints.map((point) => point.x)
  const ys = anchorPoints.map((point) => point.y)

  const minX = Math.min(...xs)
  const minY = Math.min(...ys)
  const maxX = Math.max(...xs)
  const maxY = Math.max(...ys)

  return {
    x: minX,
    y: minY,
    width: maxX - minX || MIN_VECTOR_SIZE,
    height: maxY - minY || MIN_VECTOR_SIZE
  }
}

const normalizeVectorAnchorPoints = (
  anchorPoints: VectorAnchorPoint[],
  bounds: { x: number; y: number }
): VectorAnchorPoint[] =>
  anchorPoints.map((point) => ({
    ...point,
    x: point.x - bounds.x,
    y: point.y - bounds.y
  }))

const toWorkspaceAnchorPoint = (
  point: VectorAnchorPoint,
  computed: { x?: number; y?: number; width?: number; height?: number }
): VectorAnchorPoint => {
  const offsetX = typeof computed.x === 'number' ? computed.x : 0
  const offsetY = typeof computed.y === 'number' ? computed.y : 0
  const width = typeof computed.width === 'number' ? computed.width : 0
  const height = typeof computed.height === 'number' ? computed.height : 0

  const isLikelyLocal =
    point.x >= -1 &&
    point.x <= width + 1 &&
    point.y >= -1 &&
    point.y <= height + 1

  if (!isLikelyLocal) {
    return { ...point }
  }

  return {
    ...point,
    x: point.x + offsetX,
    y: point.y + offsetY
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
  extraData: Record<string, DataTypes> = {}
): string => {
  startTransaction()
  const elementId = core.createElement({
    type,
    x: workspacePos.x,
    y: workspacePos.y,
    ...extraData
  })
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
    const anchorPoints = elementApis.getVectorAnchorPoints(elementId)
    if (anchorPoints.length === 0) {
      return null
    }

    const radius = hitRadius ?? VECTOR_POINT_HIT_RADIUS
    const radiusSquared = radius * radius

    let closestIndex = -1
    let closestDist = Number.POSITIVE_INFINITY

    anchorPoints.forEach((point, index) => {
      const dx = point.x - workspacePos.x
      const dy = point.y - workspacePos.y
      const dist = dx * dx + dy * dy
      if (dist <= radiusSquared && dist < closestDist) {
        closestDist = dist
        closestIndex = index
      }
    })

    if (closestIndex === -1) {
      return null
    }

    return { point: anchorPoints[closestIndex], index: closestIndex }
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

  getMousePosInWorkspace: (clientPos: { x: number; y: number }) => {
    if (!render) {
      return null
    }

    return render.getMousePosInWorkspace({
      clientX: clientPos.x,
      clientY: clientPos.y
    })
  },

  createElement: (options: CreateElementOptions): string | null => {
    if (Array.isArray(options.anchorPoints)) {
      const bounds = calculateVectorBounds(options.anchorPoints)
      const normalizedAnchorPoints = normalizeVectorAnchorPoints(
        options.anchorPoints,
        bounds
      )
      const workspacePos: PositionData = {
        x: bounds.x,
        y: bounds.y
      }

      return createElementAtWorkspacePos(options.type, workspacePos, {
        width: bounds.width,
        height: bounds.height,
        anchorPoints: normalizedAnchorPoints,
        closed: DEFAULT_VECTOR_STYLE.closed,
        fill: DEFAULT_VECTOR_STYLE.fill,
        stroke: DEFAULT_VECTOR_STYLE.stroke,
        strokeWidth: DEFAULT_VECTOR_STYLE.strokeWidth
      })
    }

    if (!render || !options.clientPosition) {
      return null
    }

    const workspacePos = render.getMousePosInWorkspace({
      clientX: options.clientPosition.x,
      clientY: options.clientPosition.y
    })

    return createElementAtWorkspacePos(options.type, workspacePos)
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
    data: Record<string, DataTypes>
  ) => {
    const entries = Object.entries(data ?? {})
    if (entries.length === 0) {
      return
    }

    startTransaction()
    core.changeComputedData(elementIds, data)
    endTransaction()
  }
}
