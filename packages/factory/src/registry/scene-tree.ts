import * as Y from 'yjs'
import { SceneTreeYjsChange } from '@asyra/utils'
import doc from '../data'
import { UNDO_CAPTURE_TIMEOUT } from './constants'

export const sceneTreeChanges =
  doc.getArray<SceneTreeYjsChange>('sceneTreeChanges')

export const sceneTreeChangesManager = new Y.UndoManager(sceneTreeChanges, {
  captureTimeout: UNDO_CAPTURE_TIMEOUT
})
