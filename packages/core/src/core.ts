import type {
  SceneTreeRawData,
  CoreRawData,
  PropertySchema,
  TransactionStatusPayload
} from '@asyra/utils'
import { isRecord } from '@asyra/utils'
import factory, { Factory } from '@asyra/factory'
import inputSystem, { InputSystem } from '@asyra/input-system'
import sceneTree, { componentRegistry, SceneTree } from '@asyra/scene-tree'
import props, {
  PropsManager,
  getPropertyComponent,
  getPropertySchema,
  registerPropertySchema,
  registerPropertyComponent,
  unregisterPropertyRegistration
} from '@asyra/props-manager'
import type { PropertyRegistrationScope } from '@asyra/props-manager'
import {
  defineFeature as defineFeatureRuntime,
  getFeature as getFeatureRuntime,
  unregisterFeature as unregisterFeatureRuntime,
  getFeatureRegistry,
  type FeatureAPI,
  type FeatureDefinition,
  type FeatureKeyMap
} from '@asyra/feature-system'
import selection, { SelectionManager } from '@asyra/selection'
import systemContext, { SystemContext } from '@asyra/system-context'
import type { FeatureSystemAPIs } from './types/feature-system'
import render, {
  Render,
  IRenderer,
  RenderOptions,
  renderStrategyRegistry,
  type RenderStrategy
} from '@asyra/render'
import { propertyRegistry } from '@asyra/ui-context'
import { IPersistenceProvider, SaveHook, LoadHook } from '@asyra/persistence'
import {
  type EventDefinition,
  eventRegistry,
  fileLoadComplete
} from '@asyra/reactive-events'

import {
  CoreAPIs,
  ElementSelectionActionAPIs,
  InputSystemAPIs,
  RenderAPIs,
  SceneTreeAPIs,
  UIContextAPIs,
  SystemManagedPropertyAPIs
} from './types'
import { createAPIs } from './apis'
import type {
  LoadDiagnosticsHook,
  LoadValidationDiagnostic
} from './types/load-validation'
import type { DataChannelObserverRegistration } from './data-channel-observer'
import * as dataChannelObserver from './data-channel-observer'
import {
  definePropertyComponent as definePropertyComponentRuntime,
  definePropertyChildRelation as definePropertyChildRelationRuntime,
  getPropertyChildRelations as getPropertyChildRelationsRuntime,
  removePropertyChildRelation as removePropertyChildRelationRuntime,
  type PropertyChildRelationMetadata,
  type PropertyComponentDefinition
} from './define-property-component'
import type { PropertyChildRelationDefinition } from '@asyra/props-manager'
import {
  defineComponent as defineComponentRuntime,
  defineComponentPropertyRelationForSceneTree as defineComponentPropertyRelationRuntime,
  getComponentPropertyRelations as getComponentPropertyRelationsRuntime,
  removeComponentPropertyRelationForSceneTree as removeComponentPropertyRelationRuntime,
  unregisterComponent as unregisterComponentRuntime,
  unregisterComponentGraphRegistration,
  type ComponentDefinition,
  type ComponentPropertyRelationMetadata,
  type UnregisterComponentOptions,
  type UnregisterComponentResult
} from './define-component'
import {
  RegistrationGraph,
  RegistrationRelationError,
  type RegistrationGraphOperation,
  type RegistrationDefinitionMetadata,
  type RegistrationNodeMetadata,
  type RegistrationRef,
  type RegistrationRelationMetadata,
  type RelationOperationSuccess,
  type UnregisterRegistrationSuccess
} from '@asyra/utils'

interface CoreDeps {
  inputSystem: InputSystem
  factory: Factory
  props: PropsManager
  render: Render
  sceneTree: SceneTree
  selection: SelectionManager
  systemContext: SystemContext
}

type PendingPersistence =
  | {
      kind: 'skipped'
      transaction: TransactionStatusPayload
    }
  | {
      kind: 'save'
      transaction: TransactionStatusPayload
      provider: IPersistenceProvider
      data: CoreRawData
    }
  | {
      kind: 'capture-failed'
      transaction: TransactionStatusPayload
      provider: IPersistenceProvider
      error: unknown
    }

const DEFAULT_VERSION = '1.0.0'
const DATA_VERSION = '1.0.0'
const INLINE_COMPONENT_RENDER_RELATION = 'component-owner'
const EMPTY_SCENE_TREE_DATA: SceneTreeRawData = {
  workspace: '',
  workspaceList: [],
  elements: {}
}

const clonePersistenceSnapshot = (data: CoreRawData): CoreRawData => {
  if (typeof globalThis.structuredClone === 'function') {
    return globalThis.structuredClone(data)
  }

  return JSON.parse(JSON.stringify(data)) as CoreRawData
}

class Core implements CoreAPIs {
  version: string = DEFAULT_VERSION

  private customRenderer: IRenderer | null = null
  private persistence: IPersistenceProvider | null = null
  private saveHooks: SaveHook[] = []
  private loadHooks: LoadHook[] = []
  private loadDiagnosticsHooks: LoadDiagnosticsHook[] = []
  private persistenceQueue: Promise<void> = Promise.resolve()
  private compositionOpen = true
  private readonly dataChannelObservers: dataChannelObserver.DataChannelObserverRegistry
  private readonly registrationGraph = new RegistrationGraph({
    isCompositionOpen: () => this.compositionOpen
  })

  setupInputSystem!: InputSystemAPIs['setupInputSystem']

