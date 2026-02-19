export interface RenderLayerRegistration {
  name: string
  layer: unknown
  zIndex?: number
  update?: () => void
}
