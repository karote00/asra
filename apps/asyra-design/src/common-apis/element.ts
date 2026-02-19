/**
 * Element Utility APIs - common element operations
 * Used in: create-element, and future features
 */

import { startTransaction, endTransaction } from '@asyra/reactive-events'
import { DEFAULT_ELEMENT_SIZE, EntityType, DataTypes } from '@asyra/utils'
import { MOUSE_MOVEMENT_THRESHOLD } from '../constants'
import core, { render, sceneTree } from '../contexts'

interface VectorAnchorPoint {
  id: string
  x: number
  y: number
  type: 'smooth' | 'sharp'
  inHandle: { x: number; y: number } | null
  outHandle: { x: number; y: number } | null
}

interface VectorStyle {
  closed: boolean
  fill: string
  stroke: string
  strokeWidth: number
}

interface ElementBounds {
  x: number
  y: number
  width: number
  height: number
}

const DEFAULT_VECTOR_STYLE: VectorStyle = {
  closed: false,
  fill: 'none',
  stroke: '#cccccc',
  strokeWidth: 1
}
const MIN_VECTOR_SIZE = 0.1

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

const getVectorStyle = (elementId: string): VectorStyle => {
  const element = sceneTree.getElementById(elementId)
  if (!element) {
    return DEFAULT_VECTOR_STYLE
  }

  const computed = element.getAllComputedData() as Partial<VectorStyle>

  return {
    closed:
      typeof computed.closed === 'boolean'
        ? computed.closed
        : DEFAULT_VECTOR_STYLE.closed,
    fill:
      typeof computed.fill === 'string'
        ? computed.fill
        : DEFAULT_VECTOR_STYLE.fill,
    stroke:
      typeof computed.stroke === 'string'
        ? computed.stroke
        : DEFAULT_VECTOR_STYLE.stroke,
    strokeWidth:
      typeof computed.strokeWidth === 'number'
        ? computed.strokeWidth
        : DEFAULT_VECTOR_STYLE.strokeWidth
  }
}

export const elementApis = {
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

  findVectorAtPoint: (
    point: { x: number; y: number },
    padding = 0
  ): string | null => {
    let matchedVectorId: string | null = null
    let matchedArea = Number.POSITIVE_INFINITY

    for (const [elementId, element] of sceneTree.getAllElements()) {
      if (element.get('type') !== 'vector') {
        continue
      }

      if (!elementApis.isPointInsideElement(elementId, point, padding)) {
        continue
      }

      const bounds = elementApis.getElementBounds(elementId)
      if (!bounds) {
        continue
      }

      const area = bounds.width * bounds.height
      if (area <= matchedArea) {
        matchedArea = area
        matchedVectorId = elementId
      }
    }

    return matchedVectorId
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

  createVector: (anchorPoints: VectorAnchorPoint[]) => {
    const bounds = calculateVectorBounds(anchorPoints)
    const style = DEFAULT_VECTOR_STYLE
    const normalizedAnchorPoints = normalizeVectorAnchorPoints(
      anchorPoints,
      bounds
    )

    startTransaction()
    const elementId = core.createElement({
      type: 'vector',
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      anchorPoints: normalizedAnchorPoints,
      closed: style.closed,
      fill: style.fill,
      stroke: style.stroke,
      strokeWidth: style.strokeWidth
    })
    endTransaction()

    return elementId
  },

  updateVectorPath: (elementId: string, anchorPoints: VectorAnchorPoint[]) => {
    const bounds = calculateVectorBounds(anchorPoints)
    const style = getVectorStyle(elementId)
    const normalizedAnchorPoints = normalizeVectorAnchorPoints(
      anchorPoints,
      bounds
    )

    elementApis.changeComputedData([elementId], {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      anchorPoints: normalizedAnchorPoints,
      closed: style.closed,
      fill: style.fill,
      stroke: style.stroke,
      strokeWidth: style.strokeWidth
    })
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

  createElementAtClientPos: (
    position: { x: number; y: number },
    type: EntityType
  ) => {
    if (!render) {
      return null
    }

    const pos = render.getMousePosInWorkspace({
      clientX: position.x,
      clientY: position.y
    })

    startTransaction()
    const elementId = core.createElement({
      type,
      x: pos.x,
      y: pos.y
    })
    endTransaction()

    return elementId
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
