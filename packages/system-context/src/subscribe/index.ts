import { PrimaryToolType } from '@asra/utils'
import { SystemContextAPIs } from '../types'
import { initPrimaryToolSubscribe } from './primary-tool'

export const initSystemContextSubscribe = (apis: SystemContextAPIs) => {
  initPrimaryToolSubscribe({
    getCurrentPrimaryTool: () => apis.getCurrentPrimaryTool(),
    switchPrimaryTool: (tool: PrimaryToolType) => apis.switchPrimaryTool(tool)
  })
}
