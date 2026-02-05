import type { FeatureBuilder, FeatureKeyMap } from '../types/feature'
import type { SessionConfig } from '../types/feature'
import { InputType, ModifierKey } from '@asyra/utils'
import keyMap from '@asyra/input-system/src/keymap'

let corePackages: any = {}

const pendingHandlerRegistrations: {
  featureName: string
  eventName: string
  handler: any
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
}

export function createFeatureBuilder(context: {
  name: string
  packages: any
  sessionManager: any
  featureRegistry: any
  keyConfig?: FeatureKeyMap
}): FeatureBuilder {
  const { name, sessionManager, featureRegistry, keyConfig } = context

  return {
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

    keys: (combos) => {
      // No-op: keys() is deprecated for Feature "${name}". Use defineFeature(name, keyConfig, definition) instead.
    },

    handle: (eventName: string, handler) => {
      const interactionCore = corePackages?.interactionCore
      if (interactionCore?.registry) {
        interactionCore.registry.register(eventName, handler)
      } else if (!isPackagesSet) {
        pendingHandlerRegistrations.push({
          featureName: name,
          eventName,
          handler
        })
      } else {
        console.warn(
          `Cannot register handler for "${eventName}" in feature "${name}": interactionCore not available`
        )
      }
    },

    on: (eventName: string, handler) => {
      // No-op
    },

    importFeature: (featureName: string) => {
      const api = featureRegistry.getAPI(featureName)
      if (!api) {
        return {}
      }
      return api
    },

    session: {
      start: <T>(
        sessionName: string,
        config?: SessionConfig,
        onStart?: any,
        onUpdate?: any,
        onEnd?: any
      ) => {
        sessionManager.registerSession(sessionName, name, config || {}, {
          onStart,
          onUpdate,
          onEnd
        })
      }
    }
  }
}
