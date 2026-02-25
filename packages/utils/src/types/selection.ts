import { OWNER, SELECTION_ACTIONS } from '../constants'
import type { MutationOptions } from './change'
import type { YjsChange } from './yjs'

export interface ElementSelectionChange {
  action: SELECTION_ACTIONS
  owner: OWNER
  eventName: string
  before: string[]
  after: string[]
  options?: MutationOptions
}

export type SelectionChange = ElementSelectionChange
export interface SelectionYjsChange extends YjsChange<ElementSelectionChange> {}
