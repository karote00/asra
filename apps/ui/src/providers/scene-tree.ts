import { useState, useEffect } from 'react'
import { subscribeToEndTransaction } from '@asra/reactive-events'
import { sceneTreeStore } from '@asra/ui-context'
import { sceneTreeManager } from '../contexts'

export const useFlattenedIdsData = (): string[] => {
  const [flattenedIds, setFlattenedIds] = useState<string[]>([])

  useEffect(() => {
    if (!sceneTreeManager) {
      return
    }

    const transactSubscription = subscribeToEndTransaction(() => {
      sceneTreeStore.updateFlattenedElementIds()
      setFlattenedIds(sceneTreeStore.flattenedElementIds)
    })

    return () => {
      transactSubscription.unsubscribe()
    }
  }, [])

  return flattenedIds
}

export const useElementData = (elementId: string) => {
  const subject = sceneTreeStore.getElement(elementId)
  const [data, setData] = useState(subject?.getValue())

  useEffect(() => {
    const subscription = subject?.subscribe(setData)
    return () => subscription?.unsubscribe()
  }, [subject])

  return data
}
