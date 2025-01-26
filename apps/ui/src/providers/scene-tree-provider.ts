import { useState, useEffect, useRef } from 'react'
import Factory from '@asra/factory'
import { effect } from '@preact/signals-react'
import { subscribeToEndTransaction } from '@asra/reactive-events'
import { sceneTreeManager } from '../states/data-context'
import { flattenedElementIds } from '../states/scene-tree'
import {
  collectSceneTreeChange,
  completeSceneTreeChange
} from '../processor/scene-tree'

const sceneTreeArray = Factory.sceneTreeMap

export const useFlattenedIdsData = (): string[] => {
  const [isInitialized, setIsInitialized] = useState(false)
  const [flattenedIds, setFlattenedIds] = useState<string[]>([])
  const handleYJSChangesRef = useRef<(() => void) | undefined>(undefined)

  useEffect(() => {
    if (!sceneTreeManager) {
      return
    }

    if (!isInitialized) {
      flattenedElementIds.value = []
      setIsInitialized(true)
    }

    handleYJSChangesRef.current = () => {
      completeSceneTreeChange()
    }

    sceneTreeArray.observe(collectSceneTreeChange)

    const transactSubscription = subscribeToEndTransaction(() => {
      if (handleYJSChangesRef.current) {
        handleYJSChangesRef.current()
      }
    })

    effect(() => {
      setFlattenedIds(flattenedElementIds.value)
    })

    return () => {
      sceneTreeArray.unobserve(collectSceneTreeChange)
      transactSubscription.unsubscribe()
    }
  }, [])

  return flattenedIds
}
