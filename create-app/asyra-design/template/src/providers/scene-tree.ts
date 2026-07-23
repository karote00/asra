import { useSyncExternalStore } from 'react'
import { useProperty } from '../hooks'
import type { ElementRawData } from '@asyra/utils'
import { UI_PROPERTIES } from '../constants'
import core from '../contexts'

export const useFlattenedIdsData = (): string[] =>
  useProperty<string[]>('flattenedElementIds')

type ElementDataMap = Record<string, Partial<ElementRawData>>

export const useElementDataMap = (): ElementDataMap =>
  useProperty<ElementDataMap>('elementDataMap') ?? {}

export const useElementData = (elementId: string): Partial<ElementRawData> => {
  const elementDataMap = useElementDataMap()
  return elementDataMap[elementId] ?? {}
}

export const useVectorIconPathMap = (elementId: string): string | null => {
  // useSyncExternalStore requires:
  // 1) subscribe: notify when this element's path changes
  // 2) getSnapshot: current value for client render
  // 3) getServerSnapshot: current value for SSR render
  const getSnapshot = () => {
    const map = core.getUIProperty<Record<string, string>>(
      UI_PROPERTIES.VECTOR_ICON_PATH_MAP
    )
    return map?.[elementId] ?? null
  }

  return useSyncExternalStore(
    (callback) => {
      const subject = core.getUIPropertySubject<Record<string, string>>(
        UI_PROPERTIES.VECTOR_ICON_PATH_MAP
      )
      if (!subject) {
        return () => undefined
      }

      let previous = subject.getValue()
      const subscription = subject.subscribe((next) => {
        // Only notify when this element's path changes, not the whole map.
        const previousPath = previous?.[elementId]
        const nextPath = next?.[elementId]
        if (previousPath !== nextPath) {
          previous = next
          callback()
          return
        }

        previous = next
      })

      return () => subscription.unsubscribe()
    },
    getSnapshot,
    getSnapshot
  )
}
