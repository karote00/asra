import { SceneTreeRawData } from '../sceneTree/rawDataTypes.js'
import { PropsComponentRawData } from '../propsManager/rawDataTypes.js'

/**
 * Core data structure for the entire application state.
 * Used for save/load operations with persistence providers.
 */
export interface CoreRawData {
  version: string
  sceneTree: SceneTreeRawData
  props: PropsComponentRawData
  systemContext?: Record<string, unknown>
}
