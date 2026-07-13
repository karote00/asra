import type {
  RegisterRenderLayerOptions,
  RenderLayerRegistration
} from '@asyra/core'
import core from '../contexts'

export const renderLayerApis = {
  registerRenderLayer: (
    registration: RenderLayerRegistration,
    options?: RegisterRenderLayerOptions
  ) => {
    core.registerRenderLayer(registration, options)
  },
  unregisterRenderLayer: (name: string) => {
    return core.unregisterRenderLayer(name)
  }
}
