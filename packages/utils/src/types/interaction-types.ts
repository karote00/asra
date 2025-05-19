import { InteractionAction } from '../constants'

export interface InteractionEvent {
  type: InteractionAction
  payload?: any
}
