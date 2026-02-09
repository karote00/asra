import { InputSystemAPIs, InputSystemRawAPIs } from './input-system'
import { RenderAPIs } from './render'
import { SceneTreeAPIs } from './scene-tree'
import { ElementSelectionActionAPIs } from './element-selection'
import { FeatureSystemAPIs } from './feature-system'

export { HandlerDeps } from './deps'

export {
  InputSystemRawAPIs,
  InputSystemAPIs,
  RenderAPIs,
  SceneTreeAPIs,
  ElementSelectionActionAPIs,
  FeatureSystemAPIs
}

export type CoreAPIs = InputSystemAPIs &
  RenderAPIs &
  SceneTreeAPIs &
  ElementSelectionActionAPIs &
  FeatureSystemAPIs
