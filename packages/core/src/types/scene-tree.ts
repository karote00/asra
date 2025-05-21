import { CreateRectangleData, DataTypes, SceneTreeRawData } from '@asra/utils'

export interface SceneTreeRawAPIs {
  sceneTreeInit: () => void
  sceneTreeLoadData: (data: SceneTreeRawData) => void
  sceneTreeSaveData: () => Promise<SceneTreeRawData>
}

export interface SceneTreeActionAPIs {
  changeComputedData: (key: string, data: DataTypes) => void
}

export interface SceneTreeHandlerAPIs {
  addRectangle: (data: CreateRectangleData) => void
}

export type SceneTreeAPIs = SceneTreeRawAPIs &
  SceneTreeActionAPIs &
  SceneTreeHandlerAPIs
