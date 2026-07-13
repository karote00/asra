import type {
  CreateRenderGradientFillOptions,
  RenderFillStyle,
  EvenOddFillOptions,
  EvenOddFillResult,
  CreateMeshProjectionOptions,
  MeshProjection,
  RenderInteractionTarget,
  RenderInteractionHandlerRegistration,
  RenderInteractionEventType
} from '@asyra/render'

export interface RenderLayerRegistration {
  name: string
  layer: unknown
  zIndex?: number
  update?: () => boolean | undefined
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
  createMeshProjection: (options: CreateMeshProjectionOptions) => MeshProjection
  registerRenderInteractionTargets: (
    targets: RenderInteractionTarget | RenderInteractionTarget[],
    options?: { override?: boolean }
  ) => void
  updateRenderInteractionTarget: (
    targetId: string,
    patch:
      | Partial<RenderInteractionTarget>
      | ((current: RenderInteractionTarget) => Partial<RenderInteractionTarget>)
  ) => void
  unregisterRenderInteractionTarget: (targetId: string) => boolean
  clearRenderInteractionTargets: () => void
  registerRenderInteractionHandler: (
    targetId: string | RegExp,
    registration: RenderInteractionHandlerRegistration
  ) => void
  unregisterRenderInteractionHandler: (
    targetId: string,
    eventType?: RenderInteractionEventType
  ) => void
}

export type RenderAPIs = RenderRawAPIs
