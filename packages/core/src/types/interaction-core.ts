import { DetailType, InputSystemEvents } from '@asra/utils'

export interface InteractionCoreActionAPIs {
  executeAction: (eventName: InputSystemEvents, detail?: DetailType) => void
}

export interface InteractionCoreSessionAPIs {
  startSession: (eventName: InputSystemEvents, detail?: DetailType) => void
  updateSession: (eventName: InputSystemEvents, detail?: DetailType) => void
  endSession: (eventName: InputSystemEvents, detail?: DetailType) => void
}

export type InteractionCoreAPIs = InteractionCoreActionAPIs &
  InteractionCoreSessionAPIs
