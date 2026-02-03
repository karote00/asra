import type { FeatureBuilder } from '../types/feature'
import type { SessionConfig } from '../types/feature'

export function createFeatureBuilder(context: {
  name: string
  packages: any
  sessionManager: any
  featureRegistry: any
}): FeatureBuilder {
  const { name, packages, sessionManager, featureRegistry } = context

  // Temporary placeholder - will be properly integrated with core packages
  const eventRegistry = {
    register: (eventName: string) => ({
      eventName,
      publish: (payload?: unknown, options?: unknown) => {
        console.log(`[Event] ${eventName}`, payload, options)
      },
      subscribe: (handler: any) => {
        console.log(`[Subscribe] to event`)
        return { unsubscribe: () => console.log('[Unsubscribe]') }
      }
    })
  }

  return {
    packages,

    events: {
      register: (eventName: string) => eventRegistry.register(eventName),
      emit: (eventName: string, payload?: unknown, options?: unknown) => {
        eventRegistry.register(eventName).publish(payload, options)
      },
      subscribe: (
        eventName: string,
        handler: (payload: unknown, options?: unknown) => void
      ) => {
        return eventRegistry.register(eventName).subscribe(handler)
      }
    },

    keys: (combos) => {
      console.log(`[Keys] Feature "${name}" registering key combos:`, combos)
    },

    handle: (eventName: string, handler) => {
      console.log(`[Handle] Feature "${name}" handling event: ${eventName}`)
    },

    on: (eventName: string, handler) => {
      console.log(`[On] Feature "${name}" listening to: ${eventName}`)
    },

    importFeature: (featureName: string) => {
      const api = featureRegistry.getAPI(featureName)
      if (!api) {
        console.warn(`Feature "${featureName}" not found`)
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
        console.log(
          `[Session] Feature "${name}" registering session: ${sessionName}`
        )
        sessionManager.registerSession(sessionName, name, config || {}, {
          onStart,
          onUpdate,
          onEnd
        })
      }
    }
  }
}
