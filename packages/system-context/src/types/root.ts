import { SystemContextSnapshot } from '@asra/utils'

export interface RootRawAPIs {
  getSystemContextSnapshot: () => SystemContextSnapshot
}

export type RootAPIs = RootRawAPIs
