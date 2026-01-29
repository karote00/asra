import {
  DetailType,
  InputSystemEvents,
  InteractionEvent,
  SystemContextSnapshot
} from '@asyra/utils'

export type DecisionHandler = (
  systemContextSnapshot: SystemContextSnapshot,
  detail?: DetailType
) => InteractionEvent | null

export interface InteractionCoreActionAPIs {
  executeAction: (eventName: InputSystemEvents, detail?: DetailType) => void
}

export interface InteractionCoreSessionAPIs {
  startSession: (eventName: InputSystemEvents, detail?: DetailType) => void
  updateSession: (eventName: InputSystemEvents, detail?: DetailType) => void
  endSession: (eventName: InputSystemEvents, detail?: DetailType) => void
}

export interface InteractionCoreRegistryAPIs {
  registerInteraction: (eventName: string, handler: DecisionHandler) => void
}

export type InteractionCoreAPIs = InteractionCoreActionAPIs &
  InteractionCoreSessionAPIs &
  InteractionCoreRegistryAPIs
