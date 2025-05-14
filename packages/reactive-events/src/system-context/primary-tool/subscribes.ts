import { createSubscribeEvent } from '../../event-bus'
import { EventTypes } from '../../types'
import {
  FinishRequestCurrentPrimaryToolEvent,
  RequestCurrentPrimaryToolEvent,
  type SwitchPrimaryToolEvent
} from './events'

export const subscribeToSwitchPrimaryTool =
  createSubscribeEvent<SwitchPrimaryToolEvent>(EventTypes.SWITCH_PRIMARY_TOOL)

export const subscribeToRequestCurrentPrimaryTool =
  createSubscribeEvent<RequestCurrentPrimaryToolEvent>(
    EventTypes.REQUEST_CURRENT_PRIMARY_TOOL
  )

export const subscribeToFinishRequestCurrentPrimaryTool =
  createSubscribeEvent<FinishRequestCurrentPrimaryToolEvent>(
    EventTypes.FINISH_REQUEST_CURRENT_PRIMARY_TOOL
  )
