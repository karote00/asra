import { SystemContext } from '@asra/system-context'
import {
  SystemContextSnapshot,
  PrimaryToolType,
  MouseSnapshot,
  KeySnapshot
} from '@asra/utils'

/**
 * Dependencies for System Context Request APIs
 * System context dependencies injected from outside
 */
export interface SystemContextRequestDeps {
  systemContext: SystemContext
}

/**
 * Request API types for System Context
 * Type definitions for synchronous system context data access
 */

export interface SystemContextRequestAPIs {
  getSystemContextSnapshot: () => SystemContextSnapshot
  getCurrentPrimaryTool: () => PrimaryToolType
  getMouseState: () => MouseSnapshot
  getKeyState: () => KeySnapshot
}
