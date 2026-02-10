import { SceneTreeRawData } from '../sceneTree/rawDataTypes'
import { PropsComponentRawData } from '../propsManager/rawDataTypes'

/**
 * Core data structure for the entire application state.
 * Used for save/load operations with persistence providers.
 */
export interface CoreRawData {
  version: string
  sceneTree: SceneTreeRawData
  props: PropsComponentRawData
}
