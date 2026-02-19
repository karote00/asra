import type { Container } from 'pixi.js'

export interface RenderLayerRegistration {
  name: string
  layer: Container
  zIndex?: number
  update?: () => void
}
