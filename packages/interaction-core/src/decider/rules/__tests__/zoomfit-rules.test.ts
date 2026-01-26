import { describe, it, expect } from 'vitest'
import { InteractionActions } from '@asyra/utils'
import { decideZoomFitRules } from '../zoomfit-rules'

describe('decideZoomFitRules', () => {
  it('should return INTERACTION_ZOOM_FIT', () => {
    const result = decideZoomFitRules()

    expect(result).toEqual({
      type: InteractionActions.INTERACTION_ZOOM_FIT
    })
  })
})