  initRender!: RenderAPIs['initRender']
  renderIsReady!: RenderAPIs['renderIsReady']
  registerRenderLayer!: RenderAPIs['registerRenderLayer']
  unregisterRenderLayer!: RenderAPIs['unregisterRenderLayer']
  createRenderGradientFillStyle!: RenderAPIs['createRenderGradientFillStyle']
  createEvenOddFillStyle!: RenderAPIs['createEvenOddFillStyle']
  createMeshProjection!: RenderAPIs['createMeshProjection']
  registerRenderInteractionTargets!: RenderAPIs['registerRenderInteractionTargets']
  updateRenderInteractionTarget!: RenderAPIs['updateRenderInteractionTarget']
  unregisterRenderInteractionTarget!: RenderAPIs['unregisterRenderInteractionTarget']
  clearRenderInteractionTargets!: RenderAPIs['clearRenderInteractionTargets']
  registerRenderInteractionHandler!: RenderAPIs['registerRenderInteractionHandler']
  unregisterRenderInteractionHandler!: RenderAPIs['unregisterRenderInteractionHandler']
  updatePropertyById!: CoreAPIs['updatePropertyById']
  commitPropertyChanges!: CoreAPIs['commitPropertyChanges']
  propsLoadData!: CoreAPIs['propsLoadData']
  propsSaveData!: CoreAPIs['propsSaveData']

  sceneTreeInit!: SceneTreeAPIs['sceneTreeInit']
  sceneTreeLoadData!: SceneTreeAPIs['sceneTreeLoadData']
  sceneTreeSaveData!: SceneTreeAPIs['sceneTreeSaveData']
  createElement!: SceneTreeAPIs['createElement']
  changeComputedData!: SceneTreeAPIs['changeComputedData']
  changeComputedDataPatch!: SceneTreeAPIs['changeComputedDataPatch']
  refreshComputedDataFromProperty!: SceneTreeAPIs['refreshComputedDataFromProperty']
  getAllElementsBounds!: SceneTreeAPIs['getAllElementsBounds']
  isContainerType!: SceneTreeAPIs['isContainerType']
  selectByChannel!: ElementSelectionActionAPIs['selectByChannel']
  selectElements!: ElementSelectionActionAPIs['selectElements']
  selectVectorPoints!: ElementSelectionActionAPIs['selectVectorPoints']
  selectVectorSegments!: ElementSelectionActionAPIs['selectVectorSegments']

  initFeatureSystem!: FeatureSystemAPIs['initFeatureSystem']
  defineUIProperty!: UIContextAPIs['defineUIProperty']
  registerUIProperty!: UIContextAPIs['registerUIProperty']
  getUIProperty!: UIContextAPIs['getUIProperty']
  setUIProperty!: UIContextAPIs['setUIProperty']
  getUIPropertySubject!: UIContextAPIs['getUIPropertySubject']
  onUIPropertyChange!: UIContextAPIs['onUIPropertyChange']

  defineSystemProperty!: SystemManagedPropertyAPIs['defineSystemProperty']
  registerSystemProperty!: SystemManagedPropertyAPIs['registerSystemProperty']
  getSystemProperty!: SystemManagedPropertyAPIs['getSystemProperty']
  setSystemProperty!: SystemManagedPropertyAPIs['setSystemProperty']
  getSystemPropertyObservable!: SystemManagedPropertyAPIs['getSystemPropertyObservable']

  constructor(readonly deps: CoreDeps) {
    this.dataChannelObservers =
      new dataChannelObserver.DataChannelObserverRegistry(deps.factory)
    const apis = createAPIs(
      deps.sceneTree,
      deps.render,
      deps.selection,
      deps.props,
      deps.factory
    )

    Object.assign(this, apis as CoreAPIs)

    const defineUIProperty = this.defineUIProperty
    const registerUIProperty = this.registerUIProperty
    this.defineUIProperty = ((key, config) => {
      this.assertCompositionOpen('register-node')
      const source = { kind: 'ui-property', key }
      if (
        this.registrationGraph.getRegistration(source) ||
        propertyRegistry.getAllPropertyKeys().includes(key)
      ) {
        this.registrationConflict(
          source,
          `[PropertyRegistry] Property "${key}" is already registered`
        )
      }
      this.preflightRegistrationDefinition(source, config.registration)
      defineUIProperty(key, config)
      this.ensureUIPropertyNode(key, config.registration)
      this.defineRegistrationRelations(source, config.registration)
    }) as UIContextAPIs['defineUIProperty']
    this.registerUIProperty = ((key, config) => {
      this.assertCompositionOpen('register-node')
      const source = { kind: 'ui-property', key }
      if (
        this.registrationGraph.getRegistration(source) ||
        propertyRegistry.getAllPropertyKeys().includes(key)
      ) {
        this.registrationConflict(
          source,
          `[PropertyRegistry] Property "${key}" is already registered`
        )
      }
      this.preflightRegistrationDefinition(source, config.registration)
      registerUIProperty(key, config)
      this.ensureUIPropertyNode(key, config.registration)
      this.defineRegistrationRelations(source, config.registration)
    }) as UIContextAPIs['registerUIProperty']

    // Subscribe to this Core instance's Factory commit status for auto-save.
    this.initAutoSave()
  }

  /**
   * Set a custom renderer (PixiJS, ThreeJS, custom)
   * @param renderer - Renderer implementation
   */
  setRenderer(renderer: IRenderer): void {
    this.customRenderer = renderer
  }

  registerDataChannelObserver<TChange = unknown>(
    registration: DataChannelObserverRegistration<TChange>
  ): void {
    this.dataChannelObservers.register(registration)
  }

  unregisterDataChannelObserver(name: string): boolean {
    return this.dataChannelObservers.unregister(name)
  }

