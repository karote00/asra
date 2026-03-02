import {
  subscribeToUpdateUndoRedoStatus,
  subscribeToEndTransaction,
  subscribeToAddProperty,
  subscribeToRemoveProperty
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
    propsManager.commitChanges(options)
  })

  subscribeToRemoveProperty(({ payload, options }) => {
    const removedPropertyIds = payload.data.map(
      (propertyData) => propertyData.id as string
    )

    propsManager.removeProperty(removedPropertyIds, options)
    propsManager.commitChanges(options)
  })

  // Property updates can be tracked via scene-tree transaction commits.
  // Ensure stale pending props changes never leak across action boundaries.
  subscribeToEndTransaction(() => {
    propsManager.cleanChanges()
  })
}
