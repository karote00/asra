import { PositionData, PrimaryToolType } from '@asra/utils'
import { initPrimaryToolHandlers } from './primary-tool'
import { initCreateElementHandlers } from './create-element'
import { CoreAPIs, HandlerDeps } from '../../types'

export const initInteractionCoreHandlers = (
  deps: HandlerDeps,
  apis: CoreAPIs
) => {
  initPrimaryToolHandlers({
    switchPrimaryTool: (primaryTool: PrimaryToolType) =>
      apis.switchPrimaryTool(primaryTool)
  })

  initCreateElementHandlers(deps.render, {
    addRectangle: (pos: PositionData) => apis.addRectangle(pos)
  })
}
