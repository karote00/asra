import {
  subscribeToAddElement,
  subscribeToChangeComputedData,
  subscribeToFileLoadComplete,
  subscribeToRemoveElement,
  subscribeToSceneTreeLoadComplete,
  subscribeToUpdateComputedData
} from '@asyra/reactive-events'
import core, { sceneTree } from '../contexts'
import { elementApis } from '../common-apis'
import { UI_PROPERTIES } from '../constants'
import { buildVectorIconPath } from '../utils/vector-icon-path'

type VectorIconPathMap = Record<string, string>

const VECTOR_ICON_KEYS = new Set(['points', 'segments', 'networks', 'closed'])

const isVectorElement = (elementId: string): boolean => {
  const element = sceneTree.getElementById(elementId)
  return element?.get('type') === 'vector'
}

let iconPathMap: VectorIconPathMap = {}

const setIconPathMap = (next: VectorIconPathMap) => {
  iconPathMap = next
  core.setUIProperty(UI_PROPERTIES.VECTOR_ICON_PATH_MAP, next)
}

const updateElementIconPath = (elementId: string) => {
  if (!isVectorElement(elementId)) {
    if (elementId in iconPathMap) {
      const { [elementId]: _, ...rest } = iconPathMap
      setIconPathMap(rest)
    }
    return
  }

  const path = buildVectorIconPath(elementApis.getVectorTopology(elementId))
  if (path === null) {
    if (elementId in iconPathMap) {
      const { [elementId]: _, ...rest } = iconPathMap
      setIconPathMap(rest)
    }
    return
  }

  if (iconPathMap[elementId] === path) {
    return
  }

  setIconPathMap({
    ...iconPathMap,
    [elementId]: path
  })
}

const rebuildIconPathMap = () => {
  const nextMap: VectorIconPathMap = {}

  sceneTree.getAllElements().forEach((element, elementId) => {
    if (element.get('type') !== 'vector') {
      return
    }

    const path = buildVectorIconPath(elementApis.getVectorTopology(elementId))
    if (path !== null) {
      nextMap[elementId] = path
    }
  })

  setIconPathMap(nextMap)
}

export const initVectorIconData = (): void => {
  core.defineUIProperty<VectorIconPathMap>(UI_PROPERTIES.VECTOR_ICON_PATH_MAP, {
    defaultValue: {}
  })

  rebuildIconPathMap()

  // Core persistence load does not emit sceneTreeLoadComplete; use fileLoadComplete.
  subscribeToFileLoadComplete(() => {
    rebuildIconPathMap()
  })

  subscribeToSceneTreeLoadComplete(() => {
    rebuildIconPathMap()
  })

  subscribeToAddElement((event) => {
    const elementId = event.payload.data.id
    if (typeof elementId === 'string' && elementId.length > 0) {
      updateElementIconPath(elementId)
    }
  })

  subscribeToRemoveElement((event) => {
    const elementId = event.payload.data.id
    if (typeof elementId === 'string' && elementId.length > 0) {
      updateElementIconPath(elementId)
    }
  })

  subscribeToUpdateComputedData((event) => {
    if (!VECTOR_ICON_KEYS.has(event.payload.key)) {
      return
    }

    updateElementIconPath(event.payload.id)
  })

  subscribeToChangeComputedData((event) => {
    if (!VECTOR_ICON_KEYS.has(event.payload.key)) {
      return
    }

    event.payload.elementIds.forEach((elementId) => {
      updateElementIconPath(elementId)
    })
  })
}
