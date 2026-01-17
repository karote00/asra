import { decideToZoomFit } from '@asra/reactive-events'
import { InteractionActions, DetailType } from '@asra/utils'

export const ZoomFitHandlers = {
  [InteractionActions.INTERACTION_ZOOM_FIT]: (
    payload?: DetailType,
    options?: DetailType
  ) => {
    decideToZoomFit()
  }
}
