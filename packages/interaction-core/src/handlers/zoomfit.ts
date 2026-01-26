import { decideToZoomFit } from '@asyra/reactive-events'
import { InteractionActions, DetailType } from '@asyra/utils'

export const ZoomFitHandlers = {
  [InteractionActions.INTERACTION_ZOOM_FIT]: (
    payload?: DetailType,
    options?: DetailType
  ) => {
    decideToZoomFit()
  }
}
