import * as Y from 'yjs'
import type { SceneTreeYjsChange, SelectionYjsChange } from '@asra/utils'
import type { UpdateTransactionEvent } from '@asra/reactive-events'
import DataTransact from './data-transact'
import { sceneTreeChanges, elementSelectionChanges } from './registry'

class Factory {
  sceneTreeMap: Y.Array<SceneTreeYjsChange> = sceneTreeChanges
  elementSelectionMap: Y.Array<SelectionYjsChange> = elementSelectionChanges
  transact: DataTransact = new DataTransact()

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
