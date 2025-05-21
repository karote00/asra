import type { DecideActionEvent } from './events'
import { createSubscribeEvent } from '../event-bus'
import { EventTypes } from '../types'

export const subscribeToDecideAction = createSubscribeEvent<DecideActionEvent>(
  EventTypes.DECIDE_ACTION
)
