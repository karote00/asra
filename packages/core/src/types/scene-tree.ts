import { CreateRectangleData, DataTypes, SceneTreeRawData } from '@asra/utils'

export interface SceneTreeRawAPIs {
  initSceneTree: () => void
  loadSceneTree: (data: SceneTreeRawData) => void
  saveSceneTree: () => SceneTreeRawData
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
