import { BehaviorSubject } from 'rxjs'
import { uiContextSceneTreeStore } from '@asyra/ui-context'
import { useProperty } from '../hooks'
import { ElementRawData } from '@asyra/utils'

import { createStore } from './utils'

export const useFlattenedIdsData = (): string[] =>
  useProperty<string[]>('flattenedElementIds')

export const useElementData = (elementId: string): Partial<ElementRawData> => {
  const subject = uiContextSceneTreeStore.getElement(
    elementId
  ) as BehaviorSubject<ElementRawData>

  if (!subject) return {}

  return createStore(subject)
}
