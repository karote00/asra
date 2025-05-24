import { PrimaryToolType } from '@asra/utils'
import { CoreAPIs } from '../../types'
import { initPrimaryToolHandlers } from './tool'

export const initInteractionCoreHandlers = (apis: CoreAPIs) => {
  initPrimaryToolHandlers({
    switchPrimaryTool: (primaryTool: PrimaryToolType) =>
      apis.switchPrimaryTool(primaryTool)
  })
}
