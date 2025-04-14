import { Vec2, Rect, Bounds } from './types'

export function rectToBounds(rect: Rect): Bounds {
  return {
    minX: rect.x,
    minY: rect.y,
    maxX: rect.x + rect.width,
    maxY: rect.y + rect.height
  }
}

export function boundsToRect(bounds: Bounds): Rect {
  return {
    x: bounds.minX,
    y: bounds.minY,
    width: bounds.maxX - bounds.minX,
    height: bounds.maxY - bounds.minY
  }
}

export function getCenter(rect: Rect): Vec2 {
  return {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2
  }
}

export function unionBounds(boundsList: Bounds[]): Bounds | undefined {
  if (boundsList.length === 0) return undefined

  return boundsList.reduce((acc, bounds) => ({
    minX: Math.min(acc.minX, bounds.minX),
    minY: Math.min(acc.minY, bounds.minY),
    maxX: Math.max(acc.maxX, bounds.maxX),
    maxY: Math.max(acc.maxY, bounds.maxY)
  }))
}

export function scaleRect(rect: Rect, scale: number): Rect {
  return {
    x: rect.x * scale,
    y: rect.y * scale,
    width: rect.width * scale,
    height: rect.height * scale
  }
}

export function translateRect(rect: Rect, offset: Vec2): Rect {
  return {
    x: rect.x + offset.x,
    y: rect.y + offset.y,
    width: rect.width,
    height: rect.height
  }
}
