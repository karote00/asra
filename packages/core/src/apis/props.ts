import type {
  EVENT_OPTIONS,
  PropertyComponentInstanceDataTypes
} from '@asyra/utils'
import type { PropertyOwnerRef } from '../types/props'

export interface PropsRequests {
  updatePropertyById: <K extends keyof PropertyComponentInstanceDataTypes>(
    propertyId: string,
    key: K,
    data: PropertyComponentInstanceDataTypes[K],
    owner?: PropertyOwnerRef,
    options?: EVENT_OPTIONS
  ) => void
  commitPropertyChanges: (options?: EVENT_OPTIONS) => void
}

export const createPropsAPIs = (requests: PropsRequests) => ({
  updatePropertyById<K extends keyof PropertyComponentInstanceDataTypes>(
    propertyId: string,
    key: K,
    data: PropertyComponentInstanceDataTypes[K],
    owner?: PropertyOwnerRef,
    options?: EVENT_OPTIONS
  ) {
    requests.updatePropertyById(propertyId, key, data, owner, options)
  },
  commitPropertyChanges(options?: EVENT_OPTIONS) {
    requests.commitPropertyChanges(options)
  }
})
