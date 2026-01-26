import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ZoomFitHandlers } from '../zoomfit'
import { InteractionActions } from '@asyra/utils'
import * as reactiveEvents from '@asyra/reactive-events'

vi.mock('@asyra/reactive-events', () => ({
  decideToZoomFit: vi.fn()
}))

describe('ZoomFitHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should call decideToZoomFit for INTERACTION_ZOOM_FIT', () => {
    ZoomFitHandlers[InteractionActions.INTERACTION_ZOOM_FIT]()

    expect(reactiveEvents.decideToZoomFit).toHaveBeenCalled()
  })
})
