import {
  propChangeComplete,
  subscribeToAddProperty
} from '@asra/reactive-events'
import propsManager from './props-manager'

export const initPropXSubscribes = () => {
  subscribeToAddProperty(({ payload }) => {
    const newPropertyIdsMap = propsManager.addProperty(payload.propNames)

    // TODO: update transaction

    propChangeComplete(payload.elementId, newPropertyIdsMap)
  })
}
