import { InteractionEvent } from '@asyra/utils'
import { decideZoomFitRules } from '../rules'

export const decideZoomFitBehavior = (): InteractionEvent => {
  return decideZoomFitRules()
}