  registerSharedDataChannel(
    name: Parameters<Factory['registerSharedDataChannel']>[0],
    channel: Parameters<Factory['registerSharedDataChannel']>[1]
  ): void {
    this.deps.factory.registerSharedDataChannel(name, channel)
  }

  unregisterSharedDataChannel(
    name: Parameters<Factory['unregisterSharedDataChannel']>[0]
  ): boolean {
    return this.deps.factory.unregisterSharedDataChannel(name)
  }

  hasSharedDataChannel(
    name: Parameters<Factory['hasSharedDataChannel']>[0]
  ): boolean {
    return this.deps.factory.hasSharedDataChannel(name)
  }

  getYjsDataChannel(
    name: Parameters<Factory['getYjsDataChannel']>[0]
  ): ReturnType<Factory['getYjsDataChannel']> {
    return this.deps.factory.getYjsDataChannel(name)
  }

  /**
   * Set a persistence provider (LocalStorage, IndexedDB, custom)
   * @param provider - Persistence provider implementation
   */
  setPersistence(provider: IPersistenceProvider): void {
    this.persistence = provider
  }

  /**
   * Register a hook to transform data before saving
   * @param hook - Function that receives and returns CoreData
   */
  registerSaveHook(hook: SaveHook): void {
    this.saveHooks.push(hook)
  }

  /**
   * Register a hook to transform data after loading
   * @param hook - Function that receives and returns CoreData
   */
  registerLoadHook(hook: LoadHook): void {
    this.loadHooks.push(hook)
  }

  /**
   * Register a hook to receive non-blocking load diagnostics.
   * Hooks are called after load validation/apply finishes.
   */
  registerLoadDiagnosticsHook(hook: LoadDiagnosticsHook): () => void {
    this.loadDiagnosticsHooks.push(hook)

    return () => {
      const hookIndex = this.loadDiagnosticsHooks.indexOf(hook)
      if (hookIndex === -1) {
        return
      }
      this.loadDiagnosticsHooks.splice(hookIndex, 1)
    }
  }

  /**
   * Start the framework with a custom renderer
   * @param container - DOM element to attach canvas to
   * @param renderOptions - Options for renderer initialization
   */
  async start(
    container: HTMLElement,
    renderOptions: RenderOptions
  ): Promise<void> {
    this.compositionOpen = false
    this.registrationGraph.validateRelations()

    const renderer = this.customRenderer

    if (!renderer) {
      throw new Error('No renderer configured. Call core.setRenderer() first.')
    }

    // Phase 1: Initialize renderer
    const result = await renderer.init(container, renderOptions)

    if (result.canvas && container) {
      container.appendChild(result.canvas)
      // Setup input system to watch the canvas
      this.setupInputSystem(result.canvas)
    }

    this.dataChannelObservers.init()

    // Phase 2: Load data from persistence
    await this.loadFromPersistence()

    // Phase 3: Initialize features
    this.initFeatureSystem({
      inputSystem: this.deps.inputSystem,
      systemContext: this.deps.systemContext
    })

    // Phase 4: Notify ready
    this.renderIsReady()
  }

  private initAutoSave(): void {
    this.deps.factory.subscribeToTransactionStatus((status) => {
      if (status.status !== 'committed') {
        return
      }

      const pending = this.captureCommittedTransaction(status)
      this.persistenceQueue = this.persistenceQueue.then(() =>
        this.persistCommittedTransaction(pending)
      )
    })
  }

  private captureCommittedTransaction(
    transaction: TransactionStatusPayload
  ): PendingPersistence {
    const provider = this.persistence
    if (!provider) {
      return { kind: 'skipped', transaction }
    }

    try {
      return {
        kind: 'save',
        transaction,
        provider,
        data: this.createPersistenceSnapshot()
      }
    } catch (error) {
      return { kind: 'capture-failed', transaction, provider, error }
    }
  }

  private async persistCommittedTransaction(
    pending: PendingPersistence
  ): Promise<void> {
    if (pending.kind === 'skipped') {
      this.deps.factory.reportPersistenceStatus(
        pending.transaction,
        'persistence-skipped'
      )
      return
    }

    if (pending.kind === 'capture-failed') {
      this.deps.factory.reportPersistenceStatus(
        pending.transaction,
        'persistence-failed',
        pending.provider.name,
        pending.error
      )
      return
    }

    try {
      await pending.provider.save(pending.data)
      this.deps.factory.reportPersistenceStatus(
        pending.transaction,
        'persisted',
        pending.provider.name
      )
    } catch (error) {
      this.deps.factory.reportPersistenceStatus(
        pending.transaction,
        'persistence-failed',
        pending.provider.name,
        error
      )
    }
  }

  private createPersistenceSnapshot(): CoreRawData {
    const systemContextData = this.deps.systemContext.saveManagedProperties()

    let data: CoreRawData = {
      version: this.version,
      sceneTree: this.sceneTreeSaveData(),
      props: this.deps.props.save()
    }
    if (Object.keys(systemContextData).length > 0) {
      data.systemContext = systemContextData
    }

    data = clonePersistenceSnapshot(data)

    // Run before-save hooks (encryption, compression, metadata)
    for (const hook of this.saveHooks) {
      data = hook(data)
    }

    return clonePersistenceSnapshot(data)
  }

  private async loadFromPersistence(): Promise<void> {
    if (!this.persistence) {
      return
    }

    const data = await this.persistence.load()
    if (data) {
      this.applyLoadedData(data)
    }
  }

  registerEvent<TPayload = unknown, TOptions = unknown>(
    event: string | EventDefinition<TPayload, TOptions>
  ) {
    return eventRegistry.register(event)
  }

