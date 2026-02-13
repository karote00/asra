import { DataTypes } from '@asyra/utils'
import { elementApis, selectionApis } from '../common-apis'

export const changeElementComputedData = (key: string, data: DataTypes) => {
  elementApis.changeComputedData(selectionApis.getSelectedIds(), { [key]: data })
}
