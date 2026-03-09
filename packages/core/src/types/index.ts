import { InputSystemAPIs, InputSystemRawAPIs } from './input-system'
import { PropertyOwnerRef, PropsAPIs } from './props'
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
  PropertyOwnerRef,
  InputSystemRawAPIs,
  InputSystemAPIs,
  PropsAPIs,
  RenderAPIs,
  SceneTreeAPIs,
  ElementSelectionActionAPIs,
  FeatureSystemAPIs,
  UIContextAPIs,
  SystemManagedPropertyAPIs
}

export type CoreAPIs = InputSystemAPIs &
  PropsAPIs &
  RenderAPIs &
  SceneTreeAPIs &
  ElementSelectionActionAPIs &
  FeatureSystemAPIs &
  UIContextAPIs &
  SystemManagedPropertyAPIs
