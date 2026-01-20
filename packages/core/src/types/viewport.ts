import { PositionData } from '@asra/utils'

export interface ViewportRawAPIs {
  getViewportPosition: () => PositionData
  getViewportScale: () => number
}

export interface ViewportActionAPIs {
  zoomFit: () => void
  panTo: (x: number, y: number) => void
  zoomToCenter: (scale: number, centerX: number, centerY: number) => void
}

export type ViewportAPIs = ViewportRawAPIs & ViewportActionAPIs
