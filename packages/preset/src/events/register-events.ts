import { PresetEventDefinitions } from './preset-event-names'
import type { PresetCoreAPIs } from '../types'

export const registerEvents = (
  core: Pick<PresetCoreAPIs, 'registerEvent' | 'unregisterEvent'>,
  onCleanupReady?: (dispose: () => void) => void
): (() => void) => {
  const registeredEventNames: string[] = []
  let disposed = false
  let cleanupReported = false

  const dispose = (): void => {
    if (disposed) return
    for (let index = registeredEventNames.length - 1; index >= 0; index--) {
      core.unregisterEvent(registeredEventNames[index])
      registeredEventNames.splice(index, 1)
    }
    disposed = true
  }
  const reportCleanupReady = (): void => {
    if (cleanupReported || !onCleanupReady) return
    onCleanupReady(dispose)
    cleanupReported = true
  }

  try {
    Object.values(PresetEventDefinitions).forEach((definition) => {
      core.registerEvent(definition)
      registeredEventNames.push(definition.eventName)
      reportCleanupReady()
    })
  } catch (error) {
    if (!cleanupReported) dispose()
    throw error
  }

  return dispose
}
