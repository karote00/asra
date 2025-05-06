import { PositionData } from '@asra/utils'

export interface CoreAPIs {
  undo: () => void
  redo: () => void
  getViewportPosition: () => PositionData
  getViewportScale: () => number
  zoomFit: () => void
  panTo: (x: number, y: number) => void
  zoomToCenter: (scale: number, centerX: number, centerY: number) => void
}
