import { DetailType } from '@asyra/utils'
import type { DecisionResult } from '@asyra/interaction-core'
import { decideFromSwitchPrimaryToolRules } from '../rules'

export const decideSwitchPrimaryToolBehavior = (
  detail?: DetailType
): DecisionResult => {
  return decideFromSwitchPrimaryToolRules(detail)
}
