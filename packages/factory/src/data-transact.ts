import type {
  ComputedDataPatchChange,
  PropsChange,
  SceneTreeChange,
  ElementSelectionChange,
  UpdateElementPatchChange
} from '@asyra/utils'
import { UNDO } from '@asyra/utils'

type TransactionPayload = PropsChange | SceneTreeChange | ElementSelectionChange
interface PendingSharedChannelChange {
  name: string
  change: TransactionPayload
}
import type { AllEvent, UpdateTransactionEvent } from '@asyra/reactive-events'
import {
  endTransaction,
  publishEvent,
  startTransaction,
  userActionCompleted,
  updateUndoRedoStatus
} from '@asyra/reactive-events'
import type { SharedDataChannelRegistry } from './shared-data-channel'

const toSharedChannelPayload = (
  payload: TransactionPayload,
  options: UpdateTransactionEvent['options']
): TransactionPayload => {
  if (!options) {
    return payload
  }

  const { shared: _shared, ...payloadOptions } = options
  const hasPayloadOptions = Object.keys(payloadOptions).length > 0
  if (!hasPayloadOptions) {
    return payload
  }

  return {
    ...payload,
    options: {
      ...(payload.options ?? {}),
      ...payloadOptions
    }
  } as TransactionPayload
}

const invertComputedDataPatchChange = (
  patch: ComputedDataPatchChange
): ComputedDataPatchChange => {
  const inverted: ComputedDataPatchChange = {}

  Object.entries(patch.values ?? {}).forEach(([key, change]) => {
    inverted.values ??= {}
    inverted.values[key] = {
      before: change.after,
      after: change.before
    }
  })

  Object.entries(patch.records ?? {}).forEach(([key, recordPatch]) => {
    const nextRecordPatch: NonNullable<
      ComputedDataPatchChange['records']
    >[string] = {}

    Object.entries(recordPatch.set ?? {}).forEach(([recordId, change]) => {
      if (change.before === undefined) {
        nextRecordPatch.remove ??= {}
        nextRecordPatch.remove[recordId] = {
          before: change.after
        }
        return
      }

      nextRecordPatch.set ??= {}
      nextRecordPatch.set[recordId] = {
        before: change.after,
        after: change.before
      }
    })

    Object.entries(recordPatch.remove ?? {}).forEach(([recordId, change]) => {
      nextRecordPatch.set ??= {}
      nextRecordPatch.set[recordId] = {
        after: change.before
      }
    })

    if (
      Object.keys(nextRecordPatch.set ?? {}).length > 0 ||
      Object.keys(nextRecordPatch.remove ?? {}).length > 0
    ) {
      inverted.records ??= {}
      inverted.records[key] = nextRecordPatch
    }
  })

  return inverted
}

class DataTransact {
  private changes: AllEvent[] = []
  private undoStack: AllEvent[][] = []
  private redoStack: AllEvent[][] = []
  private isTransacting = 0
  private inUndo = false
  private inRedo = false
  private actionId = 0
  private pendingSharedChannelChanges: PendingSharedChannelChange[] = []
  private readonly sharedDataChannelRegistry: Pick<
    SharedDataChannelRegistry,
    'pushToSharedChannel'
  >

  constructor(
    sharedDataChannelRegistry?: Pick<
      SharedDataChannelRegistry,
      'pushToSharedChannel'
    >
  ) {
    this.sharedDataChannelRegistry = sharedDataChannelRegistry ?? {
      pushToSharedChannel: () => false
    }
  }

  start() {
    this.isTransacting++
    if (this.isTransacting > 1) {
      return
    }

    this.changes = []
    this.pendingSharedChannelChanges = []
  }

