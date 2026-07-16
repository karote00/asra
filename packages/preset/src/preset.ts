import './components'
import { createPixiRenderEngine } from '@asyra/render-engine-pixi'
import { registerEvents } from './events/register-events'
import {
  createPresetExtensionRegistry,
  registerPresetExtensions
} from './extension-targets'
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
  PresetApplication,
  PresetCoreAPIs,
  PresetDependencies
} from './types'

const isApplyPresetOptions = (
  value: PresetDependencies | ApplyPresetOptions
): value is ApplyPresetOptions =>
  'renderEngineFactory' in value ||
  'dependencies' in value ||
  'extensions' in value

const resolvePresetComposition = (
  core: PresetCoreAPIs,
  dependenciesOrOptions?: PresetDependencies | ApplyPresetOptions
): Required<Pick<ApplyPresetOptions, 'renderEngineFactory'>> & {
  dependencies: PresetDependencies
  extensions: ApplyPresetOptions['extensions']
} => {
  if (!dependenciesOrOptions) {
    return {
      dependencies: core.getPresetDependencies(),
      renderEngineFactory: createPixiRenderEngine,
      extensions: undefined
    }
  }
  if (isApplyPresetOptions(dependenciesOrOptions)) {
    return {
      dependencies:
        dependenciesOrOptions.dependencies ?? core.getPresetDependencies(),
      renderEngineFactory:
        dependenciesOrOptions.renderEngineFactory ?? createPixiRenderEngine,
      extensions: dependenciesOrOptions.extensions
    }
  }

  return {
    dependencies: dependenciesOrOptions,
    renderEngineFactory: createPixiRenderEngine,
    extensions: undefined
  }
}

const registerPresetRuntimeWiring = (
  core: PresetCoreAPIs,
  resolvedDeps: PresetDependencies
): void => {
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

export const applyPreset = (
  core: PresetCoreAPIs,
  dependenciesOrOptions?: PresetDependencies | ApplyPresetOptions
): PresetApplication => {
  const {
    dependencies: resolvedDeps,
    renderEngineFactory,
    extensions = []
  } = resolvePresetComposition(core, dependenciesOrOptions)
  const extensionRegistry = createPresetExtensionRegistry()
  registerPresetExtensions(extensionRegistry, extensions)

  resolvedDeps.render.setEngineFactory(renderEngineFactory)
  registerEvents(core)

  registerSelections(core)
  const application = extensionRegistry.apply({
    core,
    dependencies: resolvedDeps
  })
  try {
    registerPresetRuntimeWiring(core, resolvedDeps)
  } catch (error) {
    application.dispose()
    throw error
  }

  return application
}
