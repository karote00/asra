import {
  propChangeComplete,
  subscribeToAddProperty
} from '@asra/reactive-events'

export const initPropXSubscribes = () => {
  subscribeToAddProperty(({ payload }) => {
    console.log('add property', payload)

    propChangeComplete(payload.elementId, ['test'])
  })
}