  unregisterEvent(event: string | EventDefinition): boolean {
    return eventRegistry.unregister(event)
  }

  subscribeEvent<TPayload = unknown, TOptions = unknown>(
    event: string | EventDefinition<TPayload, TOptions>,
    handler: (payload?: TPayload, options?: TOptions) => void
  ): () => void {
    const eventName = typeof event === 'string' ? event : event.eventName
    const registration = eventRegistry.get(event)
    if (!registration) {
      throw new Error(
        `[Core] Event "${eventName}" is not registered. Register it before subscribing.`
      )
    }

    const subscription = registration.subscribe(handler)
    return () => subscription.unsubscribe()
  }

  registerPropertySchema(
    schema: PropertySchema,
    options?: Parameters<typeof registerPropertySchema>[1],
    registration?: RegistrationDefinitionMetadata
  ): void {
    this.assertCompositionOpen('register-node')
    const source = { kind: 'property', key: schema.type }
    if (
      getPropertySchema(schema.type) ||
      this.registrationGraph.hasPendingCleanup(source)
    ) {
      this.registrationConflict(
        source,
        `Property schema "${schema.type}" is already registered`
      )
    }
    this.preflightRegistrationDefinition(source, registration)
    registerPropertySchema(schema, options)
    this.ensurePropertyNode(schema.type, registration)
    this.defineRegistrationRelations(source, registration)
  }

  getPropertySchema(type: string) {
    return getPropertySchema(type)
  }

  definePropertyComponent(
    definition: PropertyComponentDefinition
  ): ReturnType<typeof definePropertyComponentRuntime> {
    this.assertCompositionOpen('register-node')
    const source = { kind: 'property', key: definition.type }
    if (
      getPropertyComponent(definition.type) ||
      this.registrationGraph.hasPendingCleanup(source)
    ) {
      this.registrationConflict(
        source,
        `Property component "${definition.type}" is already registered`
      )
    }
    this.preflightRegistrationDefinition(
      source,
      definition.registration,
      'children' in definition && definition.children
        ? [definition.children.key]
        : []
    )
    if (
      'children' in definition &&
      definition.children &&
      !getPropertyComponent(definition.children.childType)
    ) {
      throw new RegistrationRelationError({
        ok: false,
        code: 'RELATION_TARGET_NOT_FOUND',
        operation: 'define-relation',
        message: `Child property runtime "${definition.children.childType}" is not registered`,
        source: { kind: 'property', key: definition.type },
        relationName: definition.children.key,
        target: { kind: 'property', key: definition.children.childType }
      })
    }

    const Constructor = definePropertyComponentRuntime(definition)
    this.ensurePropertyNode(definition.type, definition.registration)
    if ('children' in definition && definition.children) {
      this.ensurePropertyNode(definition.children.childType)
      this.registrationGraph.defineRelation(
        { kind: 'property', key: definition.type },
        {
          name: definition.children.key,
          target: { kind: 'property', key: definition.children.childType },
          onTargetUnregister: 'detach'
        }
      )
    }
    this.defineRegistrationRelations(source, definition.registration)
    return Constructor
  }

  registerPropertyComponent(
    type: string,
    component: Parameters<typeof registerPropertyComponent>[1],
    options?: Parameters<typeof registerPropertyComponent>[2]
  ): void {
    this.assertCompositionOpen('register-node')
    const source = { kind: 'property', key: type }
    if (
      getPropertyComponent(type) ||
      this.registrationGraph.hasPendingCleanup(source)
    ) {
      this.registrationConflict(
        source,
        `Property component "${type}" is already registered`
      )
    }
    registerPropertyComponent(type, component, options)
    this.ensurePropertyNode(type)
  }

  getPropertyComponent(type: string) {
    return getPropertyComponent(type)
  }

  unregisterPropertyRegistration(
    type: string,
    scope: PropertyRegistrationScope = 'all'
  ) {
    this.assertCompositionOpen('unregister-registration')
    return unregisterPropertyRegistration(type, this.deps.props, scope)
  }

  definePropertyChildRelation(
    parentPropertyType: string,
    relation: PropertyChildRelationDefinition
  ): RelationOperationSuccess {
    this.assertRelationCanBeDefined(
      { kind: 'property', key: parentPropertyType },
      relation.key,
      { kind: 'property', key: relation.childType }
    )
    const result = definePropertyChildRelationRuntime(
      parentPropertyType,
      relation,
      this.deps.props
    )
    this.registrationGraph.defineRelation(
      { kind: 'property', key: parentPropertyType },
      {
        name: relation.key,
        target: { kind: 'property', key: relation.childType },
        onTargetUnregister: 'detach'
      }
    )
    return result
  }

  removePropertyChildRelation(
    parentPropertyType: string,
    key: string
  ): RelationOperationSuccess {
    this.assertRelationCanBeRemoved(
      { kind: 'property', key: parentPropertyType },
      key
    )
    const result = removePropertyChildRelationRuntime(
      parentPropertyType,
      key,
      this.deps.props
    )
    this.registrationGraph.removeRelation(
      { kind: 'property', key: parentPropertyType },
      key
    )
    return result
  }

  getPropertyChildRelations(
    parentPropertyType: string
  ): readonly PropertyChildRelationMetadata[] {
    return getPropertyChildRelationsRuntime(parentPropertyType)
  }

  unregisterPropertyType(type: string): UnregisterRegistrationSuccess {
    return this.registrationGraph.unregister({ kind: 'property', key: type })
  }

