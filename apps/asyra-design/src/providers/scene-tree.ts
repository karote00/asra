import { useProperty } from '../hooks'
import type { ElementRawData } from '@asyra/utils'

export const useFlattenedIdsData = (): string[] =>
  useProperty<string[]>('flattenedElementIds')

type ElementDataMap = Record<string, Partial<ElementRawData>>

export const useElementData = (elementId: string): Partial<ElementRawData> => {
  const elementDataMap = useProperty<ElementDataMap>('elementDataMap') ?? {}
  return elementDataMap[elementId] ?? {}
}
