import { runTransaction } from '@asyra/core'
import { projectGroupGeometryPropertyUpdates } from '@asyra/preset'
import {
  measureBrowserDragPhase,
  type DataTypes,
  type EVENT_OPTIONS
} from '@asyra/utils'
import core from '../../contexts'

export const updateElementProperties = (
  elementIds: readonly string[],
  values: Readonly<Record<string, DataTypes>>,
  options?: EVENT_OPTIONS
) => {
  const entries = Object.entries(values ?? {})
  if (elementIds.length === 0 || entries.length === 0) {
    return
  }

  measureBrowserDragPhase('canonical:updateElementProperties', () => {
    runTransaction(() => {
      const request = projectGroupGeometryPropertyUpdates(
        core,
        elementIds.map((elementId) => ({ elementId, values }))
      )
      core.updateElementProperties(request, options)
    })
  })
}
