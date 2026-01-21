import type { EVENT_OPTIONS, InteractionActions } from '../constants'

export interface InteractionEvent {
  type: InteractionActions
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: any
  options?: EVENT_OPTIONS
}
