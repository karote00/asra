import type { DecisionResult } from '@asyra/interaction-core'
import { decideToCreateElement } from '@asyra/reactive-events'
import { SystemContextSnapshot } from '@asyra/utils'

export const decideFromCreateElementRules = (
  systemContextSnapshot: SystemContextSnapshot
): DecisionResult => {
  const { primaryTool, mouse } = systemContextSnapshot
  return {
    type: 'INTERACTION_CREATE_ELEMENT',
    payload: {
      position: mouse.position,
      elementType: primaryTool
    },
    handler: (payload: any) =>
      decideToCreateElement(payload.position, payload.elementType)
  }
}
