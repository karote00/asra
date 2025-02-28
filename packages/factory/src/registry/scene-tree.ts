import * as Y from 'yjs'
import { SceneTreeYjsChange } from '@asra/utils'
import doc from '../data'
import { UNDO_CAPTURE_TIMEOUT } from './constants'

export const sceneTreeChange =
  doc.getArray<SceneTreeYjsChange>('sceneTreeChanges')
export const sceneTreeChangesManager = new Y.UndoManager(sceneTreeChange, {
  captureTimeout: UNDO_CAPTURE_TIMEOUT
})
