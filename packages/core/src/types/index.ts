import { InputSystemAPIs, InputSystemRawAPIs } from './input-system'
import { RenderAPIs } from './render'
import { SceneTreeAPIs } from './scene-tree'
import { ElementSelectionActionAPIs } from './element-selection'
import { FeatureSystemAPIs } from './feature-system'
import { UIContextAPIs } from './ui-context'
import { SystemManagedPropertyAPIs } from './system-properties'

export { HandlerDeps } from './deps'
export type {
  LoadDiagnosticsHook,
  LoadValidationDiagnostic,
  LoadValidationScope
} from './load-validation'

export {
  InputSystemRawAPIs,
  InputSystemAPIs,
  RenderAPIs,
  SceneTreeAPIs,
  ElementSelectionActionAPIs,
  FeatureSystemAPIs,
  UIContextAPIs,
  SystemManagedPropertyAPIs
}

export type CoreAPIs = InputSystemAPIs &
  RenderAPIs &
  SceneTreeAPIs &
  ElementSelectionActionAPIs &
  FeatureSystemAPIs &
  UIContextAPIs &
  SystemManagedPropertyAPIs
