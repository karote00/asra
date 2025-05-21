import { SystemMode } from '@asra/utils'

export interface SystemStateRawAPIs {
  getSystemMode: () => SystemMode
}

export type SystemStateAPIs = SystemStateRawAPIs
