import type {
  PropsComponentRawData,
  PropertyComponentRawData
} from '@asra/utils'
import type { EventTypes } from '../types'

export interface PropsLoadDataEvent {
  type: EventTypes
  payload: {
    data: PropsComponentRawData
  }
}

export interface PropsSaveDataEvent {
  type: EventTypes
  payload: {
    requestId: string
  }
}

export interface FinishPropsSaveDataEvent {
  type: EventTypes
  payload: {
    requestId: string
    data: PropsComponentRawData
  }
}

export interface AddPropertyEvent {
  type: EventTypes
  payload: {
    data: Partial<PropertyComponentRawData>[]
  }
}

export interface RemovePropertyEvent {
  type: EventTypes
  payload: {
    data: Partial<PropertyComponentRawData>[]
  }
}

export interface UpdatePropertyEvent {
  type: EventTypes
  payload: {
    data: Partial<PropertyComponentRawData>
  }
}

export type PropEvents =
  | PropsLoadDataEvent
  | PropsSaveDataEvent
  | FinishPropsSaveDataEvent
  | AddPropertyEvent
  | RemovePropertyEvent
  | UpdatePropertyEvent