  defineComponent(definition: ComponentDefinition): void {
    this.assertCompositionOpen('register-node')
    const componentRef = { kind: 'component', key: definition.type }
    if (
      this.registrationGraph.getRegistration(componentRef) ||
      componentRegistry.has(definition.type)
    ) {
      this.registrationConflict(
        componentRef,
        `Component "${definition.type}" is already registered`
      )
    }
    const inlineRenderRef = {
      kind: 'render-strategy',
      key: definition.type
    }
    if (
      definition.renderStrategy &&
      (this.registrationGraph.getRegistration(inlineRenderRef) ||
        renderStrategyRegistry.has(definition.type))
    ) {
      this.registrationConflict(
        inlineRenderRef,
        `Render strategy for "${definition.type}" is already registered`
      )
    }
    const propertyNames = new Set<string>()
    for (const property of definition.properties) {
      if (propertyNames.has(property.name)) {
        throw new RegistrationRelationError({
          ok: false,
          code: 'DUPLICATE_RELATION',
          operation: 'define-relation',
          message: `Component property relation "${definition.type}/${property.name}" is duplicated`,
          source: { kind: 'component', key: definition.type },
          relationName: property.name
        })
      }
      propertyNames.add(property.name)
      if (!getPropertyComponent(property.type)) {
        throw new RegistrationRelationError({
          ok: false,
          code: 'RELATION_TARGET_NOT_FOUND',
          operation: 'define-relation',
          message: `Property runtime "${property.type}" is not registered`,
          source: { kind: 'component', key: definition.type },
          relationName: property.name,
          target: { kind: 'property', key: property.type }
        })
      }
    }

    const source = componentRef
    this.preflightRegistrationDefinition(source, definition.registration, [
      ...propertyNames
    ])

    defineComponentRuntime(definition)
    this.ensureComponentNode(definition.type, definition.registration)
    if (definition.renderStrategy) {
      this.ensureRenderStrategyNode(
        definition.type,
        definition.registration?.owner
          ? { owner: definition.registration.owner }
          : undefined
      )
      this.registrationGraph.defineRelation(inlineRenderRef, {
        name: INLINE_COMPONENT_RENDER_RELATION,
        target: componentRef,
        onTargetUnregister: 'unregister-source'
      })
    }
    definition.properties.forEach((property) => {
      this.ensurePropertyNode(property.type)
      this.registrationGraph.defineRelation(
        { kind: 'component', key: definition.type },
        {
          name: property.name,
          target: { kind: 'property', key: property.type },
          onTargetUnregister: 'detach'
        }
      )
    })
    this.defineRegistrationRelations(source, definition.registration)
  }

  unregisterComponent(
    type: string,
    options: UnregisterComponentOptions & { detailed: true }
  ): UnregisterComponentResult
  unregisterComponent(
    type: string,
    options?: UnregisterComponentOptions
  ): boolean
  unregisterComponent(
    type: string,
    options: UnregisterComponentOptions = {}
  ): boolean | UnregisterComponentResult {
    this.assertCompositionOpen('unregister-registration')
    if (
      !this.registrationGraph.getRegistration({ kind: 'component', key: type })
    ) {
      return unregisterComponentRuntime(type, options)
    }
    this.registrationGraph.unregister({ kind: 'component', key: type })
    if (options.detailed) {
      return { ok: true, removed: [`component:${type}`], skipped: [] }
    }
    return true
  }

  defineComponentPropertyRelation(
    componentType: string,
    property: Parameters<typeof defineComponentPropertyRelationRuntime>[1]
  ): RelationOperationSuccess {
    this.assertRelationCanBeDefined(
      { kind: 'component', key: componentType },
      property.name,
      { kind: 'property', key: property.type }
    )
    const result = defineComponentPropertyRelationRuntime(
      componentType,
      property,
      this.deps.sceneTree
    )
    this.registrationGraph.defineRelation(
      { kind: 'component', key: componentType },
      {
        name: property.name,
        target: { kind: 'property', key: property.type },
        onTargetUnregister: 'detach'
      }
    )
    return result
  }

  removeComponentPropertyRelation(
    componentType: string,
    propertyName: string
  ): RelationOperationSuccess {
    this.assertRelationCanBeRemoved(
      { kind: 'component', key: componentType },
      propertyName
    )
    const result = removeComponentPropertyRelationRuntime(
      componentType,
      propertyName,
      this.deps.sceneTree
    )
    this.registrationGraph.removeRelation(
      { kind: 'component', key: componentType },
      propertyName
    )
    return result
  }

  getComponentPropertyRelations(
    componentType: string
  ): readonly ComponentPropertyRelationMetadata[] {
    return getComponentPropertyRelationsRuntime(componentType)
  }

  defineFeature<
    API extends Record<string, unknown> = Record<string, unknown>,
    State extends Record<string, unknown> = Record<string, unknown>
  >(
    name: string,
    keyConfig: FeatureKeyMap | undefined,
    definition: FeatureDefinition<API, State>
  ): { api: FeatureAPI<API>; dispose: () => boolean } {
    this.assertCompositionOpen('register-node')
    const source = { kind: 'feature', key: name }
    if (
      this.registrationGraph.getRegistration(source) ||
      getFeatureRegistry().has(name)
    ) {
      this.registrationConflict(
        source,
        `Feature "${name}" is already registered`
      )
    }
    this.preflightRegistrationDefinition(source, definition.registration)
    const registration = defineFeatureRuntime(name, keyConfig, definition)
    this.ensureFeatureNode(name, definition.registration)
    this.defineRegistrationRelations(source, definition.registration)
    return {
      api: registration.api,
      dispose: () => this.unregisterFeature(name)
    }
  }

