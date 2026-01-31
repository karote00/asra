import type { DecisionResult } from '@asyra/interaction-core'
import { decideToZoomFit } from '@asyra/reactive-events'

export const decideZoomFitRules = (): DecisionResult => {
  return {
    type: 'INTERACTION_ZOOM_FIT',
    handler: () => decideToZoomFit()
  }
}
