import { runTransaction } from '@asyra/core'
import { projectGroupGeometryPropertyUpdates } from '@asyra/preset'
import {
  EntityTypes,
  measureBrowserDragPhase,
  type DataTypes,
  type EVENT_OPTIONS
} from '@asyra/utils'
import core from '../../contexts'

const GROUP_GEOMETRY_KEYS = new Set(['x', 'y', 'width', 'height'])

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
      const directRequest = elementIds.map((elementId) => ({
        elementId,
        values
      }))
      const explicitGroupElementIds = entries.some(([key]) =>
        GROUP_GEOMETRY_KEYS.has(key)
      )
        ? elementIds.filter(
            (elementId) =>
              core.getElementData(elementId)?.type === EntityTypes.GROUP
          )
        : []
      const request =
        explicitGroupElementIds.length > 0
          ? projectGroupGeometryPropertyUpdates(
              core,
              directRequest,
              explicitGroupElementIds
            )
          : directRequest
      core.updateElementProperties(request, options)
    })
  })
}
