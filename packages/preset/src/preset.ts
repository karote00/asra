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
import { resolvePresetComposition } from './composition/resolve'

const refKey = (ref: RegistrationRef): string => `${ref.kind}\u0000${ref.key}`

interface PresetCleanupEntry {
  key: string
  dispose: () => void
  completed: boolean
}

type RegisterPresetCleanup = (key: string, dispose: () => void) => void

const pendingRollbackApplications = new WeakMap<
  PresetCoreAPIs,
  PresetApplication
>()

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
  resolvedDeps: PresetDependencies,
  registerCleanup: RegisterPresetCleanup
): void => {
  registerProperties(core)
  registerCleanup(
    'shared-data-channels',
    registerDefaultSharedDataChannels(core)
  )
  registerCleanup(
    'render-system-subscriptions',
    registerDefaultRenderSystemSubscriptions(core, resolvedDeps)
  )
  registerCleanup(
    'data-channel-observers',
    registerDefaultDataChannelObservers(core, resolvedDeps)
  )
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

const createPresetApplication = (
  core: PresetCoreAPIs,
  registrationsBeforeApply: ReadonlySet<string>,
  cleanupEntries: PresetCleanupEntry[]
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
      const cleanupFailures: { key: string; cause: unknown }[] = []
      const pendingCleanup: string[] = []

      ;[...ownedRefs].reverse().forEach((ref) => {
        try {
          const registration = core.getRegistration(ref)
          if (
            !registration ||
            registration.owner.packageName !==
              PRESET_REGISTRATION_OWNER.packageName ||
            registration.owner.name !== PRESET_REGISTRATION_OWNER.name
          ) {
            skipped.push(ref)
            return
          }
          unregisterPresetRegistration(core, ref)
          removed.push(ref)
        } catch (cause) {
          const key = `registration:${ref.kind}:${ref.key}`
          cleanupFailures.push({ key, cause })
          pendingCleanup.push(key)
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
            pendingCleanup.push(entry.key)
          }
        })
      }

      if (cleanupFailures.length > 0) {
        throw new RegistrationRelationError({
          ok: false,
          code: 'UNREGISTER_FAILED',
          operation: 'unregister-registration',
          message: 'Preset disposal has pending lifecycle cleanup',
          registration: { kind: 'preset', key: PRESET_REGISTRATION_OWNER.name },
          cleanupFailures,
          pendingCleanup
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
  const { dependencies: resolvedDeps, renderEngineFactory } =
    resolvePresetComposition(core, dependenciesOrOptions)

  resolvedDeps.render.setEngineFactory(renderEngineFactory)
  const cleanupEntries: PresetCleanupEntry[] = []
  const registerCleanup: RegisterPresetCleanup = (key, dispose) => {
    cleanupEntries.push({ key, dispose, completed: false })
  }

  try {
    registerCleanup('events', registerEvents(core))
    installPresetRegistrations(core)
    registerCleanup('selections', registerSelections(core))
    registerPresetRuntimeWiring(core, resolvedDeps, registerCleanup)
  } catch (error) {
    const rollbackApplication = createPresetApplication(
      core,
      registrationsBeforeApply,
      cleanupEntries
    )
    try {
      rollbackApplication.dispose()
    } catch (cleanupError) {
      pendingRollbackApplications.set(core, rollbackApplication)
      if (cleanupError instanceof RegistrationRelationError) {
        throw new RegistrationRelationError({
          ...cleanupError.result,
          cause: {
            applyError: error,
            cleanupError: cleanupError.result.cause
          }
        })
      }
      throw cleanupError
    }
    throw error
  }

  return createPresetApplication(core, registrationsBeforeApply, cleanupEntries)
}
