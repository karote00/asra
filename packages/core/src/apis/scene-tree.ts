import { sceneTreeInit, sceneTreeLoadData } from '@asyra/reactive-events'
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
    },
    sceneTreeLoadData(data: SceneTreeRawData) {
      sceneTreeLoadData(data)
    },
    sceneTreeSaveData() {
      return sceneTreeRequests.sceneTreeSaveData()
    }
  }
}
