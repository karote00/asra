import core, { Core } from './core'
import './components'
export {
  initFeatureSystem,
  getFeatureRegistry,
  getSessionManager
} from './feature-integration'

export { defineComponent, unregisterComponent } from './define-component'
export type { ComponentDefinition } from './define-component'
export {
  defineFeature,
  importFeature,
  unregisterFeature
} from '@asyra/feature-system'
export type {
  FeatureDefinition,
  FeatureAPI,
  SessionHandler
} from '@asyra/feature-system'
export { keyMap } from '@asyra/input-system'
export { VECTOR_ANCHOR_ID_PREFIX, VECTOR_ANCHOR_ID_TYPE } from './types/vector'
export type { VectorAnchorPoint, VectorPathStyle } from './types/vector'
export type {
  RenderLayerRegistration,
  RegisterRenderLayerOptions
} from './types/render'
export type {
  LoadDiagnosticsHook,
  LoadValidationDiagnostic,
  LoadValidationScope
} from './types/load-validation'

export { Core }
export default core
