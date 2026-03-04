import type {
  SceneTreeRawData,
  CoreRawData,
  PropertySchema
} from '@asyra/utils'
import { isRecord } from '@asyra/utils'
import factory, { Factory } from '@asyra/factory'
import inputSystem, { InputSystem } from '@asyra/input-system'
import sceneTree, { SceneTree } from '@asyra/scene-tree'
import props, {
  PropsManager,
  getPropertyComponent,
  getPropertySchema,
  registerPropertySchema,
  registerPropertyComponent
} from '@asyra/props-manager'
import selection, { SelectionManager } from '@asyra/selection'
import systemContext, { SystemContext } from '@asyra/system-context'
import type { FeatureSystemAPIs } from './types/feature-system'
import render, { Render, IRenderer, RenderOptions } from '@asyra/render'
import { IPersistenceProvider, SaveHook, LoadHook } from '@asyra/persistence'
import {
  EventTypes,
  type EventDefinition,
  eventRegistry,
  fileLoadComplete,
  subscribeToEvents
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

interface CoreDeps {
  inputSystem: InputSystem
  factory: Factory
  props: PropsManager
  render: Render
  sceneTree: SceneTree
  selection: SelectionManager
  systemContext: SystemContext
}

const DEFAULT_VERSION = '1.0.0'
const DATA_VERSION = '1.0.0'
const EMPTY_SCENE_TREE_DATA: SceneTreeRawData = {
  workspace: '',
  workspaceList: [],
  elements: {}
}

class Core implements CoreAPIs {
  version: string = DEFAULT_VERSION

  private customRenderer: IRenderer | null = null
  private persistence: IPersistenceProvider | null = null
  private saveHooks: SaveHook[] = []
  private loadHooks: LoadHook[] = []
  private loadDiagnosticsHooks: LoadDiagnosticsHook[] = []

  setupInputSystem!: InputSystemAPIs['setupInputSystem']

  initRender!: RenderAPIs['initRender']
  renderIsReady!: RenderAPIs['renderIsReady']
  registerRenderLayer!: RenderAPIs['registerRenderLayer']
  unregisterRenderLayer!: RenderAPIs['unregisterRenderLayer']

  sceneTreeInit!: SceneTreeAPIs['sceneTreeInit']
  sceneTreeLoadData!: SceneTreeAPIs['sceneTreeLoadData']
  sceneTreeSaveData!: SceneTreeAPIs['sceneTreeSaveData']
  createElement!: SceneTreeAPIs['createElement']
  changeComputedData!: SceneTreeAPIs['changeComputedData']
  getAllElementsBounds!: SceneTreeAPIs['getAllElementsBounds']
  isContainerType!: SceneTreeAPIs['isContainerType']
  selectElements!: ElementSelectionActionAPIs['selectElements']
  selectVectorPoints!: ElementSelectionActionAPIs['selectVectorPoints']
  selectVectorSegments!: ElementSelectionActionAPIs['selectVectorSegments']

  initFeatureSystem!: FeatureSystemAPIs['initFeatureSystem']
  registerUIProperty!: UIContextAPIs['registerUIProperty']
  getUIProperty!: UIContextAPIs['getUIProperty']
  setUIProperty!: UIContextAPIs['setUIProperty']
  getUIPropertySubject!: UIContextAPIs['getUIPropertySubject']
  onUIPropertyChange!: UIContextAPIs['onUIPropertyChange']

  registerSystemProperty!: SystemManagedPropertyAPIs['registerSystemProperty']
  getSystemProperty!: SystemManagedPropertyAPIs['getSystemProperty']
  setSystemProperty!: SystemManagedPropertyAPIs['setSystemProperty']
  getSystemPropertyObservable!: SystemManagedPropertyAPIs['getSystemPropertyObservable']

  constructor(readonly deps: CoreDeps) {
    const apis = createAPIs(deps.sceneTree, deps.render)

    Object.assign(this, apis as CoreAPIs)

    // Subscribe to endTransaction for auto-save
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
    dataChannelObserver.registerDataChannelObserver(registration)
  }

  unregisterDataChannelObserver(name: string): boolean {
    return dataChannelObserver.unregisterDataChannelObserver(name)
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

    dataChannelObserver.initRegisteredDataChannelObservers()

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
    subscribeToEvents((event) => {
      if (event.type === EventTypes.END_TRANSACTION) {
        this.saveToPersistence().catch((error) => {
          console.error('[Core] Auto-save failed:', error)
        })
      }
    })
  }

  private async saveToPersistence(): Promise<void> {
    if (!this.persistence) {
      console.warn('[Core] No persistence provider configured, skipping save')
      return
    }

    const systemContextData = this.deps.systemContext.saveManagedProperties()

    let data: CoreRawData = {
      version: this.version,
      sceneTree: await this.sceneTreeSaveData(),
      props: this.deps.props.save()
    }
    if (Object.keys(systemContextData).length > 0) {
      data.systemContext = systemContextData
    }

    // Run before-save hooks (encryption, compression, metadata)
    for (const hook of this.saveHooks) {
      data = hook(data)
    }

    await this.persistence.save(data)
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
    options?: Parameters<typeof registerPropertySchema>[1]
  ): void {
    registerPropertySchema(schema, options)
  }

  getPropertySchema(type: string) {
    return getPropertySchema(type)
  }

  registerPropertyComponent(
    type: string,
    component: Parameters<typeof registerPropertyComponent>[1],
    options?: Parameters<typeof registerPropertyComponent>[2]
  ): void {
    registerPropertyComponent(type, component, options)
  }

  getPropertyComponent(type: string) {
    return getPropertyComponent(type)
  }

  registerSelection(
    type: Parameters<SelectionManager['register']>[0],
    selection: Parameters<SelectionManager['register']>[1]
  ): void {
    this.deps.selection.register(type, selection)
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
