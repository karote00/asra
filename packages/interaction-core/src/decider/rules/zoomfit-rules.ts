import { InteractionActions, InteractionEvent } from '@asra/utils'

export const decideZoomFitRules = (): InteractionEvent => {
  const interaction: InteractionEvent = {
    type: InteractionActions.INTERACTION_ZOOM_FIT
  }

  return interaction
}
