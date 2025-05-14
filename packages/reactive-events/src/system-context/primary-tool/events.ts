import { PrimaryToolType } from '@asra/utils'
import { EventTypes } from '../../types'

export interface SwitchPrimaryToolEvent {
  type: EventTypes
  payload: {
    tool: PrimaryToolType
  }
}

export interface EmitSwitchPrimaryToolEvent {
  type: EventTypes
}

export interface RequestCurrentPrimaryToolEvent {
  type: EventTypes
  payload: {
    requestId: string
  }
}

export interface FinishRequestCurrentPrimaryToolEvent {
  type: EventTypes
  payload: {
    requestId: string
    tool: PrimaryToolType
  }
}

export type PrimaryToolEvents =
  | SwitchPrimaryToolEvent
  | RequestCurrentPrimaryToolEvent
  | FinishRequestCurrentPrimaryToolEvent
