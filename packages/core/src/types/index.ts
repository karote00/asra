import { InputSystemAPIs, InputSystemRawAPIs } from './input-system'
import { PropertyOwnerRef, PropsAPIs } from './props'
import { RenderAPIs } from './render'
import {
  SceneTreeAPIs,
  type CanonicalElementBatchResult,
  type CanonicalElementBatchTimingArtifact
} from './scene-tree'
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
  LOAD_HOOK_EXECUTION_ERROR_CODES,
  LoadHookExecutionError
} from './load-migration'
export type { LoadHookExecutionErrorCode } from './load-migration'

export {
  PropertyOwnerRef,
  InputSystemRawAPIs,
  InputSystemAPIs,
  PropsAPIs,
  RenderAPIs,
  SceneTreeAPIs,
  CanonicalElementBatchResult,
  CanonicalElementBatchTimingArtifact,
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
