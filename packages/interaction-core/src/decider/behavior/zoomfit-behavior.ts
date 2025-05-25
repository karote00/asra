import { InteractionEvent } from '@asra/utils'
import { decideZoomFitRules } from '../rules'

export const decideZoomFitBehavior = (): InteractionEvent => {
  return decideZoomFitRules()
}
