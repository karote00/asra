import core, { Core } from './core'
import uiContext, { UIContext, propertyRegistry } from '@asyra/ui-context'
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
  getFeature,
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
  renderStrategyRegistry,
  createOverlayLayerRegistration,
  renderSceneTreeStore,
  renderSelectionStore,
  type OverlayCanvas,
  type OverlayStrokeStyle,
  type CreateOverlayLayerOptions
} from '@asyra/render'
export type { RenderStrategy } from '@asyra/render'
export {
  getYjsDataChannel,
  registerSharedDataChannel,
  hasSharedDataChannel
} from '@asyra/factory'
export {
  EventTypes,
  defineEvent,
  registerEventDefinitions,
  subscribeToFileLoadComplete,
  subscribeToEndTransaction
} from '@asyra/reactive-events'
export type { EventDefinition } from '@asyra/reactive-events'
export {
  defineDataChannelObserver,
  registerDataChannelObserver,
  unregisterDataChannelObserver
} from './data-channel-observer'
export type { DataChannelObserverRegistration } from './data-channel-observer'
export { uiContext, UIContext, propertyRegistry }
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
type CoreBasicApiKeys =
  | 'setRenderer'
  | 'setPersistence'
  | 'registerSaveHook'
  | 'registerLoadHook'
  | 'registerLoadDiagnosticsHook'
  | 'start'
  | 'load'
  | 'save'
  | 'getPresetDependencies'

type CoreExtensionApiKeys =
  | 'setupInputSystem'
  | 'initRender'
  | 'renderIsReady'
  | 'registerRenderLayer'
  | 'unregisterRenderLayer'
  | 'sceneTreeInit'
  | 'sceneTreeLoadData'
  | 'sceneTreeSaveData'
  | 'createElement'
  | 'changeComputedData'
  | 'getAllElementsBounds'
  | 'isContainerType'
  | 'selectElements'
  | 'selectVectorPoints'
  | 'selectVectorSegments'
  | 'initFeatureSystem'
  | 'registerUIProperty'
  | 'getUIProperty'
  | 'setUIProperty'
  | 'getUIPropertySubject'
  | 'onUIPropertyChange'
  | 'registerSystemProperty'
  | 'getSystemProperty'
  | 'setSystemProperty'
  | 'getSystemPropertyObservable'
  | 'registerEvent'
  | 'subscribeEvent'
  | 'registerPropertySchema'
  | 'getPropertySchema'
  | 'registerPropertyComponent'
  | 'getPropertyComponent'
  | 'registerSelection'
  | 'getSelection'
  | 'registerDataChannelObserver'
  | 'unregisterDataChannelObserver'

type CorePresetInstallApiKeys =
  | 'registerEvent'
  | 'registerRenderLayer'
  | 'registerDataChannelObserver'
  | 'registerPropertySchema'
  | 'registerSelection'
  | 'getSelection'
  | 'registerUIProperty'
  | 'registerSystemProperty'
  | 'getSystemPropertyObservable'
  | 'getPresetDependencies'

export type CoreBasicAPIs = Pick<Core, CoreBasicApiKeys>
export type CoreExtensionAPIs = Pick<Core, CoreExtensionApiKeys>
export type CoreConcreteAPIs = CoreBasicAPIs & CoreExtensionAPIs
export type CorePresetInstallAPIs = Pick<
  CoreConcreteAPIs,
  CorePresetInstallApiKeys
>
export type CorePresetDependencies = ReturnType<
  CorePresetInstallAPIs['getPresetDependencies']
>

export { Core }
export default core
