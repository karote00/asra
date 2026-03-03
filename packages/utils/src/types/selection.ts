import { SELECTION_ACTIONS, SELECTION_TYPES } from '../constants'
import type { MutationOptions } from './change'
import type { YjsChange } from './yjs'

export interface SelectionChangePayload {
  selectionType: SELECTION_TYPES
  action: SELECTION_ACTIONS
  eventName: string
  before: string[]
  after: string[]
  options?: MutationOptions
}

// Backward-compatible alias for existing integrations.
export type ElementSelectionChange = SelectionChangePayload
export type SelectionChange = SelectionChangePayload
export interface SelectionYjsChange extends YjsChange<SelectionChangePayload> {}
