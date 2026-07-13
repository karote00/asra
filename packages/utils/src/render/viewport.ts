import { PositionData } from '../types'
import { DEFAULT_CANVAS_PADDING } from './constants'

export interface Bounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface ViewportState {
  scale: number
  position: PositionData
}

export const rectToBounds = (rect: Rect): Bounds => {
  return {
    minX: rect.x,
    minY: rect.y,
    maxX: rect.x + rect.width,
    maxY: rect.y + rect.height
  }
}

export const calculateZoomToCenter = (params: {
  currentScale: number
  currentPosition: PositionData
  nextScale: number
  center: PositionData
}): ViewportState => {
  const { currentScale, currentPosition, nextScale, center } = params

  const worldX = (center.x - currentPosition.x) / currentScale
  const worldY = (center.y - currentPosition.y) / currentScale

  return {
    scale: nextScale,
    position: {
      x: center.x - worldX * nextScale,
      y: center.y - worldY * nextScale
    }
  }
}

export const calculateZoomFit = (params: {
  elementsBounds: Bounds
  viewportBounds: Bounds
  padding?: number
}): ViewportState => {
  const { elementsBounds, viewportBounds } = params
  const padding = params.padding ?? DEFAULT_CANVAS_PADDING

  const availableWidth = viewportBounds.maxX - viewportBounds.minX - padding * 2
  const availableHeight =
    viewportBounds.maxY - viewportBounds.minY - padding * 2

  const contentWidth = elementsBounds.maxX - elementsBounds.minX
  const contentHeight = elementsBounds.maxY - elementsBounds.minY

  const scaleX = availableWidth / contentWidth
  const scaleY = availableHeight / contentHeight
  const scale = Math.min(scaleX, scaleY)

  const offsetX = viewportBounds.minX + padding - elementsBounds.minX * scale
  const offsetY = viewportBounds.minY + padding - elementsBounds.minY * scale

  return {
    scale,
    position: { x: offsetX, y: offsetY }
  }
}
