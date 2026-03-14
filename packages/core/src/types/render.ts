import type {
  CreateRenderGradientFillOptions,
  RenderFillStyle,
  EvenOddFillOptions,
  EvenOddFillResult
} from '@asyra/render'

export interface RenderLayerRegistration {
  name: string
  layer: unknown
  zIndex?: number
  update?: () => void
}

export interface RegisterRenderLayerOptions {
  override?: boolean
}

export interface RenderRawAPIs {
  initRender: (width: number, height: number, color: number) => Promise<unknown>
  renderIsReady: () => void
  registerRenderLayer: (
    registration: RenderLayerRegistration,
    options?: RegisterRenderLayerOptions
  ) => void
  unregisterRenderLayer: (name: string) => boolean
  createRenderGradientFillStyle: (
    options: CreateRenderGradientFillOptions
  ) => RenderFillStyle
  createEvenOddFillStyle: (
    options: EvenOddFillOptions
  ) => EvenOddFillResult | null
}

export type RenderAPIs = RenderRawAPIs
