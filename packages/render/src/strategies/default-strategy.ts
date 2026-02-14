import type { Graphics } from 'pixi.js'
import type { RenderElementData } from '../types'
import type { RenderStrategy } from '../types/render-strategy'

const randomHexColorCode = () => {
    const n = (Math.random() * 0xfffff * 1000000).toString(16)
    return '#' + n.slice(0, 6)
}

export const defaultRectangleStrategy: RenderStrategy = (
    graphic: Graphics,
    data: RenderElementData
) => {
    graphic.rect(0, 0, data.width, data.height).fill(randomHexColorCode())
    graphic.x = data.x
    graphic.y = data.y
}

// Fallback for unknown types
export const defaultStrategy = defaultRectangleStrategy
