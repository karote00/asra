import { PrimaryToolType } from '@asra/utils'
import uiContext from '../../ui-context'

export class PrimaryToolStore {
  updatePrimaryTool(tool: PrimaryToolType) {
    uiContext.updatePrimaryTool(tool)
  }
}
