import factory, { DataTransact } from '@asra/factory'
import InputSystem from '@asra/input-system'
import sceneTree from '@asra/scene-tree'
import render from '@asra/render'
import type {
  DataTypes,
  PropsComponentRawData,
  SceneTreeRawData
} from '@asra/utils'

import SystemEventManager from './system-event-manager'
import RenderManager from './render-manager'
import SceneTreeManager from './scene-tree-manager'
import ElementSelectionManager from './element-selection-manager'
import ElementPropsManager from './element-props-manager'
import combinations from './combinations'

const inputSystem = new InputSystem(combinations)
const systemEventManager = new SystemEventManager(inputSystem)
const renderManager = new RenderManager(inputSystem, render)
const sceneTreeManager = new SceneTreeManager(sceneTree)
const elementSelectionManager = new ElementSelectionManager()
const elementPropsManager = new ElementPropsManager()

interface CoreRawData {
  version: string
  sceneTree: SceneTreeRawData
  props: PropsComponentRawData
}

const DEFAULT_VERSION = '1.0.0'
const DATA_VERSION = '1.0.0'

class Core {
  version: string = DEFAULT_VERSION
  dataTransact: DataTransact = factory.transact
  elementPropsManager: ElementPropsManager = elementPropsManager
  systemEventManager: SystemEventManager = systemEventManager
  renderManager: RenderManager = renderManager
  sceneTreeManager: SceneTreeManager = sceneTreeManager
  elementSelectionManager: ElementSelectionManager = elementSelectionManager

  load(data: CoreRawData): void {
    if (!data) {
      return
    }

    this.version = data.version ?? DATA_VERSION
    if (data.props) {
      this.elementPropsManager.load(data.props)
    }

    if (data.sceneTree) {
      this.sceneTreeManager.load(data.sceneTree)
    } else {
      this.sceneTreeManager.init()
    }
    this.renderManager.zoomFit()
  }

  save() {
    const data = {
      version: this.version,
      sceneTree: this.sceneTreeManager.save(),
      props: this.elementPropsManager.save()
    }

    return data
  }

  async initRender(width: number, height: number, color: number) {
    return await this.renderManager.initRender(width, height, color)
  }

  setupInputSystem(watchedElement?: HTMLElement) {
    if (watchedElement) {
      inputSystem.switchWatchedElement(watchedElement)
    }
  }

  selectElement(elementIds: string[]) {
    this.elementSelectionManager.select(elementIds)
  }

  changeComputedData(key: string, data: DataTypes) {
    this.sceneTreeManager.changeComputedData(key, data)
  }
}

export { Core }
const core = new Core()
export default core
