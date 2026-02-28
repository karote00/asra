import './components'
import './props/components'
import { registerEvents } from './events/register-events'
import { registerPropertySchemas } from './props/register-property-schemas'
import { registerVectorPathEditingRenderLayer } from './render-layers'
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

  if (core.getPresetDependencies) {
    return core.getPresetDependencies()
  }

  throw new Error(
    '[preset] Missing preset dependencies. Provide deps argument or core.getPresetDependencies().'
  )
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
  registerVectorPathEditingRenderLayer(
    (registration, options) => core.registerRenderLayer(registration, options),
    {
      render: resolvedDeps.render,
      sceneTree: resolvedDeps.sceneTree,
      systemContext: resolvedDeps.systemContext
    }
  )
}
