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
  updatePropertyById: <
    TFields extends object = PropertyComponentInstanceDataTypes,
    K extends Extract<keyof TFields, string> = Extract<keyof TFields, string>
  >(
    propertyId: string,
    key: K,
    data: TFields[K],
    owner?: PropertyOwnerRef,
    options?: EVENT_OPTIONS
  ) => void
  commitPropertyChanges: (options?: EVENT_OPTIONS) => void
}

export type PropsAPIs = PropsRawAPIs
