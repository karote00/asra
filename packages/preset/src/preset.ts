import './components'
import './props/components'
import { registerEvents } from './events/register-events'
import { registerPropertySchemas } from './props/register-property-schemas'
import { registerVectorPathEditingRenderLayer } from './render-layers'
import {
  registerDefaultDataChannelObservers,
  registerDefaultRenderSystemSubscriptions,
  registerDefaultSharedDataChannels
} from './subscriptions'
import { registerSelections } from './selection/register-default-selections'
import { registerProperties } from './ui/register-properties'
import type { PresetCoreAPIs, PresetDependencies } from './types'

const resolvePresetDependencies = (
  core: PresetCoreAPIs,
  deps?: PresetDependencies
): PresetDependencies => {
  if (deps) {
    return deps
  }

  return core.getPresetDependencies()
}

export const applyPreset = (
  core: PresetCoreAPIs,
  deps?: PresetDependencies
): void => {
  const resolvedDeps = resolvePresetDependencies(core, deps)
  registerEvents(core)

  registerSelections(core)
  registerPropertySchemas(core)
  registerProperties(core)
  registerDefaultSharedDataChannels()
  registerDefaultRenderSystemSubscriptions(core, resolvedDeps)
  registerDefaultDataChannelObservers(core, resolvedDeps)
  registerVectorPathEditingRenderLayer(
    (registration, options) => core.registerRenderLayer(registration, options),
    {
      render: resolvedDeps.render,
      sceneTree: resolvedDeps.sceneTree,
      systemContext: resolvedDeps.systemContext
    }
  )
}
