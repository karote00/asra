import * as Y from 'yjs'
import type {
  PropsYjsChange,
  SceneTreeYjsChange,
  SelectionYjsChange
} from '@asra/utils'
import type { AllEvent, UpdateTransactionEvent } from '@asra/reactive-events'
import { publishEvent, updateUndoRedoStatus } from '@asra/reactive-events'
import { OWNER, UNDO } from '@asra/utils'
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
  private isTransacting = false
  private inUndo = false
  private inRedo = false

  start() {
    if (this.isTransacting) {
      return
    }

    this.isTransacting = true
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
    if (!this.isTransacting) {
      return
    }

    this.isTransacting = false
    this.commitUndo()
    this.changes = []
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
    this.changes = []
    this.inUndo = false

    updateUndoRedoStatus(UNDO.NONE)
  }

  redo() {
    if (!this.redoStack.length) {
      return
    }

    this.inRedo = true
    updateUndoRedoStatus(UNDO.REDO)
    const lastChanges = this.redoStack.pop() as AllEvent[]

    for (const event of lastChanges) {
      const redoEvent = JSON.parse(JSON.stringify(event))
      publishEvent(redoEvent)
    }

    this.undoStack.push(lastChanges)
    this.changes = []
    this.inRedo = false
    updateUndoRedoStatus(UNDO.NONE)
  }

  isInUndo() {
    return this.inUndo
  }

  isInRedo() {
    return this.inRedo
  }
}

export default DataTransact
