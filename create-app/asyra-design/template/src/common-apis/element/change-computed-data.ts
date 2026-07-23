import { runTransaction } from '@asyra/core'
import {
  measureBrowserDragPhase,
  type DataTypes,
  type EVENT_OPTIONS
} from '@asyra/utils'
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

  measureBrowserDragPhase('computed:changeComputedData', () => {
    runTransaction(() => core.changeComputedData(elementIds, data, options))
  })
}
