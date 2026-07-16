import type { RenderElementData } from '../types'
import type { EngineNeutralRenderStrategy } from '../types/render-strategy'
import type { RenderGraphics } from '../types/render-object'

const randomHexColorCode = () => {
  const n = (Math.random() * 0xfffff * 1000000).toString(16)
  return '#' + n.slice(0, 6)
}

const toFiniteNumber = (value: unknown, fallback = 0) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback

export const defaultRectangleStrategy: EngineNeutralRenderStrategy = (
  graphic: RenderGraphics,
  data: RenderElementData
) => {
  const width = Math.max(0, toFiniteNumber(data.width))
  const height = Math.max(0, toFiniteNumber(data.height))
  graphic.rect(0, 0, width, height).fill(randomHexColorCode())
  graphic.x = toFiniteNumber(data.x)
  graphic.y = toFiniteNumber(data.y)
}

// Fallback for unknown types
export const defaultStrategy = defaultRectangleStrategy
