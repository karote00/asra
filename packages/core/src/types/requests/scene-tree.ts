import { SceneTree } from '@asyra/scene-tree'
import { CreateElementData, SceneTreeRawData } from '@asyra/utils'

/**
 * Request API for SceneTree data
 * Provides synchronous access to scene tree state
 */

export interface SceneTreeRequests {
  sceneTreeSaveData: () => SceneTreeRawData
  addRectangle: (data: CreateElementData, inUndoRedo: boolean) => string
}

export interface SceneTreeRequestDeps {
  sceneTree: SceneTree
}
