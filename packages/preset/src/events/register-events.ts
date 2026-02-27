import { PresetEventNames } from './preset-event-names'
import type { PresetCoreAPIs } from '../types'

export const registerEvents = (
  core: Pick<PresetCoreAPIs, 'registerEvent'>
): void => {
  const eventNames = new Set(Object.values(PresetEventNames))

  for (const eventName of eventNames) {
    core.registerEvent(eventName)
  }
}
