import core, { Core } from './core'
import uiContext, { UIContext, propertyRegistry } from '@asyra/ui-context'
export {
  initFeatureSystem,
  getFeatureRegistry,
  getSessionManager
} from './feature-integration'

export {
  defineComponent,
  defineComponentPropertyRelation,
  getComponentPropertyRelations,
  removeComponentPropertyRelation,
  unregisterComponent
} from './define-component'
export type {
  ComponentPropertyRelationMetadata,
  ComponentDefinition,
  UnregisterComponentOptions,
  UnregisterComponentResult,
  UnregisterComponentSkippedEntry
} from './define-component'
export {
  definePropertyChildRelation,
  definePropertyComponent,
  getPropertyChildRelations,
  removePropertyChildRelation,
  unregisterPropertyComponent
} from './define-property-component'
export type {
  PropertyChildRelationMetadata,
  PropertyComponentDefinition
} from './define-property-component'
export {
  defineFeature,
  FeatureUnregisterError,
  getFeature,
  unregisterFeature
} from '@asyra/feature-system'
export {
  registerPropertySchema,
  getPropertySchema,
  registerPropertyComponent,
  getPropertyComponent,
  unregisterPropertySchema,
  unregisterPropertyRegistration,
  PROPERTY_REGISTRATION_ERROR_CODES,
  PropertyRegistrationError,
  PROPERTY_TYPE_DEFINITION_ERROR_CODES,
  PropertyTypeDefinitionError,
  elementPropertyRegistry,
  propertySchemaRegistry,
  propertyComponentRegistry,
  BasePropertyComponent,
  getPropertyComponentAccessor
} from '@asyra/props-manager'
export type {
  PropertyComponentConstructor,
  PropertyComponentAccessor,
  PropertyChildRelationDefinition,
  PropertyRegistrationErrorCode,
  PropertyRegistrationInUseFailure,
  PropertyRegistrationScope,
  PropertyRegistrationUnregisterMissing,
  PropertyRegistrationUnregisterResult,
  PropertyRegistrationUnregisterSuccess,
  PropertyTypeDefinition,
  PropertyTypeDefinitionErrorCode,
  PropertyTypeDefinitionFailure,
  PropertyTypeFieldDefinition
} from '@asyra/props-manager'
export {
  REGISTRATION_CONTRACT_ERROR_CODES,
  RegistrationGraph,
  RegistrationRelationError
} from '@asyra/utils'
export type {
  RegistrationContractErrorCode,
  RegistrationDefinitionMetadata,
  RegistrationNodeMetadata,
  RegistrationOwnerMetadata,
  RegistrationRef,
  RegistrationRelationDeclaration,
  RegistrationRelationMetadata,
  RelationOperationSuccess,
  UnregisterRegistrationSuccess
} from '@asyra/utils'
export { BaseSelection } from '@asyra/selection'
export type { SelectionDefinition } from '@asyra/selection'
export { componentRegistry } from '@asyra/scene-tree'
export type {
  FeatureDefinition,
  FeatureAPI,
  FeatureKeyMap,
  SessionHandler
} from '@asyra/feature-system'
export { keyMap } from '@asyra/input-system'
export {
  renderStrategyRegistry,
  createOverlayLayerRegistration,
  sampleOverlayBezierPoints,
  createRenderInteractionPointTarget,
  createRenderInteractionCircleTarget,
  createRenderInteractionSegmentTarget,
  createRenderInteractionPolylineTarget,
  createRenderGradientFillStyle,
  createEvenOddFillStyle,
  isPointInsidePreparedEvenOddShape,
  prepareEvenOddShape,
  createMeshProjection,
  renderSceneTreeStore,
  renderSelectionStore,
  type OverlayCanvas,
  type OverlayStrokeStyle,
  type CreateOverlayLayerOptions,
  type CreateRenderGradientFillOptions,
  type RenderGradientColorStop,
  type RenderGradientPoint,
  type RenderFillStyle,
  type RenderInteractionTarget,
  type RenderInteractionTargetBounds,
  type RenderInteractionTargetSpace,
  type RenderInteractionHandlerRegistration,
  type RenderInteractionEventType,
  type RenderInteractionEvent,
  type EvenOddSegment,
  type EvenOddPath,
  type EvenOddShape,
  type PreparedEvenOddSegment,
  type PreparedEvenOddShape,
  type EvenOddFillOptions,
  type EvenOddFillResult,
  type GeometryPoint,
  type GeometryModel,
  type MeshProjectionPaint,
  type CreateMeshProjectionOptions,
  type MeshProjection
} from '@asyra/render'
export type {
  EngineNeutralRenderStrategy,
  RenderStrategy,
  RenderStrategyGraphic
} from '@asyra/render'
export {
  createLocalSharedDataChannel,
  registerSharedDataChannel,
  unregisterSharedDataChannel,
  hasSharedDataChannel
} from '@asyra/factory'
export {
  EventTypes,
  defineEvent,
  registerEventDefinitions,
  startTransaction,
  updateTransaction,
  endTransaction,
  rollbackTransaction,
  runTransaction,
  subscribeToSynchronousEvent,
  subscribeToFileLoadComplete,
  subscribeToEndTransaction,
  subscribeToTransactionStatusChanged,
  subscribeToSelectElements,
  subscribeToSelectVectorPoints,
  subscribeToSelectVectorSegments
} from '@asyra/reactive-events'
export type {
  EventDefinition,
  SelectElementsEvent,
  SelectVectorPointsEvent,
  SelectVectorSegmentsEvent
} from '@asyra/reactive-events'
export type {
  EndTransactionOptions,
  RunTransactionOptions,
  TransactionFailure,
  TransactionFailureKind,
  TransactionOrigin,
  TransactionOutcome,
  TransactionStatus,
  TransactionStatusPayload
} from '@asyra/utils'
export {
  defineDataChannelObserver,
  registerDataChannelObserver,
  unregisterDataChannelObserver
} from './data-channel-observer'
export type { DataChannelObserverRegistration } from './data-channel-observer'
export { uiContext, UIContext, propertyRegistry }
export {
  VECTOR_TOKENS,
  VECTOR_HANDLE_MODES,
  VECTOR_ANCHOR_ID_PREFIX,
  VECTOR_ANCHOR_ID_TYPE,
  VECTOR_TOPOLOGY_NETWORK_ID_TYPE,
  VECTOR_TOPOLOGY_SEGMENT_ID_TYPE,
  VECTOR_TOPOLOGY_POINT_ID_TYPE,
  isVectorAnchorNode,
  isVectorControlNode,
  isVectorHandleMode,
  getVectorControlId,
  getVectorPointTargetPosition,
  sortVectorItemsById,
  getVectorNetworkAnchorHandleRefs
} from './types/vector'
export type {
  VectorAnchorPoint,
  VectorAnchorPointNode,
  VectorAnchorHandleRefs,
  VectorAnchorType,
  VectorPathStyle,
  VectorHandleMode,
  VectorPointNode,
  VectorControlPointNode,
  VectorPointTarget,
  VectorEndpointSide,
  VectorControlRole,
  VectorSegment,
  VectorNetwork,
  VectorTopology,
  VectorSelectionRef,
  VectorEditingContinuation,
  SelectedVectorPointState,
  SelectedVectorSegmentState,
  HoveredVectorSegmentInsertPointState
} from './types/vector'
export type {
  RenderLayerRegistration,
  RegisterRenderLayerOptions,
  RegisterRenderLayer
} from './types/render'
export type {
  LoadDiagnosticsHook,
  LoadValidationDiagnostic,
  LoadValidationScope
} from './types/load-validation'
export {
  LOAD_HOOK_EXECUTION_ERROR_CODES,
  LoadHookExecutionError
} from './types/load-migration'
export type { LoadHookExecutionErrorCode } from './types/load-migration'
type CoreBasicApiKeys =
  | 'setRenderer'
  | 'destroyRenderer'
  | 'setRenderEngineProvider'
  | 'hasRenderEngineProvider'
  | 'isCompositionOpen'
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
  | 'updatePropertyById'
  | 'commitPropertyChanges'
  | 'initRender'
  | 'renderIsReady'
  | 'registerRenderLayer'
  | 'unregisterRenderLayer'
  | 'createRenderGradientFillStyle'
  | 'createEvenOddFillStyle'
  | 'createMeshProjection'
  | 'registerRenderInteractionTargets'
  | 'updateRenderInteractionTarget'
  | 'unregisterRenderInteractionTarget'
  | 'clearRenderInteractionTargets'
  | 'registerRenderInteractionHandler'
  | 'unregisterRenderInteractionHandler'
  | 'sceneTreeInit'
  | 'sceneTreeLoadData'
  | 'sceneTreeSaveData'
  | 'createElement'
  | 'createElementInParent'
  | 'createElementsInParent'
  | 'createElementsInParentFromCanonicalData'
  | 'createElementsInParentFromCanonicalDataUsingActiveProperties'
  | 'getElementComputedData'
  | 'moveElements'
  | 'removeSubtree'
  | 'changeComputedData'
  | 'refreshComputedDataFromProperty'
  | 'getAllElementsBounds'
  | 'isContainerType'
  | 'selectByChannel'
  | 'selectElements'
  | 'selectVectorPoints'
  | 'selectVectorSegments'
  | 'initFeatureSystem'
  | 'defineUIProperty'
  | 'registerUIProperty'
  | 'getUIProperty'
  | 'setUIProperty'
  | 'getUIPropertySubject'
  | 'onUIPropertyChange'
  | 'defineSystemProperty'
  | 'registerSystemProperty'
  | 'getSystemProperty'
  | 'setSystemProperty'
  | 'getSystemPropertyObservable'
  | 'hasSystemProperty'
  | 'unregisterSystemProperty'
  | 'registerEvent'
  | 'unregisterEvent'
  | 'subscribeEvent'
  | 'registerPropertySchema'
  | 'getPropertySchema'
  | 'getPropertyTypeDefinition'
  | 'redefinePropertyType'
  | 'definePropertyComponent'
  | 'registerPropertyComponent'
  | 'getPropertyComponent'
  | 'unregisterPropertyRegistration'
  | 'definePropertyChildRelation'
  | 'removePropertyChildRelation'
  | 'getPropertyChildRelations'
  | 'unregisterPropertyType'
  | 'defineComponent'
  | 'unregisterComponent'
  | 'defineComponentPropertyRelation'
  | 'removeComponentPropertyRelation'
  | 'getComponentPropertyRelations'
  | 'defineFeature'
  | 'getFeature'
  | 'unregisterFeature'
  | 'registerRenderStrategy'
  | 'unregisterRenderStrategy'
  | 'unregisterUIProperty'
  | 'getRegistration'
  | 'getRegistrations'
  | 'getRegistrationRelations'
  | 'defineSelection'
  | 'registerSelection'
  | 'unregisterSelection'
  | 'getSelection'
  | 'registerDataChannelObserver'
  | 'unregisterDataChannelObserver'
  | 'registerSharedDataChannel'
  | 'unregisterSharedDataChannel'
  | 'hasSharedDataChannel'
  | 'createLocalSharedDataChannel'

