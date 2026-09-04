import type { Core } from '@asyra/core'
import { applyPreset, PresetProfiles } from '@asyra/preset'
import type { RenderEngineProvider } from '@asyra/render-engine'
import { ThreeEngine } from '../engine/three-engine'
import { SpatialLayer, SPATIAL_LAYER_NAME } from '../render-app/spatial-layer'

const FRAME_REVISION = 'asyra-sim.render-revision'

export function installCustomRenderer(
  core: Core,
  provider: RenderEngineProvider = () => new ThreeEngine()
): { layer: SpatialLayer; dispose: () => void } {
  applyPreset(core, { profile: PresetProfiles.CUSTOM, defaults: [] })
  core.setRenderEngineProvider(provider)
  core.defineSystemProperty(FRAME_REVISION, 0, { runtime: true, silent: true })
  let revision = 0
  let disposed = false
  const layer = new SpatialLayer(() => {
    core.setSystemProperty(FRAME_REVISION, ++revision)
  })
  core.registerRenderLayer(layer.registration)
  return {
    layer,
    dispose: () => {
      if (disposed) return
      disposed = true
      core.unregisterRenderLayer(SPATIAL_LAYER_NAME)
      layer.dispose()
    }
  }
}
