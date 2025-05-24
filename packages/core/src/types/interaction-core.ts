import { DetailType, InputSystemEvents } from '@asra/utils'

export interface InteractionCoreActionAPIs {
  decideAction: (eventName: InputSystemEvents, detail?: DetailType) => void
}

export type InteractionCoreAPIs = InteractionCoreActionAPIs
