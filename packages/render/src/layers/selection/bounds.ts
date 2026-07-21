import {
  getElementGeometryLocalBounds,
  getElementGeometryWorldBounds
} from '@asyra/utils'
import { SceneElement } from '../../types'
import type { RenderBounds } from '../../types/render-object'

/**
 * Calculate the world bounds that cover all given elements.
 * Used for multi-selection bounding box.
 */
export function getSelectionWorldBounds(
  elements: SceneElement[]
): RenderBounds | null {
  if (elements.length === 0) return null

  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity

  for (const el of elements) {
    const bounds = getElementGeometryWorldBounds(el)

    minX = Math.min(minX, bounds.x)
    minY = Math.min(minY, bounds.y)
    maxX = Math.max(maxX, bounds.x + bounds.width)
    maxY = Math.max(maxY, bounds.y + bounds.height)
  }

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

/**
 * Get the local bounds of a single element.
 * Used for single-selection bounding box.
 */
export const getSelectionLocalBounds = (
  element: SceneElement
): RenderBounds => {
  const bounds = getElementGeometryLocalBounds(element)
  return {
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height
  }
}
