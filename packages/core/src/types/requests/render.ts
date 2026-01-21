import { Render } from '@asra/render'
import { PositionData } from '@asra/utils'

/**
 * Request API for Render data
 * Provides synchronous access to render state
 */

export interface RenderRequests {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initRender: (width: number, height: number, color: number) => Promise<any>
  getViewportPosition: () => PositionData
  getViewportScale: () => number
}

export interface RenderRequestDeps {
  render: Render
}
