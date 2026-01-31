import type { DecisionResult } from '@asyra/interaction-core'
import { decideToResetElementSize } from '@asyra/reactive-events'
import { SystemContextSnapshot, DEFAULT_ELEMENT_SIZE } from '@asyra/utils'

export const decideFromResetElementSizeRules = (
  systemContextSnapshot: SystemContextSnapshot
): DecisionResult | null => {
  const { primaryTool, mouse } = systemContextSnapshot
  if (mouse.down && !mouse.dragging) {
    return {
      type: 'INTERACTION_RESET_ELEMENT_SIZE',
      payload: {
        dimension: {
          width: DEFAULT_ELEMENT_SIZE,
          height: DEFAULT_ELEMENT_SIZE
        },
        elementType: primaryTool
      },
      handler: (payload: any) =>
        decideToResetElementSize(payload.dimension, payload.elementType)
    }
  }

  return null
}
