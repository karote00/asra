import { useState, useEffect } from 'react'
import {
  subscribeToEndTransaction,
  subscribeToSceneTreeLoadComplete
} from '@asra/reactive-events'
import { BehaviorSubject } from 'rxjs'
import { sceneTreeStore } from '@asra/ui-context'
import { sceneTreeManager } from '../contexts'
import { ElementRawData } from '@asra/utils'

import { createStore } from './utils'

export const useFlattenedIdsData = (): string[] => {
  const [flattenedIds, setFlattenedIds] = useState<string[]>([])

  useEffect(() => {
    if (!sceneTreeManager) {
      return
    }

    const sceneTreeLoadCompleteSubscription = subscribeToSceneTreeLoadComplete(
      () => {
        sceneTreeStore.reload()
        setFlattenedIds(sceneTreeStore.flattenedElementIds)
      }
    )

    const transactSubscription = subscribeToEndTransaction(() => {
      sceneTreeStore.updateFlattenedElementIds()
      setFlattenedIds(sceneTreeStore.flattenedElementIds)
    })

    return () => {
      transactSubscription.unsubscribe()
      sceneTreeLoadCompleteSubscription.unsubscribe()
    }
  }, [])

  return flattenedIds
}

export const useElementData = (elementId: string): Partial<ElementRawData> => {
  const subject = sceneTreeStore.getElement(
    elementId
  ) as BehaviorSubject<ElementRawData>
  if (!subject) return {}
  return createStore(subject)
}
