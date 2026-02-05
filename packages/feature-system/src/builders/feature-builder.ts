import type { FeatureBuilder, FeatureKeyMap } from '../types/feature'
import type { SessionConfig } from '../types/feature'
import type { ExecutionConfig } from '../types/execution'
import { InputType, ModifierKey } from '@asyra/utils'
import keyMap from '@asyra/input-system/src/keymap'
import executionRegistry from '../core/execution-registry'

let corePackages: any = {}
let executionRegistryLocal: any = executionRegistry

const pendingHandlerRegistrations: {
  featureName: string
  eventName: string
  handler: any
  isSession: boolean
}[] = []

const pendingExecutionRegistrations: {
  featureName: string
  eventName: string
  config: ExecutionConfig
  handler: any
}[] = []

const pendingKeyCombinations: {
  featureName: string
  keyConfig?: string
  isSession: boolean
}[] = []

let isPackagesSet = false

export function setCorePackages(packages: any) {
  corePackages = packages
  isPackagesSet = true

  if (pendingHandlerRegistrations.length > 0) {
    for (const registration of pendingHandlerRegistrations) {
      try {
        if (!corePackages.interactionCore?.registry) {
          console.warn(
            `Cannot register handler for "${registration.eventName}" in feature "${registration.featureName}": interactionCore not available`
          )
          continue
        }
        corePackages.interactionCore.registry.register(
          registration.eventName,
          registration.handler
        )
      } catch (error) {
        console.error(
          `Failed to register handler for "${registration.eventName}" in feature "${registration.featureName}":`,
          error
        )
      }
    }
    pendingHandlerRegistrations.length = 0
  }

  if (pendingExecutionRegistrations.length > 0) {
    for (const registration of pendingExecutionRegistrations) {
      try {
        executionRegistryLocal.register(
          registration.eventName,
          registration.featureName,
          registration.config,
          registration.handler
        )
      } catch (error) {
        console.error(
          `Failed to register execution for "${registration.eventName}" in feature "${registration.featureName}":`,
          error
        )
      }
    }
    pendingExecutionRegistrations.length = 0
  }
}

export function createFeatureBuilder(context: {
  name: string
  packages: any
  sessionManager?: any
  featureRegistry: any
  keyConfig?: FeatureKeyMap
}): {
  builder: FeatureBuilder
  tracking: { usedSession: boolean; usedExecution: boolean }
} {
  const { name, sessionManager, featureRegistry, keyConfig } = context

  let usedSession = false
  let usedExecution = false

  const builder: FeatureBuilder = {
    get packages() {
      return Object.keys(context.packages).length > 0
        ? context.packages
        : corePackages
    },

    events: {
      register: (eventName: string) => ({
        eventName,
        publish: (payload?: unknown, options?: unknown) => {},
        subscribe: (handler: any) => ({ unsubscribe: () => {} })
      }),
      emit: (eventName: string, payload?: unknown, options?: unknown) => {},
      subscribe: (eventName: string, handler: (payload: unknown) => void) => ({
        unsubscribe: () => {}
      })
    },

    keys: (combos: any) => {
      // Deprecated: keys() builder. Use defineFeature(keyConfig) instead.
    },

    handle: (eventName: string, handler: any) => {
      const interactionCore = corePackages?.interactionCore
      if (interactionCore?.registry) {
        interactionCore.registry.register(eventName, handler)
      } else if (!isPackagesSet) {
        pendingHandlerRegistrations.push({
          featureName: name,
          eventName,
          handler,
          isSession: false
        })
      } else {
        console.warn(
          `Cannot register handler for "${eventName}" in feature "${name}": interactionCore not available`
        )
      }
    },

    on: (eventName: string, handler: any) => {
      // No-op
    },

    importFeature: (featureName: string) => {
      const api = featureRegistry.getAPI(featureName)
      if (!api) {
        return {}
      }
      return api
    },

    execution: {
      register: (
        eventName: string,
        config?: ExecutionConfig,
        handler?: any
      ) => {
        usedExecution = true
        if (isPackagesSet && executionRegistryLocal) {
          executionRegistryLocal.register(
            eventName,
            name,
            config || {},
            handler
          )
        } else {
          pendingExecutionRegistrations.push({
            featureName: name,
            eventName,
            config: config || {},
            handler
          })
        }
      }
    },

    session: {
      start: <T>(
        sessionName: string,
        config?: SessionConfig,
        onStart?: any,
        onUpdate?: any,
        onEnd?: any
      ) => {
        usedSession = true
        if (sessionManager) {
          sessionManager.registerSession(sessionName, name, config || {}, {
            onStart,
            onUpdate,
            onEnd
          })
        }
      }
    }
  }

  return {
    builder,
    tracking: { usedSession, usedExecution }
  }
}
