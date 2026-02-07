import core from '../../contexts'
import { defineFeature } from '@asyra/feature-system'
import type { Container, Graphics } from 'pixi.js'

type SceneElement = Container | Graphics

export const hoverElementFeature = defineFeature(
  'hoverElement',
  'input.mouse.move',
  {
    api: {},
    execution: (snapshot: any) => {
      if (!core.deps.render) return null

      const { mouse } = snapshot
      const render = core.deps.render

      const mousePosInWorkspace = render.getMousePosInWorkspace({
        clientX: mouse.position.x,
        clientY: mouse.position.y
      })

      const elements = render.viewport.view.children[0].children
      if (!elements || elements.length === 0) {
        core.deps.systemContext.updateHoveredElementId(null)
        return null
      }

      let hoveredElementId: string | null = null

      // Iterate in reverse to check top-most elements first (higher index = rendered on top)
      for (let i = elements.length - 1; i >= 0; i--) {
        const element = elements[i]
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

      core.deps.systemContext.updateHoveredElementId(hoveredElementId)

      return { hoveredId: hoveredElementId }
    }
  }
)
