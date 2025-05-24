import { InputSystemEvents } from '@asra/utils'

export interface InteractionCoreActionAPIs {
  decideAction: (eventName: InputSystemEvents) => void
}

export type InteractionCoreAPIs = InteractionCoreActionAPIs
