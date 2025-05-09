import { APIDeps, InputSystemAPIs } from '../types/core-apis'

export const createInputSystemAPIs = (
  inputSystem: APIDeps['inputSystem']
): InputSystemAPIs => {
  return {
    setupInputSystem(watchedElement?: HTMLElement) {
      if (watchedElement) {
        inputSystem.switchWatchedElement(watchedElement)
      }
    }
  }
}
