import type {
  EVENT_OPTIONS,
  PropertyComponentInstanceDataTypes,
  PropsComponentRawData
} from '@asyra/utils'
import type { PropertyOwnerRef } from '../types/props'

export interface PropsRequests {
  updatePropertyById: (
    propertyId: string,
    key: string,
    data: unknown,
    owner?: PropertyOwnerRef,
    options?: EVENT_OPTIONS
  ) => void
  commitPropertyChanges: (options?: EVENT_OPTIONS) => void
  propsLoadData: (data: unknown) => void
  propsSaveData: () => PropsComponentRawData
}

export const createPropsAPIs = (requests: PropsRequests) => ({
  updatePropertyById<
    TFields extends object = PropertyComponentInstanceDataTypes,
    K extends Extract<keyof TFields, string> = Extract<keyof TFields, string>
  >(
    propertyId: string,
    key: K,
    data: TFields[K],
    owner?: PropertyOwnerRef,
    options?: EVENT_OPTIONS
  ) {
    requests.updatePropertyById(propertyId, key, data, owner, options)
  },
  commitPropertyChanges(options?: EVENT_OPTIONS) {
    requests.commitPropertyChanges(options)
  },
  propsLoadData(data: unknown) {
    requests.propsLoadData(data)
  },
  propsSaveData() {
    return requests.propsSaveData()
  }
})
