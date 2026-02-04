import type {
  FeatureDefinition,
  FeatureAPI,
  FeatureBuilder,
  FeatureKeyMap
} from '../types/feature'
import { FeatureRegistry } from './feature-registry'
import { SessionManager } from './session-manager'
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
}[] = []

let isPackagesSet = false

async function registerFeatureEventHandlers(
  featureName: string,
  keyConfig: FeatureKeyMap,
  builder: FeatureBuilder
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

  const registeredEvents = new Set<string>()
  const keyCombinationsMap: Record<string, any[]> = {}

  for (const [keyId, config] of Object.entries(keyConfig)) {
    const { event, keys, modifiers, detail } = config

    registeredEvents.add(event)

    if (!keyCombinationsMap[event]) {
      keyCombinationsMap[event] = []
    }

    keyCombinationsMap[event].push({
      type: InputType.KEYBOARD,
      keys,
      modifiers: modifiers || [],
      detail
    })
  }

  inputSystem.registry.registerKeyCombinations(keyCombinationsMap)

  for (const event of registeredEvents) {
    inputSystem.on(event, (raw: any) => {
      const snapshot = systemContext.getSystemContextSnapshot?.() || raw

      const result = interactionCore.registry.decide(
        event,
        snapshot,
        raw.detail
      )

      if (result?.handler) {
        result.handler(result.payload, result.options)
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
        registration.builder
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
  const builder = createFeatureBuilder({
    name,
    packages: {},
    sessionManager,
    featureRegistry,
    keyConfig
  })

  definition.define(builder)

  const api = featureRegistry.register(name, definition as any)

  if (keyConfig && Object.keys(keyConfig).length > 0) {
    if (isPackagesSet) {
      registerFeatureEventHandlers(name, keyConfig, builder).catch((error) => {
        console.error(
          `[defineFeature] Failed to register handlers for "${name}":`,
          error
        )
      })
    } else {
      pendingRegistrations.push({ featureName: name, keyConfig, builder })
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
