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

import { initAllHandlers } from './subscribes'
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
  TransactionAPIs
} from './types'
import { createAPIs } from './apis'
import { createRequests } from './requests'

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
  zoomFit!: ViewportAPIs['zoomFit']
  panTo!: ViewportAPIs['panTo']
  zoomToCenter!: ViewportAPIs['zoomToCenter']

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

  switchPrimaryTool!: SystemContextAPIs['switchPrimaryTool']
  updateMouseState!: SystemContextAPIs['updateMouseState']
  updateKeyState!: SystemContextAPIs['updateKeyState']

  executeAction!: InteractionCoreAPIs['executeAction']
  startSession!: InteractionCoreAPIs['startSession']
  updateSession!: InteractionCoreAPIs['updateSession']
  endSession!: InteractionCoreAPIs['endSession']

  constructor(private readonly deps: CoreDeps) {
    const requests = createRequests({
      systemContext: this.deps.systemContext,
      props: this.deps.props,
      sceneTree: this.deps.sceneTree,
      factory: this.deps.factory,
      render: this.deps.render,
      selection: this.deps.selection
    })
    const apis = createAPIs(requests)

    initAllHandlers(
      {
        inputSystem: this.deps.inputSystem,
        render: this.deps.render,
        factory: this.deps.factory,
        interactionCore: this.deps.interactionCore
      },
      apis
    )
    Object.assign(this, apis as CoreAPIs)
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

    this.zoomFit()
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
