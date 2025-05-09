import factory, { Factory } from '@asra/factory'
import InputSystem from '@asra/input-system'
import sceneTree from '@asra/scene-tree'
import render, { Render } from '@asra/render'
import type {
  CreateRectangleData,
  DataTypes,
  PositionData,
  PropsComponentRawData,
  SceneTreeRawData
} from '@asra/utils'

import SceneTreeManager from './scene-tree-manager'
import ElementPropsManager from './element-props-manager'
import combinations from './combinations'

import { initShortcuts } from './shortcuts'
import { CoreAPIs } from './types/core-apis'

const inputSystem = new InputSystem(combinations)
const sceneTreeManager = new SceneTreeManager(sceneTree)
const elementPropsManager = new ElementPropsManager()

import { createAPIs } from './apis'

interface CoreRawData {
  version: string
  sceneTree: SceneTreeRawData
  props: PropsComponentRawData
}

const DEFAULT_VERSION = '1.0.0'
const DATA_VERSION = '1.0.0'

class Core implements CoreAPIs {
  version: string = DEFAULT_VERSION
  inputSystem: InputSystem = inputSystem
  factory: Factory = factory
  propsManager: ElementPropsManager = elementPropsManager
  render: Render = render
  sceneTree: SceneTreeManager = sceneTreeManager

  // Render APIs
  initRender!: (width: number, height: number, color: number) => Promise<any>
  getViewportPosition!: () => Promise<PositionData>
  getViewportScale!: () => Promise<number>
  zoomFit!: () => void
  panTo!: (x: number, y: number) => void
  zoomToCenter!: (scale: number, centerX: number, centerY: number) => void

  // Undo APIs
  undo!: () => void
  redo!: () => void

  // SceneTree APIs
  addRectangle!: (data: CreateRectangleData) => void

  // ElementSelection APIs
  selectElements!: (elementIds: string[]) => void

  constructor() {
    const apis = createAPIs()

    initShortcuts(
      {
        inputSystem: this.inputSystem,
        render: this.render,
        factory: this.factory
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
      this.propsManager.load(data.props)
    }

    if (data.sceneTree) {
      this.sceneTree.load(data.sceneTree)
    } else {
      this.sceneTree.init()
    }

    this.zoomFit()
  }

  save() {
    const data = {
      version: this.version,
      sceneTree: this.sceneTree.save(),
      props: this.propsManager.save()
    }

    return data
  }

  setupInputSystem(watchedElement?: HTMLElement) {
    if (watchedElement) {
      inputSystem.switchWatchedElement(watchedElement)
    }
  }

  changeComputedData(key: string, data: DataTypes) {
    this.sceneTree.changeComputedData(key, data)
  }
}

export { Core }

const core = new Core()
export default core
