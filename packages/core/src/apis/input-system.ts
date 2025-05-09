import { APIDeps, InputSystemRawAPIs } from '../types'

export const createInputSystemAPIs = (
  inputSystem: APIDeps['inputSystem']
): InputSystemRawAPIs => {
  return {
    setupInputSystem(watchedElement?: HTMLElement) {
      if (watchedElement) {
        inputSystem.switchWatchedElement(watchedElement)
      }
    }
  }
}
