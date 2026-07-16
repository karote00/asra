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
  PresetCompositionSuccess,
  PresetCoreAPIs,
  PresetDependencies
} from './types'
import { resolvePresetComposition } from './composition/resolve'
import { installCapabilityBundles } from './composition/bundles'
import {
  createCleanupError,
  createLayerInstallError,
  PresetCompositionError,
  withCompletedCompositionCleanup
} from './composition/error'
import { createPresetCompositionSuccess } from './composition/result'

const refKey = (ref: RegistrationRef): string => `${ref.kind}\u0000${ref.key}`

interface PresetCleanupEntry {
  key: string
  dispose: () => void
  completed: boolean
}

type RegisterPresetCleanup = (key: string, dispose: () => void) => void

interface SharedPresetGroup {
  id: string
  install(): void
}

interface PresetCleanupApplication {
  dispose(): PresetApplicationDisposeSuccess
  getCompletedCleanup(): readonly string[]
}

interface PresetCleanupContext {
  operation: 'apply-preset' | 'dispose-preset'
  engineId?: string
  capabilityBundles: readonly string[]
  completedLayers: readonly string[]
  applyError?: unknown
}

const pendingRollbackApplications = new WeakMap<
  PresetCoreAPIs,
  PresetCleanupApplication
>()

const createSharedPresetGroups = (
  core: PresetCoreAPIs,
  resolvedDeps: PresetDependencies,
  registerCleanup: RegisterPresetCleanup
): readonly SharedPresetGroup[] => [
  {
    id: 'events',
    install: () => registerCleanup('events', registerEvents(core))
  },
  {
    id: 'property-schemas',
    install: () => registerPropertySchemas(core)
  },
  {
    id: 'property-components',
    install: () => registerPropertyComponents(core)
  },
  {
    id: 'components',
    install: () => {
      DEFAULT_COMPONENT_DEFINITIONS.forEach((definition) => {
        core.defineComponent(definition)
      })
    }
  },
  {
    id: 'render-strategies',
    install: () => {
      DEFAULT_RENDER_STRATEGY_REGISTRATIONS.forEach(
        ({ type, strategy, registration }) => {
          core.registerRenderStrategy(type, strategy, registration)
        }
      )
    }
  },
  {
    id: 'selections',
    install: () => registerCleanup('selections', registerSelections(core))
  },
  {
    id: 'ui-properties',
    install: () => registerProperties(core)
  },
  {
    id: 'shared-data-channels',
    install: () =>
      registerCleanup(
        'shared-data-channels',
        registerDefaultSharedDataChannels(core)
      )
  },
  {
    id: 'render-system-subscriptions',
    install: () =>
      registerCleanup(
        'render-system-subscriptions',
        registerDefaultRenderSystemSubscriptions(core, resolvedDeps)
      )
  },
  {
    id: 'data-channel-observers',
    install: () =>
      registerCleanup(
        'data-channel-observers',
        registerDefaultDataChannelObservers(core, resolvedDeps)
      )
  },
  {
    id: 'render-layers',
    install: () => {
      registerCleanup(
        'render-layer:selection-overlay',
        registerTrackedRenderLayer(core, (registerRenderLayer) => {
          registerSelectionOverlayRenderLayer(registerRenderLayer, {
            render: resolvedDeps.render,
            sceneTree: resolvedDeps.sceneTree,
            systemContext: resolvedDeps.systemContext,
            getSelection: (type) => core.getSelection(type)
          })
        })
      )
      registerCleanup(
        'render-layer:vector-path-editing',
        registerTrackedRenderLayer(core, (registerRenderLayer) => {
          registerVectorPathEditingRenderLayer(registerRenderLayer, {
            getSelection: (type) => core.getSelection(type),
            render: resolvedDeps.render,
            sceneTree: resolvedDeps.sceneTree,
            systemContext: resolvedDeps.systemContext
          })
        })
      )
    }
  }
]

const installSharedPresetDefaults = (
  core: PresetCoreAPIs,
  resolvedDeps: PresetDependencies,
  engineId: string,
  capabilityBundles: readonly string[],
  registerCleanup: RegisterPresetCleanup,
  reportCompletedGroup: (groupId: string) => void
): readonly string[] => {
  const completedGroups: string[] = []
  createSharedPresetGroups(core, resolvedDeps, registerCleanup).forEach(
    (group) => {
      try {
        group.install()
      } catch (cause) {
        throw createLayerInstallError({
          message: `Shared preset defaults group "${group.id}" failed to install`,
          layer: 'shared-defaults',
          engineId,
          capabilityBundles,
          completedLayers: completedGroups.map(
            (groupId) => `shared-defaults:${groupId}`
          ),
          cause
        })
      }
      completedGroups.push(group.id)
      reportCompletedGroup(group.id)
    }
  )
  return completedGroups
}