  getFeature(featureName: string): FeatureAPI {
    return getFeatureRuntime(featureName)
  }

  unregisterFeature(featureName: string): boolean {
    this.assertCompositionOpen('unregister-registration')
    if (
      this.registrationGraph.getRegistration({
        kind: 'feature',
        key: featureName
      })
    ) {
      this.registrationGraph.unregister({ kind: 'feature', key: featureName })
      return true
    }
    return unregisterFeatureRuntime(featureName)
  }

  registerRenderStrategy(
    type: string,
    strategy: RenderStrategy,
    registration?: RegistrationDefinitionMetadata
  ): void {
    this.assertCompositionOpen('register-node')
    const source = { kind: 'render-strategy', key: type }
    if (
      this.registrationGraph.getRegistration(source) ||
      renderStrategyRegistry.has(type)
    ) {
      this.registrationConflict(
        source,
        `Render strategy for "${type}" is already registered`
      )
    }
    this.preflightRegistrationDefinition(source, registration)
    renderStrategyRegistry.register(type, strategy)
    this.ensureRenderStrategyNode(type, registration)
    this.defineRegistrationRelations(source, registration)
  }

  unregisterRenderStrategy(type: string): boolean {
    this.assertCompositionOpen('unregister-registration')
    if (
      this.registrationGraph.getRegistration({
        kind: 'render-strategy',
        key: type
      })
    ) {
      this.registrationGraph.unregister({ kind: 'render-strategy', key: type })
      return true
    }
    return renderStrategyRegistry.unregister(type)
  }

  unregisterUIProperty(key: string): boolean {
    this.assertCompositionOpen('unregister-registration')
    const exists = propertyRegistry.getAllPropertyKeys().includes(key)
    if (this.registrationGraph.getRegistration({ kind: 'ui-property', key })) {
      this.registrationGraph.unregister({ kind: 'ui-property', key })
      return true
    }
    propertyRegistry.unregister(key)
    return exists
  }

  getRegistration(ref: RegistrationRef): RegistrationNodeMetadata | undefined {
    return this.registrationGraph.getRegistration(ref)
  }

  getRegistrations(): readonly RegistrationNodeMetadata[] {
    return this.registrationGraph.getRegistrations()
  }

  getRegistrationRelations(): readonly RegistrationRelationMetadata[] {
    return this.registrationGraph.getRelations()
  }

  defineSelection(
    type: Parameters<SelectionManager['register']>[0],
    selection: Parameters<SelectionManager['register']>[1]
  ): void {
    this.deps.selection.register(type, selection)
  }

  registerSelection(
    type: Parameters<SelectionManager['register']>[0],
    selection: Parameters<SelectionManager['register']>[1]
  ): void {
    this.defineSelection(type, selection)
  }

  unregisterSelection(
    type: Parameters<SelectionManager['unregister']>[0]
  ): boolean {
    return this.deps.selection.unregister(type)
  }

  getSelection(type: Parameters<SelectionManager['get']>[0]) {
    return this.deps.selection.get(type)
  }

  getPresetDependencies() {
    return {
      sceneTree: this.deps.sceneTree,
      systemContext: this.deps.systemContext,
      render: this.deps.render
    }
  }

  private assertCompositionOpen(operation: RegistrationGraphOperation): void {
    if (this.compositionOpen) return
    throw new RegistrationRelationError({
      ok: false,
      code: 'COMPOSITION_CLOSED',
      operation,
      message: 'Registration composition is permanently closed'
    })
  }

  private registrationConflict(
    ref: RegistrationRef,
    message = `Registration "${ref.kind}:${ref.key}" must be unregistered before it can be defined again`
  ): never {
    throw new RegistrationRelationError({
      ok: false,
      code: 'UNREGISTER_FAILED',
      operation: 'register-node',
      message,
      registration: ref
    })
  }

  private assertRelationCanBeDefined(
    source: RegistrationRef,
    relationName: string,
    target: RegistrationRef
  ): void {
    this.assertCompositionOpen('define-relation')
    if (!this.registrationGraph.getRegistration(source)) {
      throw new RegistrationRelationError({
        ok: false,
        code: 'REGISTRATION_NOT_FOUND',
        operation: 'define-relation',
        message: `Registration "${source.kind}:${source.key}" was not found`,
        source,
        relationName
      })
    }
    if (!this.registrationGraph.getRegistration(target)) {
      throw new RegistrationRelationError({
        ok: false,
        code: 'RELATION_TARGET_NOT_FOUND',
        operation: 'define-relation',
        message: `Relation target "${target.kind}:${target.key}" was not found`,
        source,
        relationName,
        target
      })
    }
    if (
      this.registrationGraph
        .getOutgoingRelations(source)
        .some((relation) => relation.name === relationName)
    ) {
      throw new RegistrationRelationError({
        ok: false,
        code: 'DUPLICATE_RELATION',
        operation: 'define-relation',
        message: `Relation "${source.kind}:${source.key}/${relationName}" is already defined`,
        source,
        relationName
      })
    }
  }

  private assertRelationCanBeRemoved(
    source: RegistrationRef,
    relationName: string
  ): void {
    this.assertCompositionOpen('remove-relation')
    if (!this.registrationGraph.getRegistration(source)) {
      throw new RegistrationRelationError({
        ok: false,
        code: 'REGISTRATION_NOT_FOUND',
        operation: 'remove-relation',
        message: `Registration "${source.kind}:${source.key}" was not found`,
        source,
        relationName
      })
    }
    if (
      !this.registrationGraph
        .getOutgoingRelations(source)
        .some((relation) => relation.name === relationName)
    ) {
      throw new RegistrationRelationError({
        ok: false,
        code: 'RELATION_NOT_FOUND',
        operation: 'remove-relation',
        message: `Relation "${source.kind}:${source.key}/${relationName}" was not found`,
        source,
        relationName
      })
    }
  }

