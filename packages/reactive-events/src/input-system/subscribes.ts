import type { SwitchInputSystemWatchedElementEvent } from './events'
import { createSubscribeEvent } from '../event-bus'
import { EventTypes } from '../types'

export const subscribeToSwitchInputSystemWatchedElement =
  createSubscribeEvent<SwitchInputSystemWatchedElementEvent>(
    EventTypes.SWITCH_INPUT_SYSTEM_WATCHED_ELEMENT
  )
