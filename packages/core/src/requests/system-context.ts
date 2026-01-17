import {
  SystemContextSnapshot,
  PrimaryToolType,
  MouseSnapshot,
  KeySnapshot
} from '@asra/utils'
import { SystemContextRequestDeps, SystemContextRequestAPIs } from '../types'

/**
 * Request API for System Context data
 * Provides synchronous access to system context state with dependency injection
 */

export const createSystemContextRequestAPIs = (
  deps: SystemContextRequestDeps
): SystemContextRequestAPIs => ({
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