  private preflightRegistrationDefinition(
    source: RegistrationRef,
    registration?: RegistrationDefinitionMetadata,
    reservedRelationNames: readonly string[] = []
  ): void {
    if (!registration?.relations?.length) return

    const relationNames = new Set([
      ...reservedRelationNames,
      ...this.registrationGraph
        .getOutgoingRelations(source)
        .map((relation) => relation.name)
    ])
    registration.relations.forEach((relation) => {
      if (relationNames.has(relation.name)) {
        throw new RegistrationRelationError({
          ok: false,
          code: 'DUPLICATE_RELATION',
          operation: 'define-relation',
          message: `Registration relation "${source.kind}:${source.key}/${relation.name}" is duplicated`,
          source,
          relationName: relation.name,
          target: relation.target
        })
      }
      relationNames.add(relation.name)
      if (!this.registrationGraph.getRegistration(relation.target)) {
        throw new RegistrationRelationError({
          ok: false,
          code: 'RELATION_TARGET_NOT_FOUND',
          operation: 'define-relation',
          message: `Relation target "${relation.target.kind}:${relation.target.key}" was not found`,
          source,
          relationName: relation.name,
          target: relation.target
        })
      }
    })
  }

  private defineRegistrationRelations(
    source: RegistrationRef,
    registration?: RegistrationDefinitionMetadata
  ): void {
    registration?.relations?.forEach((relation) => {
      this.registrationGraph.defineRelation(source, relation)
    })
  }

  private ensurePropertyNode(
    type: string,
    registration?: RegistrationDefinitionMetadata
  ): void {
    if (
      this.registrationGraph.getRegistration({ kind: 'property', key: type })
    ) {
      return
    }
    this.registrationGraph.registerNode({
      ref: { kind: 'property', key: type },
      owner: registration?.owner,
      handlers: {
        isPresent: () => Boolean(getPropertyComponent(type)),
        preflightUnregister: () => this.assertPropertyTypeUnused(type),
        preflightDetachRelation: () => this.assertPropertyTypeUnused(type),
        detachRelation: (relation) => {
          removePropertyChildRelationRuntime(
            type,
            relation.name,
            this.deps.props
          )
        }
      },
      resources: [
        {
          key: `property:${type}`,
          dispose: () => {
            unregisterPropertyRegistration(type, this.deps.props, 'all')
          }
        }
      ]
    })
  }

  private ensureComponentNode(
    type: string,
    registration?: RegistrationDefinitionMetadata
  ): void {
    if (
      this.registrationGraph.getRegistration({ kind: 'component', key: type })
    ) {
      return
    }
    this.registrationGraph.registerNode({
      ref: { kind: 'component', key: type },
      owner: registration?.owner,
      handlers: {
        isPresent: () => componentRegistry.has(type),
        preflightUnregister: () => this.assertComponentTypeUnused(type),
        preflightDetachRelation: () => this.assertComponentTypeUnused(type),
        detachRelation: (relation) => {
          removeComponentPropertyRelationRuntime(
            type,
            relation.name,
            this.deps.sceneTree
          )
        }
      },
      resources: [
        {
          key: `component:${type}`,
          dispose: () => {
            unregisterComponentGraphRegistration(type)
          }
        }
      ]
    })
  }

  private ensureFeatureNode(
    name: string,
    registration?: RegistrationDefinitionMetadata
  ): void {
    this.registrationGraph.registerNode({
      ref: { kind: 'feature', key: name },
      owner: registration?.owner,
      handlers: { isPresent: () => getFeatureRegistry().has(name) },
      resources: [
        {
          key: `feature:${name}`,
          dispose: () => {
            unregisterFeatureRuntime(name)
          }
        }
      ]
    })
  }

  private ensureRenderStrategyNode(
    type: string,
    registration?: RegistrationDefinitionMetadata
  ): void {
    this.registrationGraph.registerNode({
      ref: { kind: 'render-strategy', key: type },
      owner: registration?.owner,
      handlers: { isPresent: () => renderStrategyRegistry.has(type) },
      resources: [
        {
          key: `render-strategy:${type}`,
          dispose: () => {
            renderStrategyRegistry.unregister(type)
          }
        }
      ]
    })
  }

  private ensureUIPropertyNode(
    key: string,
    registration?: RegistrationDefinitionMetadata
  ): void {
    if (this.registrationGraph.getRegistration({ kind: 'ui-property', key })) {
      return
    }
    this.registrationGraph.registerNode({
      ref: { kind: 'ui-property', key },
      owner: registration?.owner,
      handlers: {
        isPresent: () => propertyRegistry.getAllPropertyKeys().includes(key)
      },
      resources: [
        {
          key: `ui-property:${key}`,
          dispose: () => propertyRegistry.unregister(key)
        }
      ]
    })
  }

  private assertPropertyTypeUnused(type: string): void {
    const propertyIds = this.deps.props.getPropertyIdsByType(type)
    if (propertyIds.length === 0) return
    throw new RegistrationRelationError({
      ok: false,
      code: 'REGISTRATION_IN_USE',
      operation: 'unregister-registration',
      message: `Property registration "${type}" is in use by: ${propertyIds.join(', ')}`,
      registration: { kind: 'property', key: type }
    })
  }

