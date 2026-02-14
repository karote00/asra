import {
  Bounds,
  CreateElementData,
  GroupInstanceTypes,
  SceneTreeRawData,
  DataTypes
} from '@asyra/utils'

export interface SceneTreeRawAPIs {
  sceneTreeInit: () => void
  sceneTreeLoadData: (data: SceneTreeRawData) => void
  sceneTreeSaveData: () => SceneTreeRawData
  createElement: (
    data: CreateElementData,
    parent?: GroupInstanceTypes,
    index?: number
  ) => string
  changeComputedData: (
    elementIds: string[],
    data: Record<string, DataTypes>
  ) => void
  getAllElementsBounds: () => Bounds | null
}

export type SceneTreeAPIs = SceneTreeRawAPIs
