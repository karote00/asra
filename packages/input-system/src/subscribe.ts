import { subscribeToSwitchInputSystemWatchedElement } from '@asra/reactive-events/dist/input-system'
import inputSystem from './input-system'

export const initInputSystemSubscribe = () => {
  subscribeToSwitchInputSystemWatchedElement(({ payload }) => {
    inputSystem.switchWatchedElement(payload.watchedElement)
  })
}
