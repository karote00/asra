import { startTransaction, endTransaction } from '@asyra/reactive-events'
import type { DataTypes, EVENT_OPTIONS } from '@asyra/utils'
import core from '../../contexts'

export const changeComputedData = (
  elementIds: string[],
  data: Record<string, DataTypes>,
  options?: EVENT_OPTIONS
) => {
  const entries = Object.entries(data ?? {})
  if (entries.length === 0) {
    return
  }

  startTransaction()
  core.changeComputedData(elementIds, data, options)
  endTransaction()
}
