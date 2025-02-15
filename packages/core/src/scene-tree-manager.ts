import { addRectangle, sceneTreeLoadComplete } from '@asra/reactive-events'
import sceneTree, { SceneTree } from '@asra/scene-tree'
import { SceneTreeRawData } from '@asra/utils'

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
    addRectangle()
  }
}
