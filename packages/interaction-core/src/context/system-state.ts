import { SystemMode } from '../types'

export interface SystemState {
  primaryTool: string
  mode: SystemMode
  featureFlags: Record<string, boolean>
  permissions: Record<string, boolean>
}
