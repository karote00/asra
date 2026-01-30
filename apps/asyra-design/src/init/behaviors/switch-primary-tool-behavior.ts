import { DetailType, InteractionEvent } from '@asyra/utils'
import { decideFromSwitchPrimaryToolRules } from '../rules'

export const decideSwitchPrimaryToolBehavior = (
  detail?: DetailType
): InteractionEvent => {
  return decideFromSwitchPrimaryToolRules(detail)
}
