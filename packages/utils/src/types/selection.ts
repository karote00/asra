import { OWNER, SELECTION_ACTIONS } from '../constants'
import type { YjsChange } from './yjs'

export interface ElementSelectionChange {
  action: SELECTION_ACTIONS
  owner: OWNER
  eventName: string
  before: string[]
  after: string[]
}

export type SelectionChange = ElementSelectionChange
export interface SelectionYjsChange extends YjsChange<ElementSelectionChange> {}
