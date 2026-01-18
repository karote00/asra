import {
  SystemContextSnapshot,
  PrimaryToolType,
  MouseSnapshot,
  KeySnapshot
} from '@asra/utils'
import { SystemContextRequestsDeps, SystemContextRequests } from '../types'

/**
 * Request API for System Context data
 * Provides synchronous access to system context state with dependency injection
 */

export const createSystemContextRequests = (
  deps: SystemContextRequestsDeps
): SystemContextRequests => ({
  getSystemContextSnapshot: (): SystemContextSnapshot => {
    return deps.systemContext.getSystemContextSnapshot()
  },
  getCurrentPrimaryTool: (): PrimaryToolType => {
    return deps.systemContext.getCurrentPrimaryTool()
  },
  getMouseState: (): MouseSnapshot => {
    return deps.systemContext.getMouseState()
  },
  getKeyState: (): KeySnapshot => {
    return deps.systemContext.getKeyState()
  }
})
