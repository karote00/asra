import type { SceneTree } from '@asyra/scene-tree'
import { idCounter } from '@asyra/utils'
import { VECTOR_ANCHOR_ID_TYPE } from '../../types/vector'

const readPointId = (point: unknown): string | null => {
  if (!point || typeof point !== 'object') {
    return null
  }

  const candidate = (point as { id?: unknown }).id
  return typeof candidate === 'string' ? candidate : null
}

export const hydrateVectorAnchorIdCounter = (sceneTree: SceneTree): void => {
  const elements = sceneTree.getAllElements()

  elements.forEach((element) => {
    if (element.get('type') !== 'vector') {
      return
    }

    const computedData = element.getAllComputedData() as {
      anchorPoints?: unknown
    }

    const anchorPoints = computedData.anchorPoints
    if (!Array.isArray(anchorPoints)) {
      return
    }

    anchorPoints.forEach((point) => {
      const pointId = readPointId(point)
      if (pointId) {
        idCounter.load(pointId, VECTOR_ANCHOR_ID_TYPE)
      }
    })
  })
}
