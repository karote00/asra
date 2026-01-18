import { requestCurrentPrimaryTool } from '@asra/reactive-events'

/**
 * Request API for Props data
 * Provides synchronous access to props manager state
 */

export interface PropsRequest {
  getCurrentPrimaryTool: () => Promise<import('@asra/utils').PrimaryToolType>
}

export const initPropsRequests = (): PropsRequest => ({
  getCurrentPrimaryTool: () => requestCurrentPrimaryTool()
})
