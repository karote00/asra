import { DetailType, InteractionEvent } from '@asra/utils'
import { decideFromSwitchPrimaryToolRules } from '../rules'

export const decideSwitchPrimaryToolBehavior = (
  detail?: DetailType
): InteractionEvent => {
  return decideFromSwitchPrimaryToolRules(detail)
}
