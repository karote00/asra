import { SceneTreeRawData, CreateRectangleData, EntityTypes } from '@asra/utils'
import { SceneTreeRequestDeps, SceneTreeRequests } from '../types'

/**
 * Request API for SceneTree data
 * Provides synchronous access to scene-tree state with dependency injection
 */

export const createSceneTreeRequests = (deps: SceneTreeRequestDeps): SceneTreeRequests => ({
  sceneTreeSaveData: (): SceneTreeRawData => {
    return deps.sceneTree.save()
  },
  addRectangle: (data: CreateRectangleData, inUndoRedo: boolean): string => {
    return deps.sceneTree.addNewElement({
      ...data,
      type: EntityTypes.RECTANGLE
    },
      undefined,
      -1,
      inUndoRedo
    )
  }
})
