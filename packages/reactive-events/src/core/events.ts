import type { EventTypes } from '../types'

export interface CoreAddElementEvent {
  type: EventTypes
  payload: {
    x: number
    y: number
    width?: number
    height?: number
  }
}

export type CoreEvents = CoreAddElementEvent
