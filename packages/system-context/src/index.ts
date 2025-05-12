import { ToolType } from '@asra/utils'
import allApis from './apis'
import { SystemContextAPIs } from './types'
import { ToolAPIs } from './types/tool'

export class SystemContext implements SystemContextAPIs {
  getCurrentTool!: ToolAPIs['getCurrentTool']
  switchTool!: ToolAPIs['switchTool']

  constructor() {
    Object.assign(this, allApis)
  }
}

export default new SystemContext()
