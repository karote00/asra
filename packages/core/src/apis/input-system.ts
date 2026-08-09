import inputSystem, { type InputSystem } from '@asyra/input-system'
import { InputSystemRawAPIs } from '../types/index.js'

export const createInputSystemAPIs = (
  owner: Pick<InputSystem, 'switchWatchedElement'> = inputSystem
): InputSystemRawAPIs => {
  return {
    setupInputSystem(watchedElement?: HTMLElement) {
      if (watchedElement) {
        owner.switchWatchedElement(watchedElement)
      }
    }
  }
}
