import * as Y from 'yjs'
import { CHANGES } from './enum'
import { SceneTreeChange } from './change-types'
import { sceneTreeChange, sceneTreeChangesManager } from './registry'

type ObjectDataType = Record<string, string | number>
export type ChangeDataType = SceneTreeChange | ObjectDataType

interface Change {
  type?: CHANGES
  data: ChangeDataType
}

type ChangesData = Record<string, Change[]>

type YMapOrArray<T = unknown> = Y.Array<T> | Y.Map<T>

interface ChangesTypeMap {
  [CHANGES.SCENE_TREE]: YMapOrArray<SceneTreeChange>
}

const ChangesMaps: ChangesTypeMap = {
  [CHANGES.SCENE_TREE]: sceneTreeChange
}

const UndoManagers = {
  [CHANGES.SCENE_TREE]: sceneTreeChangesManager
}

class DataTransact {
  private doc: Y.Doc
  private changes: ChangesData = {}
  private undoStack: ChangesData[][] = []
  private isTransacting = false

  constructor(doc: Y.Doc) {
    this.doc = doc
  }

  start() {
    if (this.isTransacting) {
      return
    }

    this.isTransacting = true
    this.changes = { all: [] }
  }

  update(type: CHANGES, change: ChangeDataType) {
    if (!this.isTransacting) {
      throw new Error('Transaction not started. Call start first.')
    }
    if (!this.changes[type]) {
      this.changes[type] = []
    }
    this.changes.all.push({ type: type, data: change })
    this.changes[type].push({ data: change })
  }

  end() {
    if (!this.isTransacting) {
      return
    }

    this.isTransacting = false
    this.doc.transact(() => {
      Object.keys(this.changes).forEach((changeType) => {
        const map = ChangesMaps[changeType as CHANGES]
        this.changes[changeType].forEach(({ data }) => {
          if (map instanceof Y.Array) {
            map.push([data as SceneTreeChange])
          }
        })
      })
    })

    this.commitUndo()
    this.changes = {}
  }

  commitUndo() {
    this.undoStack.push(JSON.parse(JSON.stringify(this.changes.all)))
  }

  undo() {
    if (!this.undoStack.length) {
      return
    }

    const lastChanges = this.undoStack.pop() as ChangesData[]
    this.doc.transact(() => {
      lastChanges.forEach(({ type }: Partial<Change>) => {
        const undoManager = UndoManagers[type as CHANGES]
        undoManager.undo()
      })
    })

    this.changes = {}
  }

  redo() {
    // TODO: Redo
  }
}

export default DataTransact
