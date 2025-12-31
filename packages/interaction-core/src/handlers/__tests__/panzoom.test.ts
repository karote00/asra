import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PanZoomHandlers } from '../panzoom'
import { InteractionActions, PanZoom } from '@asra/utils'
import * as reactiveEvents from '@asra/reactive-events'

vi.mock('@asra/reactive-events', () => ({
  decideToPanZoom: vi.fn()
}))

describe('PanZoomHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should call decideToPanZoom for INTERACTION_PAN_ZOOM', () => {
    const payload = {
      panzoom: PanZoom.PAN,
      mouse: { x: 100, y: 200 },
      wheel: { x: 10, y: 10 }
    }
    PanZoomHandlers[InteractionActions.INTERACTION_PAN_ZOOM](payload)
    expect(reactiveEvents.decideToPanZoom).toHaveBeenCalledWith(
      payload.panzoom,
      payload.mouse,
      payload.wheel
    )
  })
})
