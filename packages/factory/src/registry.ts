import * as Y from 'yjs'
import doc from './data'
import { SceneTreeChange } from './change-types'

const UNDO_CAPTURE_TIMEOUT = 0
const sceneTreeChange = doc.getArray<SceneTreeChange>('sceneTreeChanges')
const sceneTreeChangesManager = new Y.UndoManager(sceneTreeChange, {
  captureTimeout: UNDO_CAPTURE_TIMEOUT
})

export { sceneTreeChange, sceneTreeChangesManager }
