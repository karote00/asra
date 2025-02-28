import { useState, useEffect } from 'react'
import {
  subscribeToEndTransaction,
  subscribeToSceneTreeLoadComplete
} from '@asra/reactive-events'
import { BehaviorSubject } from 'rxjs'
import { sceneTreeStore } from '@asra/ui-context'
import { sceneTreeManager } from '../contexts'
import { ElementRawData, WorkspaceRawData } from '@asra/utils'

type UIElementData = ElementRawData
type UIWorkspaceData = Pick<
  WorkspaceRawData,
  'id' | 'name' | 'type' | 'children'
>

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

export const useElementData = (elementId: string) => {
  const subject = sceneTreeStore.getElement(elementId)
  const [data, setData] = useState(subject?.getValue())

  useEffect(() => {
    if (!subject) return

    const sub = (
      subject as BehaviorSubject<UIElementData | UIWorkspaceData>
    ).subscribe(setData)
    return () => sub.unsubscribe()
  }, [subject])

  return data
}
