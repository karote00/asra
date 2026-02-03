import type { PropsComponentRawData, SceneTreeRawData } from '@asyra/utils'
import factory, { Factory } from '@asyra/factory'
import inputSystem, { InputSystem } from '@asyra/input-system'
import sceneTree, { SceneTree } from '@asyra/scene-tree'
import render, { Render } from '@asyra/render'
import props, { PropsManager } from '@asyra/props-manager'
import selection, { SelectionManager } from '@asyra/selection'
import systemContext, { SystemContext } from '@asyra/system-context'
import interactionCore, {
  InteractionCore,
  DecisionHandler
} from '@asyra/interaction-core'

import { initRegistryInputHandler } from './registry-input-handler'
import {
  CoreAPIs,
  InputSystemAPIs,
  RenderAPIs,
  ViewportAPIs,
  UndoActionAPIs,
  SceneTreeAPIs,
  ElementSelectionAPIs,
  PropsAPIs,
  SystemContextAPIs,
  InteractionCoreAPIs,
  InteractionCoreActionAPIs,
  TransactionAPIs
} from './types'
import { createAPIs } from './apis'
import { createRequests } from './requests'
import { WorkflowRegistryClass } from './registries/workflow-registry'
import { handlerRegistry as globalHandlerRegistry } from './registries/handler-registry'

import combinations from './combinations'
inputSystem.setCombinations(combinations)

interface CoreRawData {
  version: string
  sceneTree: SceneTreeRawData
  props: PropsComponentRawData
}

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

  startTransaction!: TransactionAPIs['startTransaction']
  endTransaction!: TransactionAPIs['endTransaction']

  setupInputSystem!: InputSystemAPIs['setupInputSystem']

  initRender!: RenderAPIs['initRender']
  renderIsReady!: RenderAPIs['renderIsReady']
  getViewportPosition!: ViewportAPIs['getViewportPosition']
  getViewportScale!: ViewportAPIs['getViewportScale']

  undo!: UndoActionAPIs['undo']
  redo!: UndoActionAPIs['redo']

  sceneTreeInit!: SceneTreeAPIs['sceneTreeInit']
  sceneTreeLoadData!: SceneTreeAPIs['sceneTreeLoadData']
  sceneTreeSaveData!: SceneTreeAPIs['sceneTreeSaveData']
  addRectangle!: SceneTreeAPIs['addRectangle']
  changeComputedData!: SceneTreeAPIs['changeComputedData']
  resizeElement!: SceneTreeAPIs['resizeElement']
  selectElements!: ElementSelectionAPIs['selectElements']

  propsLoadData!: PropsAPIs['propsLoadData']
  propsSaveData!: PropsAPIs['propsSaveData']

  updateMouseState!: SystemContextAPIs['updateMouseState']
  updateKeyState!: SystemContextAPIs['updateKeyState']

  executeAction!: InteractionCoreAPIs['executeAction']
  startSession!: InteractionCoreAPIs['startSession']
  updateSession!: InteractionCoreAPIs['updateSession']
  endSession!: InteractionCoreAPIs['endSession']

  workflowRegistry = new WorkflowRegistryClass()
  handlerRegistryInstance = globalHandlerRegistry

  constructor(readonly deps: CoreDeps) {
    const requests = createRequests({
      systemContext: this.deps.systemContext,
      props: this.deps.props,
      sceneTree: this.deps.sceneTree,
      factory: this.deps.factory,
      render: this.deps.render,
      selection: this.deps.selection
    })
    const apis = createAPIs(requests)

    Object.assign(this, apis as CoreAPIs)
  }

  initEventHandlers(): void {
    initRegistryInputHandler(
      {
        inputSystem: this.deps.inputSystem
      },
      this.workflowRegistry,
      this as SystemContextAPIs & InteractionCoreActionAPIs
    )
    // No framework interaction handlers - all are user-defined
  }

  registerInteraction(eventName: string, handler: DecisionHandler) {
    this.deps.interactionCore.registry.register(eventName, handler)
  }

  load(data: CoreRawData): void {
    if (!data) {
      return
    }

    this.version = data.version ?? DATA_VERSION
    if (data.props) {
      this.propsLoadData(data.props)
    }

    if (data.sceneTree) {
      this.sceneTreeLoadData(data.sceneTree)
    } else {
      this.sceneTreeInit()
    }

    // this.zoomFit()
  }

  async save() {
    const propsData = await this.propsSaveData()
    const sceneTreeData = await this.sceneTreeSaveData()

    const data = {
      version: this.version,
      sceneTree: sceneTreeData,
      props: propsData
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

export const workflowRegistry = core.workflowRegistry
export const handlerRegistry = globalHandlerRegistry
