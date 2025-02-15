import Factory, { DataTransact } from '@asra/factory'
import sceneTree, { SceneTree } from '@asra/scene-tree'
import InputSystem from '@asra/input-system'
import type { SceneTreeRawData } from '@asra/utils'

import SystemEventManager from './system-event-manager'
import RenderEventManager from './render-event-manager'
import SceneTreeManager from './scene-tree-manager'
import combinations from './combinations'

const inputSystem = new InputSystem(combinations)
const systemEventManager = new SystemEventManager(inputSystem)
const renderEventManager = new RenderEventManager(inputSystem)
const sceneTreeManager = new SceneTreeManager()

interface CoreRawData {
  version: string
  sceneTree: SceneTreeRawData
}

const DEFAULT_VERSION = '1.0.0'
const DATA_VERSION = '1.0.0'

class Core {
  version: string = DEFAULT_VERSION
  dataTransact: DataTransact = Factory.transact
  sceneTree: SceneTree = sceneTree
  systemEventManager: SystemEventManager = systemEventManager
  renderEventManager: RenderEventManager = renderEventManager
  sceneTreeManager: SceneTreeManager = sceneTreeManager

  load(data: CoreRawData): void {
    if (!data) {
      return
    }

    this.version = data.version ?? DATA_VERSION
    if (data.sceneTree) {
      this.sceneTreeManager.load(data.sceneTree)
    } else {
      this.sceneTreeManager.init()
    }
  }

  save() {
    const data = {
      version: this.version,
      sceneTree: this.sceneTreeManager.save()
    }

    return data
  }
}

export default Core
