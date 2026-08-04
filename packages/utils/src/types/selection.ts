import type { MutationOptions } from './change.js'
import type { YjsChange } from './yjs.js'

export type SelectionChannel = string
export type SelectionAction = string

export interface SelectionChangePayload {
  selectionType: SelectionChannel
  action: SelectionAction
  eventName: string
  before: string[]
  after: string[]
  options?: MutationOptions
}

// Backward-compatible alias for existing integrations.
export type ElementSelectionChange = SelectionChangePayload
export type SelectionChange = SelectionChangePayload
export interface SelectionYjsChange extends YjsChange<SelectionChangePayload> {}
