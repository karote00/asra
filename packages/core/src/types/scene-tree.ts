import {
  CreateRectangleData,
  DataTypes,
  DimensionData,
  EVNET_OPTIONS,
  PositionData,
  SceneTreeRawData
} from '@asra/utils'

export interface SceneTreeRawAPIs {
  sceneTreeInit: () => void
  sceneTreeLoadData: (data: SceneTreeRawData) => void
  sceneTreeSaveData: () => Promise<SceneTreeRawData>
}

export interface SceneTreeActionAPIs {
  changeComputedData: (key: string, data: DataTypes) => void
  resizeElement: (pos: PositionData, dimension: DimensionData, options?: EVNET_OPTIONS) => void
}

export interface SceneTreeHandlerAPIs {
  addRectangle: (data: CreateRectangleData) => void
}

export type SceneTreeAPIs = SceneTreeRawAPIs &
  SceneTreeActionAPIs &
  SceneTreeHandlerAPIs
