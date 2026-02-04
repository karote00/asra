import { systemContext } from '../../contexts'

export const systemContextApis = {
  switchPrimaryTool: (primaryTool: string) => {
    systemContext.switchPrimaryTool(primaryTool)
  }
}
