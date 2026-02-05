import type {
  FeatureDefinition,
  FeatureAPI,
  FeatureBuilder,
  FeatureKeyMap
} from '../types/feature'
import { FeatureRegistry } from './feature-registry'
import { SessionManager } from './session-manager'
import executionRegistry from './execution-registry'
import {
  createFeatureBuilder,
  setCorePackages
} from '../builders/feature-builder'
import { InputType } from '@asyra/utils'

const featureRegistry = new FeatureRegistry()
const sessionManager = new SessionManager()

const pendingRegistrations: {
  featureName: string
  keyConfig: FeatureKeyMap
  builder: FeatureBuilder
  tracking: { usedSession: boolean; usedExecution: boolean }
}[] = []

let isPackagesSet = false

// App-level key combinations will be set via core.initKeyCombinations()
let appKeyCombinations: any = {}

function setAppKeyCombinationsInternal(combinations: any) {
  appKeyCombinations = combinations
}

async function registerFeatureEventHandlers(
  featureName: string,
  keyConfig: FeatureKeyMap,
  builder: FeatureBuilder,
  tracking: { usedSession: boolean; usedExecution: boolean }
) {
  const packages = builder.packages
  const inputSystem = packages?.inputSystem
  const interactionCore = packages?.interactionCore
  const systemContext = packages?.systemContext

  if (
    !interactionCore?.registry ||
    !inputSystem?.on ||
    !inputSystem?.registry ||
    !systemContext
  ) {
    return
  }

  if (!keyConfig) {
    return // General rules (like transaction) don't need keyConfig
  }

  // Determine events based on session vs execution
  let eventsToRegister: string[] = []

  if (tracking.usedSession) {
    // Session: auto-expand 'input.drag' to start/update/end
    const baseEvent = keyConfig
    eventsToRegister = [
      `${baseEvent}.start`,
      `${baseEvent}.update`,
      `${baseEvent}.end`
    ]
  } else if (tracking.usedExecution) {
    // Execution: use exact event name
    eventsToRegister = [keyConfig]
  } else {
    // Fallback: assume it's an exact event name
    eventsToRegister = [keyConfig]
  }

  // Build key combinations map for input system
  const keyCombinationsMap: Record<string, any[]> = {}
  const registeredEvents = new Set<string>()

  // Look up key combinations from app-level keyCombinations
  for (const event of eventsToRegister) {
    const keyCombinations = appKeyCombinations[event]
    if (keyCombinations) {
      registeredEvents.add(event)
      keyCombinationsMap[event] = keyCombinations
    }
  }

  // Register key combinations with input system
  inputSystem.registry.registerKeyCombinations(keyCombinationsMap)

  // Set up event handlers
  for (const event of registeredEvents) {
    inputSystem.on(event, (raw: any) => {
      const snapshot = systemContext.getSystemContextSnapshot?.() || raw

      // First try execution registry (for one-time actions like selection)
      const executionRan = executionRegistry.execute(event, snapshot)

      // If no execution ran, try session manager (for continuous actions like drag)
      if (!executionRan) {
        // The session manager will be called by the interactionCore
        // for session-based features that registered via handle()
      }
    })
  }
}

async function processPendingRegistrations() {
  if (pendingRegistrations.length === 0) return

  for (const registration of pendingRegistrations) {
    try {
      await registerFeatureEventHandlers(
        registration.featureName,
        registration.keyConfig,
        registration.builder,
        registration.tracking
      )
    } catch (error) {
      console.error(
        `[defineFeature] Failed to register handlers for "${registration.featureName}":`,
        error
      )
    }
  }

  pendingRegistrations.length = 0
}

export function defineFeature<API>(
  name: string,
  keyConfig: FeatureKeyMap | undefined,
  definition: FeatureDefinition<API>
): { api: FeatureAPI<API> } {
  const { builder, tracking } = createFeatureBuilder({
    name,
    packages: {},
    sessionManager,
    featureRegistry,
    keyConfig
  })

  definition.define(builder)

  const api = featureRegistry.register(name, definition as any)

  if (keyConfig !== undefined) {
    // Only register key configs for features with explicit keyConfig
    if (isPackagesSet) {
      registerFeatureEventHandlers(name, keyConfig, builder, tracking).catch(
        (error) => {
          console.error(
            `[defineFeature] Failed to register handlers for "${name}":`,
            error
          )
        }
      )
    } else {
      pendingRegistrations.push({
        featureName: name,
        keyConfig,
        builder,
        tracking
      })
    }
  }

  return { api: api as FeatureAPI<API> }
}

const originalSetCorePackages = setCorePackages

export function setCorePackagesAndProcessRegistrations(packages: any) {
  originalSetCorePackages(packages)
  isPackagesSet = true
  processPendingRegistrations().catch((error) => {
    console.error(
      '[defineFeature] Failed to process pending registrations:',
      error
    )
  })
}

export function importFeature(featureName: string): FeatureAPI {
  const api = featureRegistry.getAPI(featureName)
  if (!api) {
    throw new Error(`Feature "${featureName}" not found`)
  }
  return api
}

export function registerFeature(feature: { api: FeatureAPI }): void {}

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

export const setAppKeyCombinations = setAppKeyCombinationsInternal
