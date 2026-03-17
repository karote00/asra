import { renderIsReady } from '@asyra/reactive-events'
import type { PositionData } from '@asyra/utils'
import type {
  CreateRenderGradientFillOptions,
  RenderFillStyle,
  RenderInteractionTarget,
  RenderInteractionHandlerRegistration,
  RenderInteractionEventType
} from '@asyra/render'
import type { EvenOddFillOptions, EvenOddFillResult } from '@asyra/render'
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
  createEvenOddFillStyle: (
    options: EvenOddFillOptions
  ) => EvenOddFillResult | null
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
    },
    createEvenOddFillStyle(options: EvenOddFillOptions) {
      return requests.createEvenOddFillStyle(options)
    },
    registerRenderInteractionTargets(
      targets: RenderInteractionTarget | RenderInteractionTarget[],
      options?: { override?: boolean }
    ) {
      requests.registerRenderInteractionTargets(targets, options)
    },
    updateRenderInteractionTarget(
      targetId: string,
      patch:
        | Partial<RenderInteractionTarget>
        | ((
            current: RenderInteractionTarget
          ) => Partial<RenderInteractionTarget>)
    ) {
      requests.updateRenderInteractionTarget(targetId, patch)
    },
    unregisterRenderInteractionTarget(targetId: string) {
      return requests.unregisterRenderInteractionTarget(targetId)
    },
    clearRenderInteractionTargets() {
      requests.clearRenderInteractionTargets()
    },
    registerRenderInteractionHandler(
      targetId: string | RegExp,
      registration: RenderInteractionHandlerRegistration
    ) {
      requests.registerRenderInteractionHandler(targetId, registration)
    },
    unregisterRenderInteractionHandler(
      targetId: string,
      eventType?: RenderInteractionEventType
    ) {
      requests.unregisterRenderInteractionHandler(targetId, eventType)
    }
  }
}
