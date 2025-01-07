import * as Y from 'yjs'
import { SceneTreeChange } from './change-types'
import { sceneTreeChange, sceneTreeChangesManager } from './registry'
import { OWNER } from '@asra/utils'

export type ChangeDataType = SceneTreeChange

interface Change {
  owner?: OWNER
  data: ChangeDataType
}

type ChangesData = Record<string, Change[]>

type YMapOrArray<T = unknown> = Y.Array<T> | Y.Map<T>

interface ChangesTypeMap {
  [OWNER.SCENE_TREE]: YMapOrArray<SceneTreeChange>
}

const ChangesMaps: ChangesTypeMap = {
  [OWNER.SCENE_TREE]: sceneTreeChange
}

const UndoManagers = {
  [OWNER.SCENE_TREE]: sceneTreeChangesManager
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

  update(owner: OWNER, change: ChangeDataType) {
    if (!this.isTransacting) {
      throw new Error('Transaction not started. Call start first.')
    }
    if (!this.changes[owner]) {
      this.changes[owner] = []
    }
    this.changes.all.push({ owner: owner, data: change })
    this.changes[owner].push({ data: change })
  }

  end() {
    if (!this.isTransacting) {
      return
    }

    this.isTransacting = false
    this.doc.transact(() => {
      Object.keys(this.changes).forEach((ownerType) => {
        const map = ChangesMaps[ownerType as OWNER]
        this.changes[ownerType].forEach(({ data }) => {
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
      lastChanges.forEach(({ owner, data }: Partial<Change>) => {
        console.log(owner, data)
        const undoManager = UndoManagers[owner as OWNER]
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
