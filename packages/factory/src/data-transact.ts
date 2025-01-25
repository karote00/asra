import * as Y from 'yjs'
import { OWNER, UNDO } from '@asra/utils'
import type { SceneTreeYjsChange } from '@asra/utils'
import type { AllEvent, UpdateTransactionEvent } from '@asra/reactive-events'
import { publishEvent } from '@asra/reactive-events'
import { sceneTreeChange } from './registry'

export type ChangeDataType = SceneTreeYjsChange

type YMapOrArray<T = unknown> = Y.Array<T> | Y.Map<T>

interface ChangesTypeMap {
  [OWNER.SCENE_TREE]: YMapOrArray<SceneTreeYjsChange>
}

const ChangesMaps: ChangesTypeMap = {
  [OWNER.SCENE_TREE]: sceneTreeChange
}

class DataTransact {
  private changes: AllEvent[] = []
  private undoStack: AllEvent[][] = []
  private isTransacting = false

  start() {
    if (this.isTransacting) {
      return
    }

    this.isTransacting = true
    this.changes = []
  }

  update(event: UpdateTransactionEvent) {
    if (!this.isTransacting) {
      throw new Error('Transaction not started. Call start first.')
    }

    const newType = event.eventName as AllEvent['type']
    const newPayload = JSON.parse(JSON.stringify(event.payload))
    // @ts-expect-error: Should accept any type of payload
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
    this.undoStack.push(JSON.parse(JSON.stringify(this.changes)))
  }

  undo() {
    if (!this.undoStack.length) {
      return
    }

    const lastChanges = this.undoStack.pop() as AllEvent[]

    for (let i = lastChanges.length - 1; i >= 0; i--) {
      const event = lastChanges[i]
      const undoEvent = JSON.parse(JSON.stringify(event))
      undoEvent.payload.undoredo = UNDO.UNDO
      undoEvent.type = undoEvent.payload.undoAction
      publishEvent(undoEvent)
    }

    this.changes = []
  }

  redo() {
    // TODO: Redo
  }
}

export default DataTransact
export const dataTransact = new DataTransact()
