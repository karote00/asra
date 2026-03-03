import type {
  SystemContextSnapshot,
  SystemContextSnapshotWithDetail
} from '@asyra/utils'
import type { RawInputEvent } from '@asyra/utils'
import type {
  FeatureDefinition,
  FeatureAPI,
  FeatureKeyMap
} from '../types/feature'
import type { CorePackages } from '../types/core-packages'
import { FeatureRegistry } from './feature-registry'
import { SessionManager } from './session-manager'
import executionRegistry from './execution-registry'

const featureRegistry = new FeatureRegistry()
const sessionManager = new SessionManager()

let corePackages: CorePackages = {}
let isPackagesSet = false

const registeredEvents = new Set<string>()

const pendingRegistrations: {
  featureName: string
  keyConfig: FeatureKeyMap
  definition: FeatureDefinition<
    Record<string, unknown>,
    Record<string, unknown>
  >
}[] = []

function registerFeatureHandlers(
  name: string,
  keyConfig: FeatureKeyMap,
  definition: FeatureDefinition
) {
  const hasSession = !!definition.session
  const hasExecution = !!definition.execution
  const { priority = 0, exclusive = true } = definition

  if (!keyConfig) {
    return
  }

  let eventsToRegister: string[] = []

  if (hasSession) {
    const baseEvent = keyConfig
    eventsToRegister = [
      `${baseEvent}.start`,
      `${baseEvent}.update`,
      `${baseEvent}.end`
    ]
  } else if (hasExecution) {
    eventsToRegister = [keyConfig]
  } else {
    eventsToRegister = [keyConfig]
  }

  if (hasSession && definition.session) {
    sessionManager.registerSession(
      keyConfig,
      name,
      priority,
      exclusive,
      definition.session
    )
  }

  if (hasExecution && definition.execution) {
    for (const eventName of eventsToRegister) {
      executionRegistry.register(
        eventName,
        name,
        { priority, exclusive },
        definition.execution
      )
    }
  }

  const { inputSystem, systemContext } = corePackages
  if (inputSystem && systemContext) {
    for (const event of eventsToRegister) {
      if (registeredEvents.has(event)) {
        continue
      }

      const isRendererEvent = event.startsWith('render.')

      if (hasSession) {
        // Sessions don't support renderer events
        if (isRendererEvent) {
          continue
        }

        const eventHandler = async (raw: RawInputEvent) => {
          const snapshot = systemContext.getSystemContextSnapshot?.() ?? raw
          const mergedSnapshot = {
            ...snapshot,
            ...(raw.detail ? { detail: raw.detail } : {})
          } as SystemContextSnapshotWithDetail

          if (event.includes('.start')) {
            await sessionManager.cancelActiveSessions({
              ...mergedSnapshot,
              detail: {
                ...mergedSnapshot.detail,
                cancelled: true,
                cancelledBy: event
              }
            })
            await sessionManager.handleStart(keyConfig, mergedSnapshot)
          } else if (event.includes('.update')) {
            await sessionManager.handleUpdate(keyConfig, mergedSnapshot)
          } else if (event.includes('.end')) {
            await sessionManager.handleEnd(keyConfig, mergedSnapshot)
          }
        }
        inputSystem.on?.(event, eventHandler)
        registeredEvents.add(event)
      } else if (hasExecution) {
        if (isRendererEvent) {
          // Subscribe to EventBus for renderer events
          import('@asyra/reactive-events')
            .then((module) => {
              if (module.getEventBus) {
                const eventBus = module.getEventBus()
                eventBus.subscribe(
                  (raw: {
                    type: string
                    detail?: unknown
                    payload?: unknown
                  }) => {
                    if (raw.type === event) {
                      const snapshot =
                        systemContext.getSystemContextSnapshot?.() ?? raw
                      const mergedSnapshot = {
                        ...snapshot,
                        detail: raw.detail ?? raw.payload,
                        payload: raw.payload
                      } as unknown as SystemContextSnapshot
                      executionRegistry.execute(event, mergedSnapshot)
                    }
                  }
                )
              }
            })
            .catch(console.error)

          registeredEvents.add(event)
        } else {
          // Input events: Listen via inputSystem
          inputSystem.on?.(event, async (raw: RawInputEvent) => {
            const snapshot = systemContext.getSystemContextSnapshot?.() ?? raw
            const mergedSnapshot = {
              ...snapshot,
              ...(raw.detail ? { detail: raw.detail } : {})
            } as SystemContextSnapshotWithDetail
            await sessionManager.cancelActiveSessions({
              ...mergedSnapshot,
              detail: {
                ...mergedSnapshot.detail,
                cancelled: true,
                cancelledBy: event
              }
            })
            executionRegistry.execute(event, mergedSnapshot)
          })
          registeredEvents.add(event)
        }
      }
    }
  }
}

export function defineFeature<
  API extends Record<string, unknown> = Record<string, unknown>,
  State extends Record<string, unknown> = Record<string, unknown>
>(
  name: string,
  keyConfig: FeatureKeyMap | undefined,
  definition: FeatureDefinition<API, State>
): { api: FeatureAPI<API> } {
  const api = featureRegistry.register(
    name,
    definition as FeatureDefinition<Record<string, unknown>>
  )

  const hasSession = !!definition.session
  const hasExecution = !!definition.execution

  if ((hasSession || hasExecution) && keyConfig !== undefined) {
    if (isPackagesSet) {
      registerFeatureHandlers(
        name,
        keyConfig,
        definition as FeatureDefinition<Record<string, unknown>>
      )
    } else {
      pendingRegistrations.push({
        featureName: name,
        keyConfig,
        definition: definition as FeatureDefinition<
          Record<string, unknown>,
          Record<string, unknown>
        >
      })
    }
  }

  return { api } as { api: FeatureAPI<API> }
}

export function setCorePackages(packages: CorePackages) {
  corePackages = packages
  isPackagesSet = true

  for (const registration of pendingRegistrations) {
    try {
      registerFeatureHandlers(
        registration.featureName,
        registration.keyConfig,
        registration.definition
      )
    } catch (error) {
      console.error(
        `[defineFeature] Failed to register "${registration.featureName}":`,
        error
      )
    }
  }
  pendingRegistrations.length = 0
}

export function getFeature(featureName: string): FeatureAPI {
  if (!featureRegistry.has(featureName)) {
    throw new Error(`Feature "${featureName}" not found`)
  }
  return featureRegistry.getAPI(featureName)
}

export function unregisterFeature(featureName: string): boolean {
  return featureRegistry.unregister(featureName)
}

export function getFeatureRegistry(): FeatureRegistry {
  return featureRegistry
}

export function getSessionManager(): SessionManager {
  return sessionManager
}

export { FeatureRegistry } from './feature-registry'
export { SessionManager } from './session-manager'
