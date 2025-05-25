import { subscribeToUpdateMouseState } from '@asra/reactive-events'
import { MouseStateAPIs } from '../types'

export const initMouseStateSubscribe = (apis: MouseStateAPIs) => {
  subscribeToUpdateMouseState(({ payload }) => {
    apis.updateMouseState(payload)
  })
}
