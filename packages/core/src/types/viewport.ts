import { PositionData } from '@asyra/utils'

export interface ViewportRawAPIs {
  getViewportPosition: () => PositionData
  getViewportScale: () => number
}

export interface ViewportActionAPIs {
  // Action APIs can be added here as needed
}

export type ViewportAPIs = ViewportRawAPIs & ViewportActionAPIs
