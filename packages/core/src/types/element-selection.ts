import { EVENT_OPTIONS } from '@asyra/utils'

export interface ElementSelectionActionAPIs {
  selectElements: (elementIds: string[], options?: EVENT_OPTIONS) => void
  selectVectorPoints: (pointIds: string[], options?: EVENT_OPTIONS) => void
  selectVectorSegments: (segmentIds: string[], options?: EVENT_OPTIONS) => void
}

export type ElementSelectionAPIs = ElementSelectionActionAPIs
