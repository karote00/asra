import { switchInputSystemWatchedElement } from '@asra/reactive-events'
import { InputSystemRawAPIs } from '../types'

export const createInputSystemAPIs = (): InputSystemRawAPIs => {
  return {
    setupInputSystem(watchedElement?: HTMLElement) {
      if (watchedElement) {
        switchInputSystemWatchedElement(watchedElement)
      }
    }
  }
}
