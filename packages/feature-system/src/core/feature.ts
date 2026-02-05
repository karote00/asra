import type {
  FeatureDefinition,
  FeatureAPI,
  FeatureKeyMap
} from '../types/feature'
import { FeatureRegistry } from './feature-registry'
import { SessionManager } from './session-manager'
import executionRegistry from './execution-registry'

const featureRegistry = new FeatureRegistry()
const sessionManager = new SessionManager()

let corePackages: any = {}
let isPackagesSet = false
let appKeyCombinations: any = {}

const pendingRegistrations: {
  featureName: string
  keyConfig: FeatureKeyMap
  definition: FeatureDefinition
}[] = []

export function setAppKeyCombinations(combinations: any) {
  appKeyCombinations = combinations
}

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
    const { start, update, end } = definition.session
    sessionManager.registerSession(
      keyConfig,
      name,
      { priority, exclusive },
      {
        onStart: start,
        onUpdate: update,
        onEnd: end
      }
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
      inputSystem.on(event, (raw: any) => {
        const snapshot = systemContext.getSystemContextSnapshot?.() || raw
        executionRegistry.execute(event, snapshot)
      })
    }
  }
}

export function defineFeature<API>(
  name: string,
  keyConfig: FeatureKeyMap | undefined,
  definition: FeatureDefinition<API>
): { api: FeatureAPI<API> } {
  const api = featureRegistry.register(name, definition)

  const hasSession = !!definition.session
  const hasExecution = !!definition.execution

  if ((hasSession || hasExecution) && keyConfig !== undefined) {
    if (isPackagesSet) {
      registerFeatureHandlers(name, keyConfig, definition)
    } else {
      pendingRegistrations.push({
        featureName: name,
        keyConfig,
        definition
      })
    }
  }

  return { api }
}

export function setCorePackages(packages: any) {
  corePackages = packages
  isPackagesSet = true

  for (const registration of pendingRegistrations) {
    try {
      registerFeature(
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
