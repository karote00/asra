import { BehaviorSubject } from 'rxjs'
import uiContext, { sceneTreeStore } from '@asyra/ui-context'
import { ElementRawData } from '@asyra/utils'

import { createStore } from './utils'

export const useFlattenedIdsData = (): string[] =>
  createStore(uiContext.flattenedElementIds)

export const useElementData = (elementId: string): Partial<ElementRawData> => {
  const subject = sceneTreeStore.getElement(
    elementId
  ) as BehaviorSubject<ElementRawData>
  if (!subject) return {}
  return createStore(subject)
}
