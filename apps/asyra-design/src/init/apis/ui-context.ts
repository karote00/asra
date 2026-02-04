import uiContext from '@asyra/ui-context'

export const uiContextApis = {
  switchPrimaryTool: (primaryTool: string) => {
    uiContext.updatePrimaryTool(primaryTool)
  }
}
