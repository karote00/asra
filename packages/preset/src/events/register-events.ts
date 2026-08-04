import type { EventDefinition } from '@asyra/core'
import { PresetEventDefinitions } from './preset-event-names.js'
import type { PresetCoreAPIs } from '../types.js'
import { createCleanupReporter } from '../cleanup-reporter.js'

export const registerEvents = (
  core: Pick<PresetCoreAPIs, 'registerEvent' | 'unregisterEvent'>,
  onCleanupReady?: (dispose: () => void) => void,
  definitions: readonly EventDefinition[] = Object.values(
    PresetEventDefinitions
  )
): (() => void) => {
  const registeredEventNames: string[] = []
  let disposed = false

  const dispose = (): void => {
    if (disposed) return
    for (let index = registeredEventNames.length - 1; index >= 0; index--) {
      core.unregisterEvent(registeredEventNames[index])
      registeredEventNames.splice(index, 1)
    }
    disposed = true
  }
  const cleanupReporter = createCleanupReporter(onCleanupReady, dispose)

  try {
    definitions.forEach((definition) => {
      core.registerEvent(definition)
      registeredEventNames.push(definition.eventName)
      cleanupReporter.report()
    })
  } catch (error) {
    if (!cleanupReporter.hasReported()) dispose()
    throw error
  }

  return dispose
}
