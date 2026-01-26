import { SystemContextSnapshot } from '@asyra/utils'

export interface RootRawAPIs {
  getSystemContextSnapshot: () => SystemContextSnapshot
}

export type RootAPIs = RootRawAPIs
