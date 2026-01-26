import { subscribeToUpdateKeyState } from '@asyra/reactive-events'
import { KeyStateAPIs } from '../types'

export const initKeyStateSubscribe = (apis: KeyStateAPIs) => {
  subscribeToUpdateKeyState(({ payload }) => {
    apis.updateKeyState(payload)
  })
}
