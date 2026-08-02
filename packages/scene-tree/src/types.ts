import type { ElementInstanceTypes } from '@asyra/utils'

/**
 * Interface for scene tree registry methods
 *
 * This interface abstracts the sceneTree registry operations
 * used by components like Workspace to maintain clean dependency injection.
 */
export interface ISceneTreeRegistry {
  /**
   * Get element by ID from the global registry
   */
  getElementById(elementId: string): ElementInstanceTypes | undefined

  /**
   * Add element to the global registry
   */
  addToMap(element: ElementInstanceTypes): void

  /**
   * Atomically assign one canonical parent and register an ordered element batch.
   */
  addManyToMap(
    elements: readonly ElementInstanceTypes[],
    parentId: string
  ): void

  /**
   * Remove element from the global registry
   */
  removeFromMap(element: ElementInstanceTypes): void
}
