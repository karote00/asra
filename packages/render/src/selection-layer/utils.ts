import { Rectangle } from 'pixi.js'
import { SceneElement } from '../types'

/**
 * Calculate the world bounds that cover all given elements.
 * Used for multi-selection bounding box.
 */
export function getSelectionWorldBounds(
  elements: SceneElement[]
): Rectangle | null {
  if (elements.length === 0) return null

  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity

  for (const el of elements) {
    const bounds = el.getBounds()

    minX = Math.min(minX, bounds.x)
    minY = Math.min(minY, bounds.y)
    maxX = Math.max(maxX, bounds.x + bounds.width)
    maxY = Math.max(maxY, bounds.y + bounds.height)
  }

  return new Rectangle(minX, minY, maxX - minX, maxY - minY)
}

/**
 * Get the local bounds of a single element.
 * Used for single-selection bounding box.
 */
export const getSelectionLocalBounds = (element: SceneElement): Rectangle => {
  const bounds = element.getLocalBounds()
  return new Rectangle(bounds.x, bounds.y, bounds.width, bounds.height)
}
