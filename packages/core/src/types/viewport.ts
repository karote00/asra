import { PositionData } from '@asyra/utils'

export interface ViewportRawAPIs {
  getViewportPosition: () => PositionData
  getViewportScale: () => number
}

export interface ViewportActionAPIs {
  // zoomFit: () => void
}

export type ViewportAPIs = ViewportRawAPIs & ViewportActionAPIs
