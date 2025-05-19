import type {
  EmitSwitchPrimaryToolEvent,
  FinishRequestCurrentPrimaryToolEvent,
  RequestCurrentPrimaryToolEvent,
  SwitchPrimaryToolEvent
} from './events'
import { createSubscribeEvent } from '../../event-bus'
import { EventTypes } from '../../types'

export const subscribeToSwitchPrimaryTool =
  createSubscribeEvent<SwitchPrimaryToolEvent>(EventTypes.SWITCH_PRIMARY_TOOL)

export const subscribeToEmitSwitchPrimaryTool =
  createSubscribeEvent<EmitSwitchPrimaryToolEvent>(
    EventTypes.EMIT_SWITCH_PRIMARY_TOOL
  )

export const subscribeToRequestCurrentPrimaryTool =
  createSubscribeEvent<RequestCurrentPrimaryToolEvent>(
    EventTypes.REQUEST_CURRENT_PRIMARY_TOOL
  )

export const subscribeToFinishRequestCurrentPrimaryTool =
  createSubscribeEvent<FinishRequestCurrentPrimaryToolEvent>(
    EventTypes.FINISH_REQUEST_CURRENT_PRIMARY_TOOL
  )
