import type { DecisionResult } from '@asyra/interaction-core'
import { decideToResizeElement } from '@asyra/reactive-events'
import { SystemContextSnapshot } from '@asyra/utils'

export const decideFromResizeElementRules = (
  systemContextSnapshot: SystemContextSnapshot
): DecisionResult => {
  const { primaryTool, mouse } = systemContextSnapshot

  return {
    type: 'INTERACTION_RESIZE_ELEMENT',
    payload: {
      dragStart: mouse.dragStart,
      position: mouse.position,
      elementType: primaryTool
    },
    options: {
      undoable: false
    },
    handler: (payload: any, options: any) =>
      decideToResizeElement(
        payload.dragStart,
        payload.position,
        payload.elementType,
        options
      )
  }
}
