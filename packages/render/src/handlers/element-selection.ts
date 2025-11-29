import { updateHoveredElementId } from '@asra/reactive-events'

export const ElementSelectionHandlers = {
  updateHoveredElement: (elementId: string | null) => {
    updateHoveredElementId(elementId)
  }
}
