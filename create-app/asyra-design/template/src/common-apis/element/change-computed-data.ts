import { runTransaction } from '@asyra/core'
import { normalizeGroupsForElements } from '@asyra/preset'
import {
  measureBrowserDragPhase,
  type DataTypes,
  type EVENT_OPTIONS
} from '@asyra/utils'
import core from '../../contexts'

const GROUP_GEOMETRY_COMPUTED_KEYS = new Set(['x', 'y', 'width', 'height'])

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
    runTransaction(() => {
      core.changeComputedData(elementIds, data, options)

      const changesGroupGeometry = entries.some(([key]) =>
        GROUP_GEOMETRY_COMPUTED_KEYS.has(key)
      )
      if (changesGroupGeometry) {
        normalizeGroupsForElements(core, elementIds, options)
      }
    })
  })
}
