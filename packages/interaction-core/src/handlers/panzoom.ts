import { decideToPanZoom } from '@asyra/reactive-events'
import { InteractionActions, InteractionEvent } from '@asyra/utils'

export const PanZoomHandlers = {
  [InteractionActions.INTERACTION_PAN_ZOOM]: (
    payload?: InteractionEvent['payload'],
    options?: InteractionEvent['options']
  ) => {
    decideToPanZoom(payload.panzoom, payload.mouse, payload.wheel)
  }
}
