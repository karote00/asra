import { SystemMode } from '../constants'

export interface SystemSnapshot {
  mode: SystemMode
  featureFlags: Record<string, boolean>
  permissions: Record<string, boolean>
}
