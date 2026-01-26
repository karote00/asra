import { SystemContext } from '@asyra/system-context'
import { SystemContextSnapshot } from '@asyra/utils'

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
