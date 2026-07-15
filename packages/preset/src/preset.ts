import './components'
import './props/components'
import { createPixiRenderEngine } from '@asyra/render-engine-pixi'
import { registerEvents } from './events/register-events'
import { registerPropertySchemas } from './props/register-property-schemas'
import {
  registerSelectionOverlayRenderLayer,
  registerVectorPathEditingRenderLayer
} from './render-layers'
import {
  registerDefaultDataChannelObservers,
  registerDefaultRenderSystemSubscriptions,
  registerDefaultSharedDataChannels
} from './subscriptions'
import { registerSelections } from './selection/register-default-selections'
import { registerProperties } from './ui/register-properties'
import type {
  ApplyPresetOptions,
  PresetCoreAPIs,
  PresetDependencies
} from './types'

const isApplyPresetOptions = (
  value: PresetDependencies | ApplyPresetOptions
): value is ApplyPresetOptions => 'renderEngineFactory' in value

const resolvePresetComposition = (
  core: PresetCoreAPIs,
  dependenciesOrOptions?: PresetDependencies | ApplyPresetOptions
): Required<Pick<ApplyPresetOptions, 'renderEngineFactory'>> & {
  dependencies: PresetDependencies
} => {
  if (!dependenciesOrOptions) {
    return {
      dependencies: core.getPresetDependencies(),
      renderEngineFactory: createPixiRenderEngine
    }
  }
  if (isApplyPresetOptions(dependenciesOrOptions)) {
    return {
      dependencies:
        dependenciesOrOptions.dependencies ?? core.getPresetDependencies(),
      renderEngineFactory: dependenciesOrOptions.renderEngineFactory
    }
  }

  return {
    dependencies: dependenciesOrOptions,
    renderEngineFactory: createPixiRenderEngine
  }
}

export const applyPreset = (
  core: PresetCoreAPIs,
  dependenciesOrOptions?: PresetDependencies | ApplyPresetOptions
): void => {
  const { dependencies: resolvedDeps, renderEngineFactory } =
    resolvePresetComposition(core, dependenciesOrOptions)
  resolvedDeps.render.setEngineFactory(renderEngineFactory)
  registerEvents(core)

  registerSelections(core)
  registerPropertySchemas(core)
  registerProperties(core)
  registerDefaultSharedDataChannels()
  registerDefaultRenderSystemSubscriptions(core, resolvedDeps)
  registerDefaultDataChannelObservers(core, resolvedDeps)
  registerSelectionOverlayRenderLayer(
    (registration, options) => core.registerRenderLayer(registration, options),
    {
      render: resolvedDeps.render,
      sceneTree: resolvedDeps.sceneTree,
      systemContext: resolvedDeps.systemContext,
      getSelection: (type) => core.getSelection(type)
    }
  )
  registerVectorPathEditingRenderLayer(
    (registration, options) => core.registerRenderLayer(registration, options),
    {
      getSelection: (type) => core.getSelection(type),
      render: resolvedDeps.render,
      sceneTree: resolvedDeps.sceneTree,
      systemContext: resolvedDeps.systemContext
    }
  )
}
