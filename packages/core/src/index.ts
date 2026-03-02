import core, { Core } from './core'
export {
  initFeatureSystem,
  getFeatureRegistry,
  getSessionManager
} from './feature-integration'

export { defineComponent, unregisterComponent } from './define-component'
export type {
  ComponentDefinition,
  UnregisterComponentOptions,
  UnregisterComponentResult,
  UnregisterComponentSkippedEntry
} from './define-component'
export {
  definePropertyComponent,
  unregisterPropertyComponent
} from './define-property-component'
export type { PropertyComponentDefinition } from './define-property-component'
export {
  defineFeature,
  importFeature,
  unregisterFeature
} from '@asyra/feature-system'
export {
  registerPropertySchema,
  getPropertySchema,
  registerPropertyComponent,
  getPropertyComponent,
  elementPropertyRegistry,
  propertySchemaRegistry,
  propertyComponentRegistry,
  BasePropertyComponent,
  getPropertyComponentAccessor
} from '@asyra/props-manager'
export type {
  PropertyComponentConstructor,
  PropertyComponentAccessor
} from '@asyra/props-manager'
export {
  ElementSelection,
  VectorPointSelection,
  VectorSegmentSelection
} from '@asyra/selection'
export { componentRegistry } from '@asyra/scene-tree'
export type {
  FeatureDefinition,
  FeatureAPI,
  SessionHandler
} from '@asyra/feature-system'
export { keyMap } from '@asyra/input-system'
export {
  renderRegistry,
  createOverlayLayerRegistration,
  type OverlayCanvas,
  type OverlayStrokeStyle,
  type CreateOverlayLayerOptions
} from '@asyra/render'
export type { RenderStrategy } from '@asyra/render'
export {
  VECTOR_TOKENS,
  VECTOR_ANCHOR_ID_PREFIX,
  VECTOR_ANCHOR_ID_TYPE,
  VECTOR_TOPOLOGY_NETWORK_ID_TYPE,
  VECTOR_TOPOLOGY_SEGMENT_ID_TYPE,
  VECTOR_TOPOLOGY_POINT_ID_TYPE
} from './types/vector'
export type {
  VectorAnchorPoint,
  VectorAnchorType,
  VectorPathStyle,
  VectorPointNode,
  VectorPointTarget,
  VectorEndpointSide,
  VectorControlRole,
  VectorSegment,
  VectorNetwork,
  VectorTopology
} from './types/vector'
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
