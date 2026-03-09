import {
  Bounds,
  CreateElementData,
  GroupInstanceTypes,
  SceneTreeRawData,
  DataTypes,
  EVENT_OPTIONS
} from '@asyra/utils'

export interface SceneTreeRawAPIs {
  sceneTreeInit: () => void
  sceneTreeLoadData: (data: SceneTreeRawData) => void
  sceneTreeSaveData: () => SceneTreeRawData
  createElement: (
    data: CreateElementData,
    parent?: GroupInstanceTypes,
    index?: number,
    options?: EVENT_OPTIONS
  ) => string
  changeComputedData: (
    elementIds: string[],
    data: Record<string, DataTypes>,
    options?: EVENT_OPTIONS
  ) => void
  refreshComputedDataFromProperty: (
    elementId: string,
    propertyName: string,
    options?: EVENT_OPTIONS
  ) => void
  getAllElementsBounds: () => Bounds | null
  isContainerType: (type: string) => boolean
}

export type SceneTreeAPIs = SceneTreeRawAPIs
