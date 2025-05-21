import type { EventTypes } from '../types'

export interface SwitchInputSystemWatchedElementEvent {
  type: EventTypes
  payload: {
    watchedElement: HTMLElement
  }
}

export type InputSystemEvents = SwitchInputSystemWatchedElementEvent
