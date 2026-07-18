import type {
  EVENT_OPTIONS,
  PropertyComponentInstanceDataTypes,
  PropsComponentRawData
} from '@asyra/utils'
import type { PropertyFieldUpdate, PropertyOwnerRef } from '../types/props'

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
    TFields extends object = PropertyComponentInstanceDataTypes
  >(propertyId: string, ...update: PropertyFieldUpdate<TFields>) {
    const [key, data, owner, options] = update
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
