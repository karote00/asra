import { createPixiRenderEngine } from '@asyra/render-engine-pixi'
import { RegistrationRelationError, type RegistrationRef } from '@asyra/utils'
import { registerEvents } from './events/register-events'
import {
  DEFAULT_COMPONENT_DEFINITIONS,
  DEFAULT_RENDER_STRATEGY_REGISTRATIONS
} from './components'
import { registerPropertyComponents } from './props/components'
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
import { PRESET_REGISTRATION_OWNER } from './registration'
import type {
  ApplyPresetOptions,
  PresetApplication,
  PresetApplicationDisposeSuccess,
  PresetCoreAPIs,
  PresetDependencies
} from './types'

const refKey = (ref: RegistrationRef): string => `${ref.kind}\u0000${ref.key}`

const isApplyPresetOptions = (
  value: PresetDependencies | ApplyPresetOptions
): value is ApplyPresetOptions =>
  'renderEngineFactory' in value || 'dependencies' in value

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
      renderEngineFactory:
        dependenciesOrOptions.renderEngineFactory ?? createPixiRenderEngine
    }
  }

  return {
    dependencies: dependenciesOrOptions,
    renderEngineFactory: createPixiRenderEngine
  }
}

const installPresetRegistrations = (core: PresetCoreAPIs): void => {
  registerPropertySchemas(core)
  registerPropertyComponents(core)

  DEFAULT_COMPONENT_DEFINITIONS.forEach((definition) => {
    core.defineComponent(definition)
  })
  DEFAULT_RENDER_STRATEGY_REGISTRATIONS.forEach(
    ({ type, strategy, registration }) => {
      core.registerRenderStrategy(type, strategy, registration)
    }
  )
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

const unregisterPresetRegistration = (
  core: PresetCoreAPIs,
  ref: RegistrationRef
): void => {
  switch (ref.kind) {
    case 'component':
      core.unregisterComponent(ref.key)
      return
    case 'feature':
      core.unregisterFeature(ref.key)
      return
    case 'property':
      core.unregisterPropertyType(ref.key)
      return
    case 'render-strategy':
      core.unregisterRenderStrategy(ref.key)
      return
    case 'ui-property':
      core.unregisterUIProperty(ref.key)
      return
    default:
      throw new RegistrationRelationError({
        ok: false,
        code: 'UNREGISTER_FAILED',
        operation: 'unregister-registration',
        message: `Preset registration "${ref.kind}:${ref.key}" has no cleanup owner`,
        registration: ref
      })
  }
}

const createPresetApplication = (
  core: PresetCoreAPIs,
  registrationsBeforeApply: ReadonlySet<string>
): PresetApplication => {
  const ownedRefs = core
    .getRegistrations()
    .filter(
      ({ ref, owner }) =>
        !registrationsBeforeApply.has(refKey(ref)) &&
        owner.packageName === PRESET_REGISTRATION_OWNER.packageName &&
        owner.name === PRESET_REGISTRATION_OWNER.name
    )
    .map(({ ref }) => ref)
  let disposed = false

  return {
    dispose(): PresetApplicationDisposeSuccess {
      if (disposed) {
        return {
          ok: true,
          operation: 'dispose-preset',
          removed: [],
          skipped: [...ownedRefs]
        }
      }

      const removed: RegistrationRef[] = []
      const skipped: RegistrationRef[] = []
      ;[...ownedRefs].reverse().forEach((ref) => {
        if (!core.getRegistration(ref)) {
          skipped.push(ref)
          return
        }
        unregisterPresetRegistration(core, ref)
        removed.push(ref)
      })
      disposed = true
      return {
        ok: true,
        operation: 'dispose-preset',
        removed,
        skipped
      }
    }
  }
}

export const applyPreset = (
  core: PresetCoreAPIs,
  dependenciesOrOptions?: PresetDependencies | ApplyPresetOptions
): PresetApplication => {
  const registrationsBeforeApply = new Set(
    core.getRegistrations().map(({ ref }) => refKey(ref))
  )
  const { dependencies: resolvedDeps, renderEngineFactory } =
    resolvePresetComposition(core, dependenciesOrOptions)

  resolvedDeps.render.setEngineFactory(renderEngineFactory)
  registerEvents(core)

  try {
    installPresetRegistrations(core)
    registerSelections(core)
    registerPresetRuntimeWiring(core, resolvedDeps)
  } catch (error) {
    createPresetApplication(core, registrationsBeforeApply).dispose()
    throw error
  }

  return createPresetApplication(core, registrationsBeforeApply)
}
