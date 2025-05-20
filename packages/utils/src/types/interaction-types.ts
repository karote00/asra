import { InteractionAction } from '../constants'

export interface InteractionEvent {
  type: InteractionAction
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: any
}
