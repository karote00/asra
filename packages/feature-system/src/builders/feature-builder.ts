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
    console.log(
      `[setCorePackages] Processing ${pendingHandlerRegistrations.length} pending handler registrations...`
    )
    for (const registration of pendingHandlerRegistrations) {
      try {
        if (!corePackages.interactionCore?.registry) {
          console.warn(
            `[setCorePackages] Cannot register handler for "${registration.eventName}" in feature "${registration.featureName}": interactionCore not available`
          )
          continue
        }
        corePackages.interactionCore.registry.register(
          registration.eventName,
          registration.handler
        )
        console.log(
          `[setCorePackages] Registered handler for "${registration.eventName}" in feature "${registration.featureName}"`
        )
      } catch (error) {
        console.error(
          `[setCorePackages] Failed to register handler for "${registration.eventName}" in feature "${registration.featureName}":`,
          error
        )
      }
    }
    pendingHandlerRegistrations.length = 0
    console.log('[setCorePackages] All pending handler registrations processed')
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
      console.warn(
        `keys() builder is deprecated for Feature "${name}". Use defineFeature(name, keyConfig, definition) instead.`
      )
    },

    handle: (eventName: string, handler) => {
      const interactionCore = corePackages?.interactionCore
      if (interactionCore?.registry) {
        interactionCore.registry.register(eventName, handler)
        console.log(
          `[handle] Registered handler for "${eventName}" in feature "${name}"`
        )
      } else if (!isPackagesSet) {
        pendingHandlerRegistrations.push({
          featureName: name,
          eventName,
          handler
        })
        console.log(
          `[handle] Queued handler registration for "${eventName}" in feature "${name}" (waiting for packages)`
        )
      } else {
        console.warn(
          `[handle] Cannot register handler for "${eventName}" in feature "${name}": interactionCore not available`
        )
      }
    },

    on: (eventName: string, handler) => {
      console.log(`[On] Feature "${name}" listening to: ${eventName}`)
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
