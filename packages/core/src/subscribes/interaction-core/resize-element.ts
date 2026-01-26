import { subscribeToDecideToResizeElement } from '@asyra/reactive-events'
import { HandlerDeps, SceneTreeActionAPIs } from '../../types'

export const initResizeElementHandlers = (
  render: HandlerDeps['render'],
  apis: SceneTreeActionAPIs
) => {
  subscribeToDecideToResizeElement(({ payload, options }) => {
    const { dragStart, position } = payload

    const oldPos = render.getMousePosInWorkspace({
      clientX: dragStart.x,
      clientY: dragStart.y
    })
    const newPos = render.getMousePosInWorkspace({
      clientX: position.x,
      clientY: position.y
    })

    const pos = {
      x: Math.min(oldPos.x, newPos.x),
      y: Math.min(oldPos.y, newPos.y)
    }
    const dimension = {
      width: Math.abs(newPos.x - oldPos.x),
      height: Math.abs(newPos.y - oldPos.y)
    }

    apis.resizeElement(pos, dimension, options)
  })
}
