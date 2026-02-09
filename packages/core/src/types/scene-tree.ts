import { SceneTreeRawData } from '@asyra/utils'

export interface SceneTreeRawAPIs {
  sceneTreeInit: () => void
  sceneTreeLoadData: (data: SceneTreeRawData) => void
  sceneTreeSaveData: () => SceneTreeRawData
}

export type SceneTreeAPIs = SceneTreeRawAPIs
