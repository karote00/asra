import { DataTypes } from '@asyra/utils'
import { elementApis, selectionApis } from '../common-apis'

const NUMERIC_COMPUTED_KEYS = new Set(['x', 'y', 'width', 'height', 'rotation'])

export const changeElementComputedData = (key: string, data: DataTypes) => {
  if (NUMERIC_COMPUTED_KEYS.has(key)) {
    if (typeof data !== 'number' || !Number.isFinite(data)) {
      return
    }
  }

  elementApis.changeComputedData(selectionApis.getSelectedIds(), {
    [key]: data
  })
}
