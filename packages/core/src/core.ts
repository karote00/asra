import factory, { Factory } from '@asra/factory'
import InputSystem from '@asra/input-system'
import sceneTree from '@asra/scene-tree'
import render from '@asra/render'
import type {
  CreateRectangleData,
  DataTypes,
  PositionData,
  PropsComponentRawData,
  SceneTreeRawData
} from '@asra/utils'

import RenderManager from './render-manager'
import SceneTreeManager from './scene-tree-manager'
import ElementSelectionManager from './element-selection-manager'
import ElementPropsManager from './element-props-manager'
import combinations from './combinations'

import { initShortcuts } from './shortcuts'
import {
  endTransaction,
  selectElements,
  startTransaction
} from '@asra/reactive-events'
import { CoreAPIs } from './types/core-apis'

const inputSystem = new InputSystem(combinations)
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
  inputSystem: InputSystem = inputSystem
  factory: Factory = factory
  propsManager: ElementPropsManager = elementPropsManager
  render: RenderManager = renderManager
  sceneTree: SceneTreeManager = sceneTreeManager
  elementSelection: ElementSelectionManager = elementSelectionManager

  constructor() {
    initShortcuts(this.inputSystem, this.getAPIs())
  }

  getAPIs(): CoreAPIs {
    return {
      undo: () => this.undo(),
      redo: () => this.redo(),
      getViewportPosition: () => this.getViewportPosition(),
      getViewportScale: () => this.getViewportScale(),
      zoomFit: () => this.zoomFit(),
      panTo: (x: number, y: number) => this.panTo(x, y),
      zoomToCenter: (scale: number, centerX: number, centerY: number) =>
        this.zoomToCenter(scale, centerX, centerY)
    }
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
    this.render.zoomFit()
  }

  save() {
    const data = {
      version: this.version,
      sceneTree: this.sceneTree.save(),
      props: this.propsManager.save()
    }

    return data
  }

  async initRender(width: number, height: number, color: number) {
    return await this.render.initRender(width, height, color)
  }

  setupInputSystem(watchedElement?: HTMLElement) {
    if (watchedElement) {
      inputSystem.switchWatchedElement(watchedElement)
    }
  }

  undo() {
    this.factory.undo()
  }

  redo() {
    this.factory.redo()
  }

  getViewportPosition(): PositionData {
    return this.render.getViewportPosition()
  }

  getViewportScale(): number {
    return this.render.getViewportScale()
  }

  zoomFit() {
    this.render.zoomFit()
  }

  panTo(x: number, y: number) {
    this.render.panTo(x, y)
  }

  zoomToCenter(scale: number, centerX: number, centerY: number) {
    this.render.zoomToCenter(scale, centerX, centerY)
  }

  async addRectangle(data: CreateRectangleData) {
    startTransaction()
    const newElementId = await this.sceneTree.addRectangle(data)
    selectElements([newElementId])
    endTransaction()
  }

  selectElement(elementIds: string[]) {
    this.elementSelection.select(elementIds)
  }

  changeComputedData(key: string, data: DataTypes) {
    this.sceneTree.changeComputedData(key, data)
  }
}

export { Core }
const core = new Core()

export default core