const registerTrackedRenderLayer = (
  core: PresetCoreAPIs,
  install: (registerRenderLayer: PresetCoreAPIs['registerRenderLayer']) => void
): (() => void) => {
  const registeredLayerNames: string[] = []
  let disposed = false
  const dispose = (): void => {
    if (disposed) return
    for (let index = registeredLayerNames.length - 1; index >= 0; index--) {
      core.unregisterRenderLayer(registeredLayerNames[index])
      registeredLayerNames.splice(index, 1)
    }
    disposed = true
  }

  try {
    install((registration, options) => {
      core.registerRenderLayer(registration, options)
      registeredLayerNames.push(registration.name)
    })
  } catch (error) {
    dispose()
    throw error
  }

  return dispose
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

const createPresetApplicationLifetime = (
  core: PresetCoreAPIs,
  registrationsBeforeApply: ReadonlySet<string>,
  cleanupEntries: PresetCleanupEntry[],
  context: PresetCleanupContext
): PresetCleanupApplication => {
  const ownedRefs = core
    .getRegistrations()
    .filter(
      ({ ref, owner }) =>
        !registrationsBeforeApply.has(refKey(ref)) &&
        owner.packageName === PRESET_REGISTRATION_OWNER.packageName &&
        owner.name === PRESET_REGISTRATION_OWNER.name
    )
    .map(({ ref }) => ref)
  const registrationEntries = ownedRefs.map((registration) => ({
    key: `registration:${registration.kind}:${registration.key}`,
    registration,
    completed: false
  }))
  const allCleanupEntries = [...registrationEntries, ...cleanupEntries]
  let disposed = false

  return {
    getCompletedCleanup: () =>
      allCleanupEntries
        .filter(({ completed }) => completed)
        .map(({ key }) => key),
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
      const cleanupFailures: { key: string; cause: unknown }[] = []

      ;[...registrationEntries].reverse().forEach((entry) => {
        if (entry.completed) return
        try {
          const registration = core.getRegistration(entry.registration)
          if (
            !registration ||
            registration.owner.packageName !==
              PRESET_REGISTRATION_OWNER.packageName ||
            registration.owner.name !== PRESET_REGISTRATION_OWNER.name
          ) {
            skipped.push(entry.registration)
            entry.completed = true
            return
          }
          unregisterPresetRegistration(core, entry.registration)
          entry.completed = true
          removed.push(entry.registration)
        } catch (cause) {
          cleanupFailures.push({ key: entry.key, cause })
        }
      })

      if (cleanupFailures.length === 0) {
        ;[...cleanupEntries].reverse().forEach((entry) => {
          if (entry.completed) return
          try {
            entry.dispose()
            entry.completed = true
          } catch (cause) {
            cleanupFailures.push({ key: entry.key, cause })
          }
        })
      }

      if (cleanupFailures.length > 0) {
        throw createCleanupError({
          ...context,
          completedCleanup: allCleanupEntries
            .filter(({ completed }) => completed)
            .map(({ key }) => key),
          pendingCleanup: allCleanupEntries
            .filter(({ completed }) => !completed)
            .map(({ key }) => key),
          cleanupFailures
        })
      }

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
  const pendingRollback = pendingRollbackApplications.get(core)
  if (pendingRollback) {
    pendingRollback.dispose()
    pendingRollbackApplications.delete(core)
  }

  const registrationsBeforeApply = new Set(
    core.getRegistrations().map(({ ref }) => refKey(ref))
  )
  const {
    dependencies: resolvedDeps,
    engineId,
    renderEngineFactory,
    capabilityBundles
  } = resolvePresetComposition(core, dependenciesOrOptions)

  const cleanupEntries: PresetCleanupEntry[] = []
  const registerCleanup: RegisterPresetCleanup = (key, dispose) => {
    cleanupEntries.push({ key, dispose, completed: false })
  }
  let compositionSuccess: PresetCompositionSuccess
  const completedLayers: string[] = []

  try {
    const sharedGroups = installSharedPresetDefaults(
      core,
      resolvedDeps,
      engineId,
      capabilityBundles.map(({ id }) => id),
      registerCleanup,
      (groupId) => completedLayers.push(`shared-defaults:${groupId}`)
    )
    const disposeEngineProvider =
      resolvedDeps.render.setEngineFactory(renderEngineFactory)
    if (typeof disposeEngineProvider !== 'function') {
      throw createLayerInstallError({
        message: 'Render did not return engine-provider cleanup ownership',
        layer: 'concrete-engine',
        engineId,
        capabilityBundles: capabilityBundles.map(({ id }) => id),
        completedLayers: sharedGroups.map(
          (groupId) => `shared-defaults:${groupId}`
        )
      })
    }
    registerCleanup('render-engine-provider', disposeEngineProvider)
    completedLayers.push(`concrete-engine:${engineId}`)
    const bundleInstallations = installCapabilityBundles({
      core,
      dependencies: resolvedDeps,
      engineId,
      bundles: capabilityBundles,
      completedLayers: [
        ...sharedGroups.map((groupId) => `shared-defaults:${groupId}`),
        `concrete-engine:${engineId}`
      ],
      registerCleanup
    })
    completedLayers.push(
      ...bundleInstallations.map(({ id }) => `capability-bundle:${id}`)
    )
    compositionSuccess = createPresetCompositionSuccess({
      engineId,
      sharedGroups,
      capabilityBundles: bundleInstallations.map(({ id }) => id)
    })
  } catch (error) {
    const failureCompletedLayers =
      error instanceof PresetCompositionError
        ? error.result.completedLayers
        : completedLayers
    const rollbackApplication = createPresetApplicationLifetime(
      core,
      registrationsBeforeApply,
      cleanupEntries,
      {
        operation: 'apply-preset',
        engineId,
        capabilityBundles: capabilityBundles.map(({ id }) => id),
        completedLayers: failureCompletedLayers,
        applyError: error
      }
    )
    try {
      rollbackApplication.dispose()
    } catch (cleanupError) {
      pendingRollbackApplications.set(core, rollbackApplication)
      throw cleanupError
    }
    if (error instanceof PresetCompositionError) {
      throw withCompletedCompositionCleanup(
        error,
        rollbackApplication.getCompletedCleanup()
      )
    }
    throw error
  }

  const lifetime = createPresetApplicationLifetime(
    core,
    registrationsBeforeApply,
    cleanupEntries,
    {
      operation: 'dispose-preset',
      engineId: compositionSuccess.engineId,
      capabilityBundles: compositionSuccess.capabilityBundles,
      completedLayers: compositionSuccess.order
    }
  )
  return {
    result: compositionSuccess,
    dispose: () => lifetime.dispose()
  }
}
