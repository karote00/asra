import { DataTypes } from '@asyra/utils'
import { elementApis, selectionApis, transactionApis } from '../common-apis'

export const changeElementComputedData = (key: string, data: DataTypes) => {
  transactionApis.startTransaction()
  elementApis.changeComputedData(selectionApis.getSelectedIds(), key, data)
  transactionApis.endTransaction()
}
