export interface RenderLayerRegistration {
  name: string
  layer: unknown
  zIndex?: number
  shouldUpdate?: () => boolean
  update?: () => boolean | undefined
}
