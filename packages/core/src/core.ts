import factory, { Factory } from '@asra/factory'
import InputSystem from '@asra/input-system'
import sceneTree, { SceneTree } from '@asra/scene-tree'
import render, { Render } from '@asra/render'
import type {
  CreateRectangleData,
  DataTypes,
  PositionData,
  PropsComponentRawData,
  SceneTreeRawData
} from '@asra/utils'

import ElementPropsManager from './element-props-manager'
import combinations from './combinations'

import { initShortcuts } from './shortcuts'
import { CoreAPIs } from './types'

const inputSystem = new InputSystem(combinations)
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
  sceneTree: SceneTree = sceneTree

  // InputSystem APIs
  setupInputSystem!: (watchedElement?: HTMLElement) => void

  // Render APIs
  initRender!: (width: number, height: number, color: number) => Promise<any>
  renderIsReady!: () => void
  getViewportPosition!: () => Promise<PositionData>
  getViewportScale!: () => Promise<number>
  zoomFit!: () => void
  panTo!: (x: number, y: number) => void
  zoomToCenter!: (scale: number, centerX: number, centerY: number) => void

  // Undo APIs
  undo!: () => void
  redo!: () => void

  // SceneTree APIs
  initSceneTree!: () => void
  loadSceneTree!: (data: SceneTreeRawData) => void
  saveSceneTree!: () => SceneTreeRawData
  addRectangle!: (data: CreateRectangleData) => void
  changeComputedData!: (key: string, data: DataTypes) => void

  // ElementSelection APIs
  selectElements!: (elementIds: string[]) => void

  constructor() {
    const apis = createAPIs({
      inputSystem: this.inputSystem,
      sceneTree: this.sceneTree
    })

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
      props: this.propsManager.save()
    }

    return data
  }
}

export { Core }

const core = new Core()
export default core
