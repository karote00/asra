import {
  PropsComponentRawData,
  type EVENT_OPTIONS,
  type PropertyComponentInstanceDataTypes
} from '@asyra/utils'

export interface PropertyOwnerRef {
  ownerElementId: string
  ownerPropertyName: string
}

export interface PropsRawAPIs {
  propsLoadData: (data: PropsComponentRawData) => void
  propsSaveData: () => PropsComponentRawData
  updatePropertyById: <K extends keyof PropertyComponentInstanceDataTypes>(
    propertyId: string,
    key: K,
    data: PropertyComponentInstanceDataTypes[K],
    owner?: PropertyOwnerRef,
    options?: EVENT_OPTIONS
  ) => void
  commitPropertyChanges: (options?: EVENT_OPTIONS) => void
}

export type PropsAPIs = PropsRawAPIs
