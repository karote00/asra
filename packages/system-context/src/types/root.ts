import { SystemSnapshot } from '@asra/utils'

export interface RootRawAPIs {
  getSystemSnapshot: () => SystemSnapshot
}

export type RootAPIs = RootRawAPIs
