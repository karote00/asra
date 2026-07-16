import { PresetEventDefinitions } from './preset-event-names'
import type { PresetCoreAPIs } from '../types'

export const registerEvents = (
  core: Pick<PresetCoreAPIs, 'registerEvent' | 'unregisterEvent'>
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

  try {
    Object.values(PresetEventDefinitions).forEach((definition) => {
      core.registerEvent(definition)
      registeredEventNames.push(definition.eventName)
    })
  } catch (error) {
    dispose()
    throw error
  }

  return dispose
}
