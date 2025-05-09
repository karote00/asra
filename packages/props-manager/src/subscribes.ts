import {
  subscribeToUpdateUndoRedoStatus,
  subscribeToAddProperty,
  subscribeToRemoveProperty,
  updateTransaction
} from '@asra/reactive-events'
import { UNDO } from '@asra/utils'
import propsManager from './props-manager'

export const initPropXSubscribes = () => {
  let inUndoRedo = false
  subscribeToUpdateUndoRedoStatus(({ status }) => {
    inUndoRedo = status !== UNDO.NONE
  })

  subscribeToAddProperty(({ payload }) => {
    const propComponents = payload.data.map((propData) => {
      let newProperty
      if (inUndoRedo) {
        newProperty = propsManager.getRestoreComponentById(
          propData.id as string
        )
      }

      if (!newProperty) {
        newProperty = propsManager.createProperty(propData)
      }

      return newProperty
    })

    propsManager.addProperty(propComponents)

    propsManager.changes.forEach((change) => {
      updateTransaction(change.eventName, change)
    })

    propsManager.cleanChanges()
  })

  subscribeToRemoveProperty(({ payload }) => {
    const removedPropertyIds = payload.data.map(
      (propertyData) => propertyData.id as string
    )

    propsManager.removeProperty(removedPropertyIds)

    propsManager.changes.forEach((change) => {
      updateTransaction(change.eventName, change)
    })

    propsManager.cleanChanges()
  })
}
