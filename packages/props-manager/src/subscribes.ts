import {
  propChangeComplete,
  subscribeToAddProperty,
  updateTransaction
} from '@asra/reactive-events'
import propsManager from './props-manager'
import { PropAlias, PropertyTypes } from '@asra/utils'

export const initPropXSubscribes = () => {
  subscribeToAddProperty(({ payload }) => {
    const propComponents = payload.data.map((propData) => {
      const type = propData.type as PropertyTypes
      const propKey = (PropAlias[type] || type) as PropertyTypes
      return propsManager.createProperty(propKey)
    })

    const newPropertyIdsMap = propsManager.addProperty(propComponents)

    propsManager.changes.forEach((change) => {
      updateTransaction(change.eventName, change)
    })
    propsManager.cleanChanges()

    propChangeComplete(payload.elementId, newPropertyIdsMap)
  })
}
