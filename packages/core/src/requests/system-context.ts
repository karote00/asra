import { SystemContextSnapshot } from '@asyra/utils'
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
  }
})
