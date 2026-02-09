import { defineFeature } from '@asyra/feature-system'
import { render } from '../../contexts'
import type { SystemContextSnapshot } from '@asyra/utils'
import { MouseButton } from '@asyra/utils'

interface PanState {
  startX: number
  startY: number
  viewportStartX: number
  viewportStartY: number
}

export const panFeature = defineFeature('pan', 'input.drag', {
  priority: 4,
  exclusive: false,
  api: {
    pan: (deltaX: number, deltaY: number) => {
      const currentPosition = render.getViewportPosition()
      render.panTo(currentPosition.x + deltaX, currentPosition.y + deltaY)
    }
  },
  session: {
    start: (snapshot: SystemContextSnapshot) => {
      const api = panFeature.api as {
        pan: (deltaX: number, deltaY: number) => void
      }

      const mouse = snapshot.mouse

      // FR-010: Middle mouse button drag panning
      // Note: Space+drag (FR-008) requires keyboard shortcut detection - future work
      if (mouse.button === MouseButton.MIDDLE) {
        const currentViewportPosition = render.getViewportPosition()

        return {
          startX: mouse.position.x,
          startY: mouse.position.y,
          viewportStartX: currentViewportPosition.x,
          viewportStartY: currentViewportPosition.y
        } as PanState
      }

      return null
    },
    update: (snapshot: SystemContextSnapshot, state: PanState) => {
      if (!state) {
        return
      }

      const api = panFeature.api as {
        pan: (deltaX: number, deltaY: number) => void
      }

      const mouse = snapshot.mouse
      const deltaX = mouse.position.x - state.startX
      const deltaY = mouse.position.y - state.startY

      // Pan viewport
      api.pan(-deltaX, -deltaY)
    },
    end: (snapshot: SystemContextSnapshot, state: PanState) => {
      // Clean up is automatic - state is cleared by session manager
    }
  }
})

export default panFeature
