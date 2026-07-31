import { InputSystemAPIs, InputSystemRawAPIs } from './input-system'
import { PropsAPIs } from './props'
import { RenderAPIs } from './render'
import { SceneTreeAPIs } from './scene-tree'
import { ElementSelectionActionAPIs } from './element-selection'
import { FeatureSystemAPIs } from './feature-system'
import { UIContextAPIs } from './ui-context'
import { SystemManagedPropertyAPIs } from './system-properties'
import { ElementPropertyAPIs } from './element-properties'
import type { CanonicalChangeAPIs } from './canonical-changes'

export { HandlerDeps } from './deps'
export type {
  LoadDiagnosticsHook,
  LoadValidationDiagnostic,
  LoadValidationScope
} from './load-validation'
export {
  LOAD_HOOK_EXECUTION_ERROR_CODES,
  LoadHookExecutionError
} from './load-migration'
export type { LoadHookExecutionErrorCode } from './load-migration'

export {
  InputSystemRawAPIs,
  InputSystemAPIs,
  PropsAPIs,
  RenderAPIs,
  SceneTreeAPIs,
  ElementSelectionActionAPIs,
  FeatureSystemAPIs,
  UIContextAPIs,
  SystemManagedPropertyAPIs,
  ElementPropertyAPIs
}
export type { PropertyComponentValuesUpdate } from './props'
export type { CanonicalChange, CanonicalChangeAPIs } from './canonical-changes'

export type CoreAPIs = InputSystemAPIs &
  PropsAPIs &
  RenderAPIs &
  SceneTreeAPIs &
  ElementSelectionActionAPIs &
  FeatureSystemAPIs &
  UIContextAPIs &
  SystemManagedPropertyAPIs &
  ElementPropertyAPIs &
  CanonicalChangeAPIs
