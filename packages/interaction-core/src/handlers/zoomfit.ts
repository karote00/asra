import { decideToZoomFit } from '@asra/reactive-events'
import { InteractionActions } from '@asra/utils'

export const ZoomFitHandlers = {
  [InteractionActions.INTERACTION_ZOOM_FIT]: () => {
    decideToZoomFit()
  }
}
