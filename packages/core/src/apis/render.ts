import { renderIsReady } from '@asyra/reactive-events'
import type { PositionData } from '@asyra/utils'
import type {
  CreateRenderGradientFillOptions,
  RenderFillStyle
} from '@asyra/render'
import type {
  RegisterRenderLayerOptions,
  RenderLayerRegistration
} from '../types/render'

export interface RenderRequests {
  initRender: (width: number, height: number, color: number) => Promise<unknown>
  getViewportPosition: () => PositionData
  getViewportScale: () => number
  registerRenderLayer: (
    registration: RenderLayerRegistration,
    options?: RegisterRenderLayerOptions
  ) => void
  unregisterRenderLayer: (name: string) => boolean
  createRenderGradientFillStyle: (
    options: CreateRenderGradientFillOptions
  ) => RenderFillStyle
}

export const createRenderAPIs = (requests: RenderRequests) => {
  return {
    renderIsReady() {
      renderIsReady()
    },
    async initRender(width: number, height: number, color: number) {
      return await requests.initRender(width, height, color)
    },
    registerRenderLayer(
      registration: RenderLayerRegistration,
      options?: RegisterRenderLayerOptions
    ) {
      requests.registerRenderLayer(registration, options)
    },
    unregisterRenderLayer(name: string) {
      return requests.unregisterRenderLayer(name)
    },
    createRenderGradientFillStyle(options: CreateRenderGradientFillOptions) {
      return requests.createRenderGradientFillStyle(options)
    }
  }
}
