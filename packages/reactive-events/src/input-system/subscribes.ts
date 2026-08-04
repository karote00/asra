import type { SwitchInputSystemWatchedElementEvent } from './events.js'
import { createSubscribeEvent } from '../event-bus.js'
import { EventTypes } from '../types.js'

export const subscribeToSwitchInputSystemWatchedElement =
  createSubscribeEvent<SwitchInputSystemWatchedElementEvent>(
    EventTypes.SWITCH_INPUT_SYSTEM_WATCHED_ELEMENT
  )
