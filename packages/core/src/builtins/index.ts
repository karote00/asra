import type { Render } from '@asyra/render'
import type {
  RegisterRenderLayerOptions,
  RenderLayerRegistration
} from '../types/render'
import { registerVectorEditingRenderLayer } from './vector/register-render-layer'

type RegisterRenderLayer = (
  registration: RenderLayerRegistration,
  options?: RegisterRenderLayerOptions
) => void

export const registerBuiltinRenderLayers = (
  registerRenderLayer: RegisterRenderLayer,
  render: Render
) => {
  registerVectorEditingRenderLayer(registerRenderLayer, render)
}
