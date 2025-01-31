import { useState, useEffect } from 'react'
import { effect } from '@preact/signals-react'
import { subscribeToEndTransaction } from '@asra/reactive-events'
import { sceneTreeManager } from '../contexts'
import { flattenedElementIds } from '../states/scene-tree'
import { completeSceneTreeChange } from '../processor/scene-tree'

export const useFlattenedIdsData = (): string[] => {
  const [flattenedIds, setFlattenedIds] = useState<string[]>([])

  useEffect(() => {
    if (!sceneTreeManager) {
      return
    }

    const transactSubscription = subscribeToEndTransaction(() => {
      completeSceneTreeChange()
    })

    effect(() => {
      setFlattenedIds(flattenedElementIds.value)
    })

    return () => {
      transactSubscription.unsubscribe()
    }
  }, [])

  return flattenedIds
}
