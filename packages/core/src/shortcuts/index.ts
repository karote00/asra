import type { Core } from '../core'
import { initAllHandlers } from './handlers'

export const initShortcuts = (core: Core) => {
  initAllHandlers(core)
}
