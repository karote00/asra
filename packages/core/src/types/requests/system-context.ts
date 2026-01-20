import { SystemContext } from '@asra/system-context'
import { SystemContextSnapshot } from '@asra/utils'

/**
 * Dependencies for System Context Request APIs
 * System context dependencies injected from outside
 */
export interface SystemContextRequestsDeps {
  systemContext: SystemContext
}

/**
 * Request API types for System Context
 * Type definitions for synchronous system context data access
 */

export interface SystemContextRequests {
  getSystemContextSnapshot: () => SystemContextSnapshot
}
