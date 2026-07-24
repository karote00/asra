import type {
  ElementPropertyOwnerRelation,
  EVENT_OPTIONS,
  PropertyComponentInstanceDataTypes,
  PropsComponentRawData,
  PropsRestorePlan,
  PropsRestoreSnapshot
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
  preflightRestoreProperties: (
    snapshot: PropsRestoreSnapshot,
    ownerRelations: readonly ElementPropertyOwnerRelation[]
  ) => PropsRestorePlan
  applyRestoreProperties: (
    plan: PropsRestorePlan,
    options?: EVENT_OPTIONS
  ) => readonly string[]
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
  },
  preflightRestoreProperties(
    snapshot: PropsRestoreSnapshot,
    ownerRelations: readonly ElementPropertyOwnerRelation[]
  ) {
    return requests.preflightRestoreProperties(snapshot, ownerRelations)
  },
  applyRestoreProperties(plan: PropsRestorePlan, options?: EVENT_OPTIONS) {
    return requests.applyRestoreProperties(plan, options)
  }
})
