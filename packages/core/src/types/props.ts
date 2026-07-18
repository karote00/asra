import {
  PropsComponentRawData,
  type EVENT_OPTIONS,
  type PropertyComponentInstanceDataTypes
} from '@asyra/utils'

export interface PropertyOwnerRef {
  ownerElementId: string
  ownerPropertyName: string
}

export type PropertyFieldUpdate<TFields extends object> = TFields extends object
  ? {
      [K in Extract<keyof TFields, string>]: [
        key: K,
        data: TFields[K],
        owner?: PropertyOwnerRef,
        options?: EVENT_OPTIONS
      ]
    }[Extract<keyof TFields, string>]
  : never

export interface PropsRawAPIs {
  propsLoadData: (data: PropsComponentRawData) => void
  propsSaveData: () => PropsComponentRawData
  updatePropertyById: <
    TFields extends object = PropertyComponentInstanceDataTypes
  >(
    propertyId: string,
    ...update: PropertyFieldUpdate<TFields>
  ) => void
  commitPropertyChanges: (options?: EVENT_OPTIONS) => void
}

export type PropsAPIs = PropsRawAPIs
