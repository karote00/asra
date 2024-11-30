type SceneTreeData = {}

type SceneTreeDataType = Partial<SceneTreeData>

class SceneTree {
  constructor(data: SceneTreeDataType) {
    this._init(data)
  }

  _init(data: SceneTreeDataType) {}
}

interface SceneTree extends SceneTreeData {}

export default SceneTree
