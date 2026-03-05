import { EVENT_OPTIONS } from '@asyra/utils'

export interface ElementSelectionActionAPIs {
  selectByChannel: (
    channel: string,
    ids: string[],
    options?: EVENT_OPTIONS
  ) => void
  selectElements: (elementIds: string[], options?: EVENT_OPTIONS) => void
  selectVectorPoints: (pointIds: string[], options?: EVENT_OPTIONS) => void
  selectVectorSegments: (segmentIds: string[], options?: EVENT_OPTIONS) => void
}

export type ElementSelectionAPIs = ElementSelectionActionAPIs
