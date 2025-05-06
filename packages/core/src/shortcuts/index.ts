import type InputSystem from '@asra/input-system'
import { initAllHandlers } from './handlers'
import { CoreAPIs } from '../types/core-apis'

export const initShortcuts = (inputSystem: InputSystem, apis: CoreAPIs) => {
  initAllHandlers(inputSystem, apis)
}
