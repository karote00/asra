import { decideToPanZoom } from '@asra/reactive-events'
import { InteractionActions, InteractionEvent } from '@asra/utils'

export const PanZoomHandlers = {
  [InteractionActions.INTERACTION_PAN_ZOOM]: (
    payload?: InteractionEvent['payload']
  ) => {
    decideToPanZoom(payload.panzoom, payload.mouse, payload.wheel)
  }
}
