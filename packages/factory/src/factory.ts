import * as Y from 'yjs'
import type { UpdateTransactionEvent } from '@asyra/reactive-events'
import DataTransact from './data-transact'
import doc from './data'
import {
  SharedDataChannelRegistry,
  type SharedDataChannelChangeHandler,
  type SharedDataChannelName
} from './shared-data-channel'

class Factory {
  private readonly sharedDataChannels = new SharedDataChannelRegistry()
  transact: DataTransact

  constructor() {
    this.transact = new DataTransact(this.sharedDataChannels)
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

  undo() {
    this.transact.undo()
  }

  redo() {
    this.transact.redo()
  }

  isInUndoRedo() {
    return this.transact.isInUndo() || this.transact.isInRedo()
  }

  registerSharedDataChannel(
    name: SharedDataChannelName,
    channel: Y.Array<unknown>
  ): void {
    this.sharedDataChannels.register(name, channel)
  }

  unregisterSharedDataChannel(name: SharedDataChannelName): boolean {
    return this.sharedDataChannels.unregister(name)
  }

  hasSharedDataChannel(name: SharedDataChannelName): boolean {
    return this.sharedDataChannels.has(name)
  }

  getYjsDataChannel(name: SharedDataChannelName): Y.Array<unknown> {
    return doc.getArray(name)
  }

  getSharedDataChannel(
    name: SharedDataChannelName
  ): Y.Array<unknown> | undefined {
    return this.sharedDataChannels.get(name)
  }

  getSharedDataChannelStrict(name: SharedDataChannelName): Y.Array<unknown> {
    return this.sharedDataChannels.import(name)
  }

  observeSharedDataChannel<TChange = unknown>(
    name: SharedDataChannelName,
    handler: SharedDataChannelChangeHandler<TChange>
  ): () => void {
    return this.sharedDataChannels.observe(name, handler)
  }
}

const factory = new Factory()
export default factory

export { Factory }
