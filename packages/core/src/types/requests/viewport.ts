import {
  requestViewportPosition,
  requestViewportScale
} from '@asra/reactive-events'

/**
 * Request API for Viewport data
 * Provides synchronous access to viewport state
 */

export interface ViewportRequest {
  getViewportPosition: () => Promise<{ x: number; y: number }>
  getViewportScale: () => Promise<number>
}

export const initViewportRequests = (): ViewportRequest => ({
  getViewportPosition: () => requestViewportPosition(),
  getViewportScale: () => requestViewportScale()
})
