import type { YjsChange } from './yjs'

export interface ElementSelectionChange {}

export type SelectionChange = ElementSelectionChange
export interface SelectionYjsChange extends YjsChange<ElementSelectionChange> {}
