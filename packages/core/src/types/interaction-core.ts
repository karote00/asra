import {
  DetailType,
  InteractionEvent,
  SystemContextSnapshot
} from '@asyra/utils'

export type DecisionHandler = (
  systemContextSnapshot: SystemContextSnapshot,
  detail?: DetailType
) => InteractionEvent | null

export interface InteractionCoreActionAPIs {
  executeAction: (eventName: string, detail?: DetailType) => void
}

export interface InteractionCoreSessionAPIs {
  startSession: (eventName: string, detail?: DetailType) => void
  updateSession: (eventName: string, detail?: DetailType) => void
  endSession: (eventName: string, detail?: DetailType) => void
}

export interface InteractionCoreRegistryAPIs {
  registerInteraction: (eventName: string, handler: DecisionHandler) => void
}

export type InteractionCoreAPIs = InteractionCoreActionAPIs &
  InteractionCoreSessionAPIs
