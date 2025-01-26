import * as Y from 'yjs'
import { SceneTreeYjsChange } from '@asra/utils'
import doc from './data'

const UNDO_CAPTURE_TIMEOUT = 0
const sceneTreeChange = doc.getArray<SceneTreeYjsChange>('sceneTreeChanges')
const sceneTreeChangesManager = new Y.UndoManager(sceneTreeChange, {
  captureTimeout: UNDO_CAPTURE_TIMEOUT
})

export { sceneTreeChange, sceneTreeChangesManager }
