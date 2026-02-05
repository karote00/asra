import core from '../../contexts'
import { InputSystemEvents } from '../../constants'
import { defineFeature } from '@asyra/feature-system'
import type { Container, Graphics } from 'pixi.js'

type SceneElement = Container | Graphics

export const hoverElementFeature = defineFeature('hoverElement', undefined, {
  name: 'hoverElement',
  api: {},
  define: ({
    handle
  }: {
    handle: (event: string, callback: (snapshot: any, raw?: any) => any) => void
  }) => {
    let lastHoveredElementId: string | null = null

    handle(InputSystemEvents.INPUT_MOUSE_MOVE, (snapshot: any) => {
      if (!core.deps.render) return null

      const { mouse } = snapshot
      const render = core.deps.render

      const mousePosInWorkspace = render.getMousePosInWorkspace({
        clientX: mouse.position.x,
        clientY: mouse.position.y
      })

      const elements = render.viewport.view.children[0].children
      if (!elements || elements.length === 0) {
        if (lastHoveredElementId !== null) {
          core.deps.systemContext.updateHoveredElementId(null)
          lastHoveredElementId = null
        }
        return null
      }

      let hoveredElementId: string | null = null

      for (const element of elements) {
        const sceneElement = element as SceneElement
        if (!sceneElement.label) continue

        const bounds = sceneElement.getBounds()
        const isInBounds =
          mousePosInWorkspace.x >= bounds.x &&
          mousePosInWorkspace.x <= bounds.x + bounds.width &&
          mousePosInWorkspace.y >= bounds.y &&
          mousePosInWorkspace.y <= bounds.y + bounds.height

        if (isInBounds) {
          hoveredElementId = sceneElement.label
          break
        }
      }

      if (hoveredElementId !== lastHoveredElementId) {
        core.deps.systemContext.updateHoveredElementId(hoveredElementId)
        lastHoveredElementId = hoveredElementId
      }

      return null
    })
  }
})
