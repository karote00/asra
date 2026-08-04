import { InputSystemAPIs, InputSystemRawAPIs } from './input-system.js'
import { PropsAPIs } from './props.js'
import { RenderAPIs } from './render.js'
import { SceneTreeAPIs } from './scene-tree.js'
import { ElementSelectionActionAPIs } from './element-selection.js'
import { FeatureSystemAPIs } from './feature-system.js'
import { UIContextAPIs } from './ui-context.js'
import { SystemManagedPropertyAPIs } from './system-properties.js'
import { ElementPropertyAPIs } from './element-properties.js'
import type { CanonicalChangeAPIs } from './canonical-changes.js'

export { HandlerDeps } from './deps.js'
export type {
  LoadDiagnosticsHook,
  LoadValidationDiagnostic,
  LoadValidationScope
} from './load-validation.js'
export {
  LOAD_HOOK_EXECUTION_ERROR_CODES,
  LoadHookExecutionError
} from './load-migration.js'
export type { LoadHookExecutionErrorCode } from './load-migration.js'

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
export type { PropertyComponentValuesUpdate } from './props.js'
export type {
  CanonicalChange,
  CanonicalChangeAPIs
} from './canonical-changes.js'

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
