import {
  InteractionActions,
  InteractionEvent,
  SystemContextSnapshot,
  DEFAULT_ELEMENT_SIZE
} from '@asra/utils'

export const decideFromResetElementSizeRules = (
  systemContextSnapshot: SystemContextSnapshot
): InteractionEvent | null => {
    const { primaryTool, mouse } = systemContextSnapshot
    if (mouse.down && !mouse.dragging) {
        // If never move mouse, then update new element's size to 100*100
        const interaction: InteractionEvent = {
            type: InteractionActions.INTERACTION_RESET_ELEMENT_SIZE,
            payload: {
            dimension: {
                width: DEFAULT_ELEMENT_SIZE,
                height: DEFAULT_ELEMENT_SIZE
            },
            elementType: primaryTool
            }
        }

        return interaction
    }

    return null
}
