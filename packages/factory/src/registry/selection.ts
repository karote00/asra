import * as Y from 'yjs'
import { SelectionYjsChange } from '@asra/utils'
import doc from '../data'
import { UNDO_CAPTURE_TIMEOUT } from './constants'

export const elementSelectionChanges =
  doc.getArray<SelectionYjsChange>('selectionChanges')
export const elementSelectionChangeManager = new Y.UndoManager(
  elementSelectionChanges,
  {
    captureTimeout: UNDO_CAPTURE_TIMEOUT
  }
)
