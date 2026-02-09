import {
  sceneTreeLoadComplete,
  sceneTreeInit,
  sceneTreeLoadData
} from '@asyra/reactive-events'
import { SceneTreeRawData } from '@asyra/utils'
import { SceneTreeAPIs } from '../types'

export interface SceneTreeRequests {
  sceneTreeSaveData: () => SceneTreeRawData
}

export const createSceneTreeAPIs = (
  sceneTreeRequests: SceneTreeRequests
): SceneTreeAPIs => {
  return {
    sceneTreeInit() {
      sceneTreeInit()
      sceneTreeLoadComplete()
    },
    sceneTreeLoadData(data: SceneTreeRawData) {
      sceneTreeLoadData(data)
      sceneTreeLoadComplete()
    },
    sceneTreeSaveData() {
      return sceneTreeRequests.sceneTreeSaveData()
    }
  }
}
