import {
  type AddElementEvent,
  type RemoveElementEvent,
  subscribeToAddElement,
  subscribeToChangeComputedData,
  subscribeToFileLoadComplete,
  subscribeToRemoveElement,
  subscribeToSceneTreeLoadComplete,
  subscribeToUpdateComputedData
} from '@asyra/reactive-events'
import { PresetSystemPropertyKeys } from '@asyra/preset'
import core, { sceneTree } from '../../contexts'
import { elementApis } from '../../common-apis'
import { UI_PROPERTIES } from '../../constants'
import { buildVectorIconPath } from '../../utils/vector-icon-path'

type VectorIconPathMap = Record<string, string>
type VectorIconInvalidationEvent = AddElementEvent | RemoveElementEvent

const VECTOR_ICON_KEYS = new Set(['points', 'segments', 'networks', 'closed'])

const isVectorElement = (elementId: string): boolean => {
  const element = sceneTree.getElementById(elementId)
  return element?.get('type') === 'vector'
}

let iconPathMap: VectorIconPathMap = {}
const pendingElementIds = new Set<string>()
let pendingFlushHandle: number | ReturnType<typeof setTimeout> | null = null
let pendingRebuildAfterEdit = false

const isPathEditingActive = () =>
  (core.getSystemProperty<boolean>(
    PresetSystemPropertyKeys.PATH_EDITING_MODE
  ) ?? false) === true

const scheduleFlush = () => {
  if (pendingFlushHandle !== null) {
    return
  }

  const schedule =
    typeof requestAnimationFrame === 'function'
      ? requestAnimationFrame
      : (callback: FrameRequestCallback) =>
          setTimeout(() => callback(Date.now()), 16)

  pendingFlushHandle = schedule(() => {
    pendingFlushHandle = null
    if (isPathEditingActive()) {
      pendingElementIds.clear()
      pendingRebuildAfterEdit = true
      return
    }

    if (pendingElementIds.size === 0) {
      return
    }

    let changed = false
    const nextMap = { ...iconPathMap }
    pendingElementIds.forEach((elementId) => {
      pendingElementIds.delete(elementId)
      if (!isVectorElement(elementId)) {
        if (elementId in nextMap) {
          // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
          delete nextMap[elementId]
          changed = true
        }
        return
      }

      const path = buildVectorIconPath(elementApis.getVectorTopology(elementId))
      if (path === null) {
        if (elementId in nextMap) {
          // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
          delete nextMap[elementId]
          changed = true
        }
        return
      }

      if (nextMap[elementId] !== path) {
        nextMap[elementId] = path
        changed = true
      }
    })

    if (changed) {
      setIconPathMap(nextMap)
    }
  })
}

const setIconPathMap = (next: VectorIconPathMap) => {
  iconPathMap = next
  core.setUIProperty(UI_PROPERTIES.VECTOR_ICON_PATH_MAP, next)
}

const enqueueElementIconPathUpdate = (elementId: string) => {
  if (isPathEditingActive()) {
    pendingRebuildAfterEdit = true
    return
  }

  pendingElementIds.add(elementId)
  scheduleFlush()
}

const enqueueElementIconPathUpdateFromEvent = (
  event: VectorIconInvalidationEvent
): void => {
  const elementId = event.payload.data.id
  if (typeof elementId === 'string' && elementId.length > 0) {
    enqueueElementIconPathUpdate(elementId)
  }
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

  const pathEditingObservable = core.getSystemPropertyObservable<boolean>(
    PresetSystemPropertyKeys.PATH_EDITING_MODE
  )
  if (pathEditingObservable) {
    let previous = pathEditingObservable.getValue()
    pathEditingObservable.subscribe((next) => {
      const wasEditing = previous === true
      previous = next
      if (wasEditing && next === false) {
        if (pendingRebuildAfterEdit) {
          pendingRebuildAfterEdit = false
          pendingElementIds.clear()
          rebuildIconPathMap()
        }
      }
    })
  }

  subscribeToAddElement(enqueueElementIconPathUpdateFromEvent)
  subscribeToRemoveElement(enqueueElementIconPathUpdateFromEvent)

  subscribeToUpdateComputedData((event) => {
    if (!VECTOR_ICON_KEYS.has(event.payload.key)) {
      return
    }

    enqueueElementIconPathUpdate(event.payload.id)
  })

  subscribeToChangeComputedData((event) => {
    if (!VECTOR_ICON_KEYS.has(event.payload.key)) {
      return
    }

    event.payload.elementIds.forEach((elementId) => {
      enqueueElementIconPathUpdate(elementId)
    })
  })
}
