import { SystemMode } from '../constants/index.js'

export interface SystemSnapshot {
  mode: SystemMode
  featureFlags: Record<string, boolean>
  permissions: Record<string, boolean>
}
