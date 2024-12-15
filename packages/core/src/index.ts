import sceneTree, { SceneTree } from '@asra/scene-tree'
import { EntityTypes } from '@asra/utils'

type CoreRawData = {
  version: string
  sceneTree: { [key: string]: any }
}

type CoreDataType = Partial<CoreRawData>

const DEFAULT_VERSION = '1.0.0'
const DATA_VERSION = '1.0.0'

class Core {
  version: string = DEFAULT_VERSION
  sceneTree: SceneTree = sceneTree

  constructor() {
    this._init()
  }

  _init(): void {}

  load(data: CoreDataType): void {
    if (!data) {
      return
    }

    this.version = data.version ?? DATA_VERSION
    if (data.sceneTree) {
      this.sceneTree.load(data.sceneTree)
    }
  }

  addRectangle(): void {
    this.sceneTree.addRectangle({ type: EntityTypes.RECTANGLE })
  }
}

export default Core