  update(event: UpdateTransactionEvent) {
    if (this.isTransacting <= 0) {
      return
    }

    const payload = event.payload as TransactionPayload
    const newType = event.eventName as AllEvent['type']
    const newPayload = JSON.parse(JSON.stringify(payload))
    const newEvent: AllEvent = {
      type: newType,
      payload: newPayload
    }

    if (event.options?.undoable !== false) {
      this.changes.push(newEvent)
    }

    const sharedChannelName = event.options?.shared
    if (sharedChannelName) {
      const sharedChange = toSharedChannelPayload(payload, event.options)
      if (event.options?.undoable === false) {
        this.sharedDataChannelRegistry.pushToSharedChannel(
          sharedChannelName,
          sharedChange
        )
        return
      }

      this.pendingSharedChannelChanges.push({
        name: sharedChannelName,
        change: sharedChange
      })
    }
  }

  end() {
    if (this.isTransacting <= 0) {
      return
    }

    this.isTransacting--

    if (this.isTransacting === 0) {
      this.commitUndo()
      this.flushPendingSharedChannelChanges()
      this.changes = []
    }
  }

  flushPendingSharedChannelChanges() {
    const pendingChanges = this.pendingSharedChannelChanges
    this.pendingSharedChannelChanges = []

    pendingChanges.forEach(({ name, change }) => {
      this.sharedDataChannelRegistry.pushToSharedChannel(name, change)
    })
  }

  commitUndo() {
    // If changes are coming from Undo or Redo events, they should not push back to list again
    if (!this.isInUndo() && !this.isInRedo() && this.changes.length > 0) {
      const committedChanges = this.changes

      this.undoStack.push(committedChanges)
      this.changes = []
      this.redoStack = []

      this.actionId += 1
      userActionCompleted({
        actionId: this.actionId,
        changeCount: committedChanges.length,
        timestamp: Date.now()
      })
    }
  }

  undo() {
    if (!this.undoStack.length) {
      return
    }

    startTransaction()

    this.inUndo = true
    updateUndoRedoStatus(UNDO.UNDO)

    const lastChanges = this.undoStack.pop() as AllEvent[]
    for (let i = lastChanges.length - 1; i >= 0; i--) {
      const event = lastChanges[i]
      const undoEvent = JSON.parse(JSON.stringify(event))

      if (undoEvent.payload.undoType !== undefined) {
        undoEvent.type = undoEvent.payload.undoType
      }
      if (undoEvent.payload.undoAction !== undefined) {
        undoEvent.payload.action = undoEvent.payload.undoAction
      }
      if (undoEvent.payload.after !== undefined) {
        undoEvent.payload.after = undoEvent.payload.before
      }
      if (
        typeof undoEvent.payload === 'object' &&
        undoEvent.payload !== null &&
        'patch' in undoEvent.payload
      ) {
        ;(undoEvent.payload as UpdateElementPatchChange).patch =
          invertComputedDataPatchChange(
            (undoEvent.payload as UpdateElementPatchChange).patch
          )
      }

      publishEvent(undoEvent)
    }

    this.redoStack.push(lastChanges)

    endTransaction()

    updateUndoRedoStatus(UNDO.NONE)

    this.changes = []
    this.inUndo = false
  }

  redo() {
    if (!this.redoStack.length) {
      return
    }

    startTransaction()

    this.inRedo = true
    updateUndoRedoStatus(UNDO.REDO)

    const lastChanges = this.redoStack.pop() as AllEvent[]
    for (const event of lastChanges) {
      const redoEvent = JSON.parse(JSON.stringify(event))
      publishEvent(redoEvent)
    }

    this.undoStack.push(lastChanges)
    endTransaction()

    updateUndoRedoStatus(UNDO.NONE)

    this.changes = []
    this.inRedo = false
  }

  isInUndo() {
    return this.inUndo
  }

  isInRedo() {
    return this.inRedo
  }

  dispose() {
    this.changes = []
    this.undoStack = []
    this.redoStack = []
    this.isTransacting = 0
    this.inUndo = false
    this.inRedo = false
    this.actionId = 0
    this.pendingSharedChannelChanges = []
  }

  reset() {
    this.dispose()
  }
}

export default DataTransact
