import * as Y from 'yjs'
import type { SceneTreeYjsChange } from '@asra/utils'
import type { UpdateTransactionEvent } from '@asra/reactive-events'
import DataTransact from './data-transact'
import { sceneTreeChange } from './registry'

class Factory {
  sceneTreeMap: Y.Array<SceneTreeYjsChange> = sceneTreeChange
  transact: DataTransact = new DataTransact()

  constructor() {
    this._init()
  }

  _init() {
    // init
  }

  startTransaction() {
    this.transact.start()
  }

  updateTransaction(event: UpdateTransactionEvent) {
    this.transact.update(event)
  }

  endTransaction() {
    this.transact.end()
  }
}

export default new Factory()
