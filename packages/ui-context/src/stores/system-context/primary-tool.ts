import uiContext from '../../ui-context'

export class PrimaryToolStore {
  updatePrimaryTool(tool: string) {
    uiContext.updatePrimaryTool(tool)
  }
}
