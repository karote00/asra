import {
  CreateElementData,
  DataTypes,
  DimensionData,
  EVENT_OPTIONS,
  PositionData,
  SceneTreeRawData
} from '@asyra/utils'

export interface SceneTreeRawAPIs {
  sceneTreeInit: () => void
  sceneTreeLoadData: (data: SceneTreeRawData) => void
  sceneTreeSaveData: () => SceneTreeRawData
}

export interface SceneTreeActionAPIs {
  changeComputedData: (key: string, data: DataTypes) => void
  resizeElement: (
    pos: PositionData,
    dimension: DimensionData,
    options?: EVENT_OPTIONS
  ) => void
}

export interface SceneTreeHandlerAPIs {
  addRectangle: (data: CreateElementData) => void
}

export type SceneTreeAPIs = SceneTreeRawAPIs &
  SceneTreeActionAPIs &
  SceneTreeHandlerAPIs
