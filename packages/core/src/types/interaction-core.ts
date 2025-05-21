import { SystemSnapshot } from '@asra/utils'

export interface InteractionCoreActionAPIs {
  decideAction: (systemSnapshot: SystemSnapshot) => void
}

export type InteractionCoreAPIs = InteractionCoreActionAPIs
