import { subscribeToSwitchInputSystemWatchedElement } from '@asra/reactive-events'
import inputSystem from './input-system'

export const initInputSystemSubscribe = () => {
  subscribeToSwitchInputSystemWatchedElement(({ payload }) => {
    inputSystem.switchWatchedElement(payload.watchedElement)
  })
}
