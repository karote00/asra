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
import type { FeatureSystemAPIs } from './types/feature-system'

import { CoreAPIs, ElementSelectionActionAPIs } from './types'
import { createAPIs } from './apis'

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

  setupInputSystem!: CoreAPIs['setupInputSystem']

  initRender!: CoreAPIs['initRender']
  renderIsReady!: CoreAPIs['renderIsReady']

  sceneTreeInit!: CoreAPIs['sceneTreeInit']
  sceneTreeLoadData!: CoreAPIs['sceneTreeLoadData']
  sceneTreeSaveData!: CoreAPIs['sceneTreeSaveData']
  selectElements!: ElementSelectionActionAPIs['selectElements']

  initFeatureSystem!: FeatureSystemAPIs['initFeatureSystem']

  constructor(readonly deps: CoreDeps) {
    const apis = createAPIs(deps.sceneTree, deps.render)

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

    if (data.sceneTree) {
      this.sceneTreeLoadData(data.sceneTree)
    } else {
      this.sceneTreeInit()
    }
  }

  async save() {
    const sceneTreeData = await this.sceneTreeSaveData()

    const data = {
      version: this.version,
      sceneTree: sceneTreeData
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