type CorePresetInstallApiKeys =
  | 'setRenderEngineProvider'
  | 'hasRenderEngineProvider'
  | 'isCompositionOpen'
  | 'registerEvent'
  | 'unregisterEvent'
  | 'registerRenderLayer'
  | 'unregisterRenderLayer'
  | 'createRenderGradientFillStyle'
  | 'registerDataChannelObserver'
  | 'unregisterDataChannelObserver'
  | 'registerSharedDataChannel'
  | 'unregisterSharedDataChannel'
  | 'hasSharedDataChannel'
  | 'createLocalSharedDataChannel'
  | 'registerPropertySchema'
  | 'getPropertyTypeDefinition'
  | 'redefinePropertyType'
  | 'definePropertyComponent'
  | 'unregisterPropertyRegistration'
  | 'definePropertyChildRelation'
  | 'removePropertyChildRelation'
  | 'getPropertyChildRelations'
  | 'unregisterPropertyType'
  | 'defineComponent'
  | 'unregisterComponent'
  | 'defineComponentPropertyRelation'
  | 'removeComponentPropertyRelation'
  | 'getComponentPropertyRelations'
  | 'defineFeature'
  | 'getFeature'
  | 'unregisterFeature'
  | 'registerRenderStrategy'
  | 'unregisterRenderStrategy'
  | 'unregisterUIProperty'
  | 'getRegistration'
  | 'getRegistrations'
  | 'getRegistrationRelations'
  | 'defineSelection'
  | 'unregisterSelection'
  | 'getSelection'
  | 'defineUIProperty'
  | 'defineSystemProperty'
  | 'hasSystemProperty'
  | 'unregisterSystemProperty'
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
