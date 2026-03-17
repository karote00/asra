import type { EVENT_OPTIONS } from '@asyra/utils'
import { elementApis } from '../common-apis'

export const toggleElementLock = (
  elementId: string,
  options?: EVENT_OPTIONS
): void => {
  elementApis.toggleElementLock(elementId, options)
}

export const toggleElementVisible = (
  elementId: string,
  options?: EVENT_OPTIONS
): void => {
  elementApis.toggleElementVisible(elementId, options)
}
