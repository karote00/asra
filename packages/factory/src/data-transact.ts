import * as Y from 'yjs'
import type {
  PropsYjsChange,
  SceneTreeYjsChange,
  SelectionYjsChange
} from '@asra/utils'
import { OWNER, UNDO } from '@asra/utils'
import type { AllEvent, UpdateTransactionEvent } from '@asra/reactive-events'
import {
  endTransaction,
  publishEvent,
  startTransaction,
  updateUndoRedoStatus
} from '@asra/reactive-events'
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

  start() {
    this.isTransacting++
    if (this.isTransacting > 1) {
      return
    }

    this.changes = []
  }

  update(event: UpdateTransactionEvent) {
    if (!this.isTransacting) {
      return
    }

    const newType = event.eventName as AllEvent['type']
    const newPayload = JSON.parse(JSON.stringify(event.payload))
    const newEvent: AllEvent = {
      type: newType,
      payload: newPayload
    }

    this.changes.push(newEvent)

    const map = ChangesMaps[event.payload.owner as OWNER]
    if (map instanceof Y.Array) {
      map.push([event.payload])
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
    if (!this.isInUndo() && !this.isInRedo()) {
      this.undoStack.push(this.changes)
      this.changes = []
      this.redoStack = []
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
}

export default DataTransact