  private assertComponentTypeUnused(type: string): void {
    const activeIds: string[] = []
    this.deps.sceneTree.getAllElements().forEach((element) => {
      if (element.get('type') === type) activeIds.push(element.get('id'))
    })
    if (activeIds.length === 0) return
    throw new RegistrationRelationError({
      ok: false,
      code: 'REGISTRATION_IN_USE',
      operation: 'unregister-registration',
      message: `Component registration "${type}" is in use by: ${activeIds.join(', ')}`,
      registration: { kind: 'component', key: type }
    })
  }

  load(data: CoreRawData): void {
    if (!data) {
      return
    }

    this.applyLoadedData(data)
  }

  async save() {
    const sceneTreeData = await this.sceneTreeSaveData()
    const systemContextData = this.deps.systemContext.saveManagedProperties()

    const data: CoreRawData = {
      version: this.version,
      sceneTree: sceneTreeData,
      props: this.deps.props.save()
    }
    if (Object.keys(systemContextData).length > 0) {
      data.systemContext = systemContextData
    }

    return data
  }

  private normalizeLoadData(
    rawData: unknown,
    diagnostics: LoadValidationDiagnostic[],
    pathPrefix = 'core'
  ): CoreRawData {
    if (!isRecord(rawData)) {
      diagnostics.push({
        scope: 'core',
        path: pathPrefix,
        message:
          'Expected object payload for core load; fallback to safe defaults'
      })
      return {
        version: DATA_VERSION,
        sceneTree: EMPTY_SCENE_TREE_DATA,
        props: {}
      }
    }

    const version =
      typeof rawData.version === 'string' ? rawData.version : DATA_VERSION
    if (typeof rawData.version !== 'string') {
      diagnostics.push({
        scope: 'core',
        path: `${pathPrefix}.version`,
        message: 'Invalid version type; fallback to default version'
      })
    }

    const sceneTree = isRecord(rawData.sceneTree)
      ? (rawData.sceneTree as unknown as SceneTreeRawData)
      : EMPTY_SCENE_TREE_DATA
    if (!isRecord(rawData.sceneTree)) {
      diagnostics.push({
        scope: 'core',
        path: `${pathPrefix}.sceneTree`,
        message: 'Invalid sceneTree payload type; fallback to empty scene data'
      })
    }

    const props = (
      isRecord(rawData.props) ? rawData.props : {}
    ) as CoreRawData['props']
    if (!isRecord(rawData.props)) {
      diagnostics.push({
        scope: 'core',
        path: `${pathPrefix}.props`,
        message: 'Invalid props payload type; fallback to empty props map'
      })
    }

    const normalized: CoreRawData = {
      version,
      sceneTree,
      props
    }

    if ('systemContext' in rawData) {
      normalized.systemContext = rawData.systemContext as Record<
        string,
        unknown
      >
    }

    return normalized
  }

  private runLoadHooks(data: CoreRawData): CoreRawData {
    let nextData = data
    for (const hook of this.loadHooks) {
      nextData = hook(nextData)
    }

    return nextData
  }

  private applyLoadedData(rawData: unknown): void {
    const diagnostics: LoadValidationDiagnostic[] = []

    const normalizedInput = this.normalizeLoadData(
      rawData,
      diagnostics,
      'core.input'
    )
    const migrated = this.runLoadHooks(normalizedInput)
    const normalizedAfterHooks = this.normalizeLoadData(
      migrated,
      diagnostics,
      'core.hooks'
    )

    const propsValidation = this.deps.props.validateLoadData(
      normalizedAfterHooks.props
    )
    diagnostics.push(
      ...propsValidation.diagnostics.map((item) => ({
        scope: 'props-manager' as const,
        path: item.path,
        message: item.message
      }))
    )

    const sceneValidation = this.deps.sceneTree.validateLoadData(
      normalizedAfterHooks.sceneTree
    )
    diagnostics.push(
      ...sceneValidation.diagnostics.map((item) => ({
        scope: 'scene-tree' as const,
        path: item.path,
        message: item.message
      }))
    )

    this.version = normalizedAfterHooks.version
    this.deps.props.load(propsValidation.data)
    this.deps.sceneTree.load(sceneValidation.data)

    const systemDiagnostics = this.deps.systemContext.loadManagedProperties(
      normalizedAfterHooks.systemContext
    )
    diagnostics.push(
      ...systemDiagnostics.map((item) => ({
        scope: 'system-context' as const,
        path: item.path,
        message: item.message
      }))
    )

    fileLoadComplete()

    this.emitLoadDiagnostics(
      diagnostics,
      this.composeLoadedData(
        normalizedAfterHooks.version,
        sceneValidation.data,
        propsValidation.data
      )
    )
  }

  private composeLoadedData(
    version: string,
    sceneTree: SceneTreeRawData,
    props: CoreRawData['props']
  ): CoreRawData {
    const data: CoreRawData = {
      version,
      sceneTree,
      props
    }

    const managedProperties = this.deps.systemContext.saveManagedProperties()
    if (Object.keys(managedProperties).length > 0) {
      data.systemContext = managedProperties
    }

    return data
  }

  private emitLoadDiagnostics(
    diagnostics: LoadValidationDiagnostic[],
    data: CoreRawData
  ): void {
    if (diagnostics.length === 0 || this.loadDiagnosticsHooks.length === 0) {
      return
    }

    this.loadDiagnosticsHooks.forEach((hook) => {
      hook(diagnostics, data)
    })
  }
}

export { Core }

const core = new Core({
  inputSystem,
  factory,
  props,
  render,
  sceneTree,
  selection,
  systemContext
})
export default core
