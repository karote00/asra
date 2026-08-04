import type { EventTypes } from '../types.js'

export interface SwitchInputSystemWatchedElementEvent {
  type: EventTypes
  payload: {
    watchedElement: HTMLElement
  }
}

export type InputSystemEvents = SwitchInputSystemWatchedElementEvent
