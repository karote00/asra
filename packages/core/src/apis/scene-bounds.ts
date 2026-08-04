import type { SceneTree } from '@asyra/scene-tree'
import {
  EntityTypes,
  type Bounds,
  type ComputedAttrs,
  type ElementInstanceTypes
} from '@asyra/utils'

interface ElementGeometry {
  x: number
  y: number
  width: number
  height: number
}

const getFiniteGeometry = (
  element: ElementInstanceTypes
): ElementGeometry | null => {
  const x = element.computed.get('x') as ComputedAttrs['x']
  const y = element.computed.get('y') as ComputedAttrs['y']
  const width = element.computed.get('width') as ComputedAttrs['width']
  const height = element.computed.get('height') as ComputedAttrs['height']
  if (
    typeof x !== 'number' ||
    !Number.isFinite(x) ||
    typeof y !== 'number' ||
    !Number.isFinite(y) ||
    typeof width !== 'number' ||
    !Number.isFinite(width) ||
    typeof height !== 'number' ||
    !Number.isFinite(height)
  ) {
    return null
  }

  return { x, y, width, height }
}

const getFinitePosition = (
  element: ElementInstanceTypes
): Pick<ElementGeometry, 'x' | 'y'> | null => {
  const x = element.computed.get('x') as ComputedAttrs['x']
  const y = element.computed.get('y') as ComputedAttrs['y']
  if (
    typeof x !== 'number' ||
    !Number.isFinite(x) ||
    typeof y !== 'number' ||
    !Number.isFinite(y)
  ) {
    return null
  }
  return { x, y }
}

const getWorldPosition = (
  element: ElementInstanceTypes,
  geometry: ElementGeometry,
  elements: ReturnType<SceneTree['getAllElements']>,
  workspaceId: string
): { x: number; y: number } | null => {
  const elementId = element.get('id')
  if (typeof elementId !== 'string') {
    return null
  }

  let x = geometry.x
  let y = geometry.y
  let parentId = element.get('parentId')
  const visitedIds = new Set([elementId])

  while (parentId !== workspaceId) {
    if (
      typeof parentId !== 'string' ||
      parentId.length === 0 ||
      visitedIds.has(parentId)
    ) {
      return null
    }

    visitedIds.add(parentId)
    const parent = elements.get(parentId)
    if (!parent || parent.get('type') === EntityTypes.WORKSPACE) {
      return null
    }

    const parentPosition = getFinitePosition(parent)
    if (!parentPosition) {
      return null
    }

    x += parentPosition.x
    y += parentPosition.y
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return null
    }

    parentId = parent.get('parentId')
  }

  return { x, y }
}

export const getAllElementsWorldBounds = (
  sceneTree: SceneTree
): Bounds | null => {
  const elements = sceneTree.getAllElements()
  const workspaceId = sceneTree.workspace
  const workspace = elements.get(workspaceId)
  if (
    !workspace ||
    workspace.get('type') !== EntityTypes.WORKSPACE ||
    workspace.get('parentId') !== ''
  ) {
    return null
  }

  const bounds: Bounds = {
    minX: Infinity,
    minY: Infinity,
    maxX: -Infinity,
    maxY: -Infinity
  }
  let hasElement = false

  for (const [elementId, element] of elements) {
    if (element.get('id') !== elementId) {
      return null
    }

    if (element.get('type') === EntityTypes.WORKSPACE) {
      if (elementId !== workspaceId) {
        return null
      }
      continue
    }

    if (element.get('type') === EntityTypes.GROUP) {
      continue
    }

    const geometry = getFiniteGeometry(element)
    const worldPosition = geometry
      ? getWorldPosition(element, geometry, elements, workspaceId)
      : null
    if (!geometry || !worldPosition) {
      return null
    }

    const oppositeX = worldPosition.x + geometry.width
    const oppositeY = worldPosition.y + geometry.height
    if (!Number.isFinite(oppositeX) || !Number.isFinite(oppositeY)) {
      return null
    }

    bounds.minX = Math.min(bounds.minX, worldPosition.x, oppositeX)
    bounds.minY = Math.min(bounds.minY, worldPosition.y, oppositeY)
    bounds.maxX = Math.max(bounds.maxX, worldPosition.x, oppositeX)
    bounds.maxY = Math.max(bounds.maxY, worldPosition.y, oppositeY)
    hasElement = true
  }

  return hasElement ? bounds : null
}
