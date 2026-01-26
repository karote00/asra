import { PropsManager } from '@asyra/props-manager'
import { PropsComponentRawData } from '@asyra/utils'

/**
 * Request API for Props data
 * Provides synchronous access to props manager state
 */

export interface PropsRequests {
  propsLoadData: (data: PropsComponentRawData) => void
  propsSaveData: () => PropsComponentRawData
}

export interface PropsRequestDeps {
  props: PropsManager
}
