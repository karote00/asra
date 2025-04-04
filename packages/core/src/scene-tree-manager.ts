import {
  addRectangle,
  changeComputedData,
  endTransaction,
  sceneTreeLoadComplete,
  startTransaction
} from '@asra/reactive-events'
import sceneTree, { SceneTree } from '@asra/scene-tree'
import { DataTypes, SceneTreeRawData } from '@asra/utils'

export default class SceneTreeManager {
  sceneTree: SceneTree = sceneTree

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

  addRectangle() {
    startTransaction()
    addRectangle()
    endTransaction()
  }

  changeComputedData(key: string, data: DataTypes) {
    startTransaction()
    changeComputedData(key, data)
    endTransaction()
  }
}
