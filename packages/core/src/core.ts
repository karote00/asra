import type { PropsComponentRawData, SceneTreeRawData } from '@asra/utils'
import factory, { Factory } from '@asra/factory'
import inputSystem, { InputSystem } from '@asra/input-system'
import sceneTree, { SceneTree } from '@asra/scene-tree'
import render, { Render } from '@asra/render'
import props, { PropsManager } from '@asra/props-manager'
import systemContext, { SystemContext } from '@asra/system-context'
import interactionCore, { InteractionCore } from '@asra/interaction-core'

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
  InteractionCoreAPIs
} from './types'
import { createAPIs } from './apis'

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
  systemContext: SystemContext
  interactionCore: InteractionCore
}

const DEFAULT_VERSION = '1.0.0'
const DATA_VERSION = '1.0.0'

class Core implements CoreAPIs {
  version: string = DEFAULT_VERSION

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

  selectElements!: ElementSelectionAPIs['selectElements']

  propsLoadData!: PropsAPIs['propsLoadData']
  propsSaveData!: PropsAPIs['propsSaveData']

  getCurrentPrimaryTool!: SystemContextAPIs['getCurrentPrimaryTool']
  switchPrimaryTool!: SystemContextAPIs['switchPrimaryTool']
  updateMouseState!: SystemContextAPIs['updateMouseState']
  updateKeyState!: SystemContextAPIs['updateKeyState']

  executeAction!: InteractionCoreAPIs['executeAction']
  startSession!: InteractionCoreAPIs['startSession']
  updateSession!: InteractionCoreAPIs['updateSession']
  endSession!: InteractionCoreAPIs['endSession']

  constructor(private readonly deps: CoreDeps) {
    const apis = createAPIs()

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
  systemContext,
  interactionCore
})
export default core
