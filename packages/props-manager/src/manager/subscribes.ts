import {
  subscribeToUpdateUndoRedoStatus,
  subscribeToAddProperty,
  subscribeToRemoveProperty,
  updateTransaction
} from '@asyra/reactive-events'
import { UNDO } from '@asyra/utils'
import propsManager from './props-manager'

export const initPropXSubscribes = () => {
  let inUndoRedo = false
  subscribeToUpdateUndoRedoStatus(({ payload }) => {
    inUndoRedo = payload.status !== UNDO.NONE
  })

  subscribeToAddProperty(({ payload, options }) => {
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
      const changeOptions = change.options ?? options
      if (changeOptions) {
        updateTransaction(change.eventName, change, changeOptions)
        return
      }

      updateTransaction(change.eventName, change)
    })

    propsManager.cleanChanges()
  })

  subscribeToRemoveProperty(({ payload, options }) => {
    const removedPropertyIds = payload.data.map(
      (propertyData) => propertyData.id as string
    )

    propsManager.removeProperty(removedPropertyIds, options)

    propsManager.changes.forEach((change) => {
      const changeOptions = change.options ?? options
      if (changeOptions) {
        updateTransaction(change.eventName, change, changeOptions)
        return
      }

      updateTransaction(change.eventName, change)
    })

    propsManager.cleanChanges()
  })
}
