import { Events } from '../../combinations'
import { PositionData, WheelEventData } from '@asra/utils'
import { HandlerDeps } from '../../types/core-apis'

const ZOOM_SMOOTH_RATIO = 0.02

interface ViewportHandlerDeps {
  getViewportPosition: () => PositionData
  getViewportScale: () => number
  zoomFit: () => void
  panTo: (x: number, y: number) => void
  zoomToCenter: (scale: number, centerX: number, centerY: number) => void
}

export class ViewportHandler {
  constructor(
    private inputSystem: HandlerDeps['inputSystem'],
    private deps: ViewportHandlerDeps
  ) {
    this.init()
  }

  init() {
    this.inputSystem.on(Events.ZOOM_FIT, this._handleZoomFit)
    this.inputSystem.on(Events.PAN, this._handlePan)
    this.inputSystem.on(Events.ZOOM, this._handleZoom)
  }

  _handleZoomFit = () => {
    this.deps.zoomFit()
  }

  _handlePan = (data: WheelEventData) => {
    const { deltaX, deltaY } = data
    const currentPosition = this.deps.getViewportPosition()
    this.deps.panTo(currentPosition.x - deltaX, currentPosition.y - deltaY)
  }

  _handleZoom = (data: WheelEventData) => {
    const { deltaY, clientX, clientY } = data
    const currentScale = this.deps.getViewportScale()
    // Adjust zoom scale based on wheel direction. deltaY > 0 means scrolling up (zoom in)
    // Using a smaller scale factor (1.05) for smoother zooming
    const newScale =
      currentScale *
      (deltaY > 0 ? 1 + ZOOM_SMOOTH_RATIO : 1 - ZOOM_SMOOTH_RATIO)
    this.deps.zoomToCenter(newScale, clientX, clientY)
  }
}
