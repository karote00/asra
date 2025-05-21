import { SystemMode } from '../constants'

export interface SystemState {
  mode: SystemMode
  featureFlags: Record<string, boolean>
  permissions: Record<string, boolean>
}
