import { EVENT_OPTIONS } from '@asyra/utils'

export interface ElementSelectionActionAPIs {
  selectElements: (elementIds: string[], options?: EVENT_OPTIONS) => void
}

export type ElementSelectionAPIs = ElementSelectionActionAPIs
