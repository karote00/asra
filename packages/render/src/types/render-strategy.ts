import type { Graphics } from 'pixi.js'
import type { RenderElementData } from '../types'

export type RenderStrategy = (graphic: Graphics, data: RenderElementData) => void
