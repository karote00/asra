import sceneTree, { SceneTree } from '@asra/scene-tree'
import InputSystem from '@asra/input-system'
import SystemEventManager from './system-event-manager'
import RenderEventManager from './render-event-manager'
import combinations from './combinations.json'

const inputSystem = new InputSystem(combinations)

const systemEventManager = new SystemEventManager(inputSystem)
const renderEventManager = new RenderEventManager(inputSystem)

interface CoreRawData {
  version: string
  sceneTree: Record<string, string | number>
}

const DEFAULT_VERSION = '1.0.0'
const DATA_VERSION = '1.0.0'

class Core {
  version: string = DEFAULT_VERSION
  sceneTree: SceneTree = sceneTree
  systemEventManager: SystemEventManager = systemEventManager
  renderEventManager: RenderEventManager = renderEventManager

  constructor() {
    this._init()
  }

  _init(): void {
    // init
  }

  load(data: CoreRawData): void {
    if (!data) {
      return
    }

    this.version = data.version ?? DATA_VERSION
    if (data.sceneTree) {
      this.sceneTree.load(data.sceneTree)
    }
  }

  addRectangle(): void {
    this.sceneTree.addRectangle()
  }
}

export default Core
