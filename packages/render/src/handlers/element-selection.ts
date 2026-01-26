import { updateHoveredElementId } from '@asyra/reactive-events'

export const ElementSelectionHandlers = {
  updateHoveredElement: (elementId: string | null) => {
    updateHoveredElementId(elementId)
  }
}
