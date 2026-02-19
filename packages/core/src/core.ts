import type { SceneTreeRawData, CoreRawData } from '@asyra/utils'
import './components'
import factory, { Factory } from '@asyra/factory'
import inputSystem, { InputSystem } from '@asyra/input-system'
import sceneTree, { SceneTree } from '@asyra/scene-tree'
import props, { PropsManager } from '@asyra/props-manager'
import selection, { SelectionManager } from '@asyra/selection'
import systemContext, { SystemContext } from '@asyra/system-context'
import interactionCore, {
  InteractionCore,
  DecisionHandler
} from '@asyra/interaction-core'
import type { FeatureSystemAPIs } from './types/feature-system'
import render, { Render, IRenderer, RenderOptions } from '@asyra/render'
import { IPersistenceProvider, SaveHook, LoadHook } from '@asyra/persistence'
import { EventTypes, subscribeToEvents } from '@asyra/reactive-events'
import { initDataContexts } from '@asyra/ui-context'
import { registerBuiltinRenderLayers } from './builtins'

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

interface CoreDeps {
  inputSystem: InputSystem
  factory: Factory
  props: PropsManager
  render: Render
  sceneTree: SceneTree
  selection: SelectionManager
  systemContext: SystemContext
  interactionCore: InteractionCore
}

const DEFAULT_VERSION = '1.0.0'
const DATA_VERSION = '1.0.0'

class Core implements CoreAPIs {
  version: string = DEFAULT_VERSION

  private customRenderer: IRenderer | null = null
  private persistence: IPersistenceProvider | null = null
  private saveHooks: SaveHook[] = []
  private loadHooks: LoadHook[] = []
  private uiContextInitialized = false

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
  selectElements!: ElementSelectionActionAPIs['selectElements']

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

    registerBuiltinRenderLayers(
      (registration, options) =>
        this.registerRenderLayer(registration, options),
      this.deps.render
    )

    // Phase 1: Initialize renderer
    const result = await renderer.init(container, renderOptions)

    if (result.canvas && container) {
      container.appendChild(result.canvas)
      // Setup input system to watch the canvas
      this.setupInputSystem(result.canvas)
    }

    if (!this.uiContextInitialized) {
      initDataContexts()
      this.uiContextInitialized = true
    }

    // Phase 2: Load data from persistence
    await this.loadFromPersistence()

    // Phase 3: Initialize features
    this.initFeatureSystem({
      inputSystem: this.deps.inputSystem,
      systemContext: this.deps.systemContext,
      interactionCore: this.deps.interactionCore
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

    let data: CoreRawData = {
      version: this.version,
      sceneTree: await this.sceneTreeSaveData(),
      props: this.deps.props.save()
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

    let data = await this.persistence.load()
    if (data) {
      // Run after-load hooks (decryption, decompression, migration)
      for (const hook of this.loadHooks) {
        data = hook(data)
      }

      this.version = data.version

      // Load props first, then scene tree (they have dependencies)
      if (data.props && Object.keys(data.props).length > 0) {
        this.deps.props.load(data.props)
      }

      if (data.sceneTree) {
        this.sceneTreeLoadData(data.sceneTree as SceneTreeRawData)
      } else {
        this.sceneTreeInit()
      }
    }
  }

  registerInteraction(eventName: string, handler: DecisionHandler) {
    this.deps.interactionCore.registry.register(eventName, handler)
  }

  load(data: CoreRawData): void {
    if (!data) {
      return
    }

    this.version = data.version ?? DATA_VERSION

    // Load props first, then scene tree (they have dependencies)
    if (data.props && Object.keys(data.props).length > 0) {
      this.deps.props.load(data.props)
    }

    if (data.sceneTree) {
      this.sceneTreeLoadData(data.sceneTree as SceneTreeRawData)
    } else {
      this.sceneTreeInit()
    }
  }

  async save() {
    const sceneTreeData = await this.sceneTreeSaveData()

    const data: CoreRawData = {
      version: this.version,
      sceneTree: sceneTreeData,
      props: this.deps.props.save()
    }

    return data
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
  systemContext,
  interactionCore
})
export default core
