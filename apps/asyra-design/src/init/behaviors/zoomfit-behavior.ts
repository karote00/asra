import type { DecisionResult } from '@asyra/interaction-core'
import { decideZoomFitRules } from '../rules'

export const decideZoomFitBehavior = (): DecisionResult => {
  return decideZoomFitRules()
}
