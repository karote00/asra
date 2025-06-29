import {
  InteractionEvent,
  PrimaryToolType,
  SystemContextSnapshot
} from '@asra/utils'
// import { decideFromCreateElementRules, decideFromSelectRules } from '../rules'

export const decideDragEndBehavior = (
  systemContextSnapshot: SystemContextSnapshot
): InteractionEvent | null => {
  const { primaryTool } = systemContextSnapshot

  switch (primaryTool) {
    case PrimaryToolType.SELECT:
      // TODO: end area-select
      // return decideFromSelectRules(systemContextSnapshot)
      return null
    case PrimaryToolType.RECTANGLE:
      // TODO: end resize-element
      // return decideFromCreateElementRules(systemContextSnapshot)
      return null
  }

  return null
}
