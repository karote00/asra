import * as Y from 'yjs'
import { PropsYjsChange } from '@asyra/utils'
import doc from '../data'
import { UNDO_CAPTURE_TIMEOUT } from './constants'

export const propsChanges = doc.getArray<PropsYjsChange>('propsChanges')
export const propsChangesManager = new Y.UndoManager(propsChanges, {
  captureTimeout: UNDO_CAPTURE_TIMEOUT
})
