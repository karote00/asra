import factory, { Factory } from '@asra/factory'
import inputSystem, { InputSystem } from '@asra/input-system'
import sceneTree, { SceneTree } from '@asra/scene-tree'
import render, { Render } from '@asra/render'
import props, { PropsManager } from '@asra/props-manager'
import systemContext, { SystemContext } from '@asra/system-context'
import type { PropsComponentRawData, SceneTreeRawData } from '@asra/utils'

import { initAllHandlers } from './handlers'
import {
  CoreAPIs,
  InputSystemAPIs,
  RenderAPIs,
  ViewportAPIs,
  UndoActionAPIs,
  SceneTreeAPIs,
  ElementSelectionAPIs,
  PropsAPIs,
  SystemContextAPIs
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

  initSceneTree!: SceneTreeAPIs['initSceneTree']
  loadSceneTree!: SceneTreeAPIs['loadSceneTree']
  saveSceneTree!: SceneTreeAPIs['saveSceneTree']
  addRectangle!: SceneTreeAPIs['addRectangle']
  changeComputedData!: SceneTreeAPIs['changeComputedData']

  selectElements!: ElementSelectionAPIs['selectElements']

  loadProps!: PropsAPIs['loadProps']
  saveProps!: PropsAPIs['saveProps']

  getCurrentTool!: SystemContextAPIs['getCurrentTool']
  switchTool!: SystemContextAPIs['switchTool']

  constructor(private readonly deps: CoreDeps) {
    const apis = createAPIs({
      inputSystem: this.deps.inputSystem,
      sceneTree: this.deps.sceneTree,
      props: this.deps.props,
      systemContext: this.deps.systemContext
    })

    initAllHandlers(
      {
        inputSystem: this.deps.inputSystem,
        render: this.deps.render,
        factory: this.deps.factory
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
      this.loadProps(data.props)
    }

    if (data.sceneTree) {
      this.loadSceneTree(data.sceneTree)
    } else {
      this.initSceneTree()
    }

    this.zoomFit()
  }

  save() {
    const data = {
      version: this.version,
      sceneTree: this.saveSceneTree(),
      props: this.saveProps()
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
  systemContext
})
export default core
