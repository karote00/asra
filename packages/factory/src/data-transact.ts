import * as Y from 'yjs'
import { CHANGES } from './enum'
import { SceneTreeChange } from './change-types'
import { sceneTreeChangesMap } from './registry'

type ObjectDataType = Record<string, string | number>
type ChangeDataType = SceneTreeChange | ObjectDataType

interface Change {
  data: ChangeDataType
}

type YMapOrArray<T = unknown> = Y.Array<T> | Y.Map<T>

interface ChangesTypeMap {
  [CHANGES.SCENE_TREE]: YMapOrArray<SceneTreeChange>
}

const ChangesMaps: ChangesTypeMap = {
  [CHANGES.SCENE_TREE]: sceneTreeChangesMap
}

class DataTransact {
  private doc: Y.Doc
  private changes: Record<string, Change[]> = {}
  private isTransacting = false

  constructor(doc: Y.Doc) {
    this.doc = doc
  }

  start() {
    if (this.isTransacting) {
      return
    }

    this.isTransacting = true
    this.changes = {}
  }

  update(type: CHANGES, change: ChangeDataType) {
    if (!this.isTransacting) {
      throw new Error('Transaction not started. Call start first.')
    }
    if (!this.changes[type]) {
      this.changes[type] = []
    }
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

    this.changes = {}
  }
}

export default DataTransact
