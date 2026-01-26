import { SystemMode } from '@asyra/utils'

export interface SystemStateRawAPIs {
  getSystemMode: () => SystemMode
}

export type SystemStateAPIs = SystemStateRawAPIs
