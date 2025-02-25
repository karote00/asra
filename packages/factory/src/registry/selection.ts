import * as Y from 'yjs'
import { SelectionYjsChange } from '@asra/utils'
import doc from '../data'
import { UNDO_CAPTURE_TIMEOUT } from './constants'

const selectionChange = doc.getArray<SelectionYjsChange>('selectionChange')
const selectionChangeManager = new Y.UndoManager(selectionChange, {
  captureTimeout: UNDO_CAPTURE_TIMEOUT
})

export { selectionChange, selectionChangeManager }
