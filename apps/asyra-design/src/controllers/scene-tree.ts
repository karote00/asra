import { DataTypes } from '@asyra/utils'
import { elementApis, selectionApis, transactionApis } from '../common-apis'

export const changeElementComputedData = (key: string, data: DataTypes) => {
  const selectedIds = selectionApis.getSelectedIds()
  console.log('[changeElementComputedData]', { key, data, selectedIds })

  if (selectedIds.length === 0) {
    console.warn('[changeElementComputedData] No elements selected')
    return
  }

  transactionApis.startTransaction()
  elementApis.changeComputedData(selectedIds, key, data)
  transactionApis.endTransaction()
}
