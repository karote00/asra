import { SceneTree } from '@asra/scene-tree'
import { CreateRectangleData, SceneTreeRawData } from '@asra/utils'

/**
 * Request API for SceneTree data
 * Provides synchronous access to scene tree state
 */

export interface SceneTreeRequests {
  sceneTreeSaveData: () => SceneTreeRawData
  addRectangle: (data: CreateRectangleData, inUndoRedo: boolean) => string
}

export interface SceneTreeRequestDeps {
  sceneTree: SceneTree
}
