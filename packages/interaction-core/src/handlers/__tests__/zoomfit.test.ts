import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ZoomFitHandlers } from '../zoomfit'
import { InteractionActions } from '@asra/utils'
import * as reactiveEvents from '@asra/reactive-events'

vi.mock('@asra/reactive-events', () => ({
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
