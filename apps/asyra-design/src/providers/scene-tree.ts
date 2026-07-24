import { useSyncExternalStore } from 'react'
import type { ElementRawData } from '@asyra/utils'
import type { PropertyValue } from '@asyra/ui-context'
import { UI_PROPERTIES } from '../constants'
import core from '../contexts'

type ElementDataMap = Record<string, Partial<ElementRawData>>

const EMPTY_FLATTENED_IDS: string[] = []
const EMPTY_ELEMENT_DATA_MAP: ElementDataMap = {}

const useCanonicalUIProperty = <T extends PropertyValue>(
  key: string,
  fallback: T
): T => {
  const getSnapshot = () => core.getUIProperty<T>(key) ?? fallback

  return useSyncExternalStore(
    (callback) => {
      const subject = core.getUIPropertySubject<T>(key)
      if (!subject) {
        return () => undefined
      }

      const subscription = subject.subscribe(callback)
      return () => subscription.unsubscribe()
    },
    getSnapshot,
    getSnapshot
  )
}

export const useFlattenedIdsData = (): string[] =>
  useCanonicalUIProperty(
    UI_PROPERTIES.FLATTENED_ELEMENT_IDS,
    EMPTY_FLATTENED_IDS
  )

export const useElementDataMap = (): ElementDataMap =>
  useCanonicalUIProperty(
    UI_PROPERTIES.ELEMENT_DATA_MAP,
    EMPTY_ELEMENT_DATA_MAP
  )

export const useElementData = (elementId: string): Partial<ElementRawData> => {
  const elementDataMap = useElementDataMap()
  return elementDataMap[elementId] ?? {}
}

export const useVectorIconPathMap = (elementId: string): string | null => {
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
