import {
  addRectangle,
  changeComputedData,
  endTransaction,
  requestElementSelection,
  sceneTreeLoadComplete,
  selectElements,
  startTransaction
} from '@asra/reactive-events'
import type { SceneTree } from '@asra/scene-tree'
import { CreateRectangleData, DataTypes, SceneTreeRawData } from '@asra/utils'

export default class SceneTreeManager {
  sceneTree: SceneTree

  constructor(sceneTree: SceneTree) {
    this.sceneTree = sceneTree
  }

  init() {
    this.sceneTree.init()
    sceneTreeLoadComplete()
  }

  load(data: SceneTreeRawData) {
    this.sceneTree.load(data)
    sceneTreeLoadComplete()
  }

  save() {
    return this.sceneTree.save()
  }

  async addRectangle(data: CreateRectangleData) {
    return await addRectangle(data)
  }

  async changeComputedData(key: string, data: DataTypes) {
    startTransaction()
    const elementIds = await requestElementSelection()
    changeComputedData(elementIds, key, data)
    endTransaction()
  }
}
