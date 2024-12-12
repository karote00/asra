import * as Y from 'yjs'
import { SceneTreeNode } from './types'

const doc = new Y.Doc()

type FactoryProps = {
  version: string
  sceneTreeMap: Y.Map<SceneTreeNode>
}

class Factory {
  constructor() {
    this._init()
  }

  _init() {
    this.sceneTreeMap = doc.getMap<SceneTreeNode>('sceneTree')
  }
}

interface Factory extends FactoryProps {}

export default new Factory()
