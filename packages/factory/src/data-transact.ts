import * as Y from 'yjs'
import type {
  PropsChange,
  PropsYjsChange,
  SceneTreeChange,
  SceneTreeYjsChange,
  ElementSelectionChange,
  SelectionYjsChange
} from '@asyra/utils'
import { OWNER, UNDO } from '@asyra/utils'

type TransactionPayload = PropsChange | SceneTreeChange | ElementSelectionChange
import type { AllEvent, UpdateTransactionEvent } from '@asyra/reactive-events'
import {
  endTransaction,
  publishEvent,
  startTransaction,
  userActionCompleted,
  updateUndoRedoStatus
} from '@asyra/reactive-events'
import {
  sceneTreeChanges,
  elementSelectionChanges,
  propsChanges
} from './registry'

type YMapOrArray<T = unknown> = Y.Array<T> | Y.Map<T>

interface ChangesTypeMap {
  [OWNER.SCENE_TREE]: YMapOrArray<SceneTreeYjsChange>
  [OWNER.ELEMENT_SELECTION]: YMapOrArray<SelectionYjsChange>
  [OWNER.PROPS]: YMapOrArray<PropsYjsChange>
}

const ChangesMaps: ChangesTypeMap = {
  [OWNER.SCENE_TREE]: sceneTreeChanges,
  [OWNER.ELEMENT_SELECTION]: elementSelectionChanges,
  [OWNER.PROPS]: propsChanges
}

class DataTransact {
  private changes: AllEvent[] = []
  private undoStack: AllEvent[][] = []
  private redoStack: AllEvent[][] = []
  private isTransacting = 0
  private inUndo = false
  private inRedo = false
  private actionId = 0

  start() {
    this.isTransacting++
    if (this.isTransacting > 1) {
      return
    }

    this.changes = []
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

    if (!(event.options && !event.options.undoable)) {
      this.changes.push(newEvent)
    }

    const map = ChangesMaps[payload.owner as OWNER]
    if (map instanceof Y.Array) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      map.push([payload as any])
    }
  }

  end() {
    if (this.isTransacting <= 0) {
      return
    }

    this.isTransacting--

    if (this.isTransacting === 0) {
      this.commitUndo()
      this.changes = []
    }
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
  }

  reset() {
    this.dispose()
  }
}

export default DataTransact
