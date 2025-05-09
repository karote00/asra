import type InputSystem from '@asra/input-system'
import type { Render } from '@asra/render'
import { initAllHandlers } from './handlers'
import { CoreAPIs } from '../types/core-apis'

export const initShortcuts = (
  deps: { inputSystem: InputSystem; render: Render },
  apis: CoreAPIs
) => {
  initAllHandlers(deps, apis)
}
