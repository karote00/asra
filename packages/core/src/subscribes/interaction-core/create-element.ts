import { subscribeToDecideToCreateElement } from '@asyra/reactive-events'
import { HandlerDeps, SceneTreeHandlerAPIs } from '../../types'
import { PrimaryToolType } from '@asyra/utils'

export const initCreateElementHandlers = (
  render: HandlerDeps['render'],
  apis: SceneTreeHandlerAPIs
) => {
  subscribeToDecideToCreateElement(({ payload }) => {
    const { position, elementType } = payload
    const pos = render.getMousePosInWorkspace({
      clientX: position.x,
      clientY: position.y
    })

    switch (elementType) {
      case PrimaryToolType.RECTANGLE:
        apis.addRectangle(pos)
        break
    }
  })
}
