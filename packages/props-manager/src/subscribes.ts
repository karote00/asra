import {
  subscribeToUpdateUndoRedoStatus,
  subscribeToAddProperty,
  subscribeToRemoveProperty,
  updateTransaction,
  subscribeToPropsLoadData,
  subscribeToPropsSaveData,
  finishPropsSaveData
} from '@asra/reactive-events'
import { UNDO } from '@asra/utils'
import propsManager from './props-manager'

export const initPropXSubscribes = () => {
  let inUndoRedo = false
  subscribeToUpdateUndoRedoStatus(({ payload }) => {
    inUndoRedo = payload.status !== UNDO.NONE
  })

  subscribeToPropsLoadData(({ payload }) => {
    propsManager.load(payload.data)
  })

  subscribeToPropsSaveData(({ payload }) => {
    finishPropsSaveData(payload.requestId, propsManager.save())
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
