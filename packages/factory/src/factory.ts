import * as Y from 'yjs'
import doc from './data'
import DataTransact from './data-transact'
import type { SceneTreeChange } from './change-types'
import { sceneTreeChange } from './registry'

class Factory {
  sceneTreeMap: Y.Array<SceneTreeChange> = sceneTreeChange
  transact: DataTransact = new DataTransact(doc)

  constructor() {
    this._init()
  }

  _init() {
    // init
  }
}

export default new Factory()
