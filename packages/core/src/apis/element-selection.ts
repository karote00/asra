import {
  endTransaction,
  startTransaction,
  updateTransaction
} from '@asyra/reactive-events'
import {
  EVENT_OPTIONS,
  SharedDataChannelNames,
  type SelectionChange
} from '@asyra/utils'
import type { SelectionManager } from '@asyra/selection'
import { ElementSelectionActionAPIs } from '../types'

const toSharedSelectionOptions = (options?: EVENT_OPTIONS): EVENT_OPTIONS => ({
  ...(options ?? {}),
  shared: options?.shared ?? SharedDataChannelNames.SELECTION
})

// Wrapper method names used to resolve channels from registered selection metadata.
// These are local lookup keys for core wrapper APIs (not a global registry contract).
const WrapperSelectionActionNames = {
  ELEMENT: 'selectElements',
  VECTOR_POINT: 'selectVectorPoints',
  VECTOR_SEGMENT: 'selectVectorSegments'
} as const

type SelectionRuntime = NonNullable<ReturnType<SelectionManager['get']>>

// Publishes one selection mutation as a transaction-bounded shared update.
const publishSelectionChange = (
  change: SelectionChange,
  options?: EVENT_OPTIONS
) => {
  startTransaction()
  updateTransaction(change.eventName, change, toSharedSelectionOptions(options))
  endTransaction()
}

// Converts current runtime state + target ids into a normalized transaction payload.
const buildSelectionChange = (
  selectionState: SelectionRuntime,
  after: string[],
  options?: EVENT_OPTIONS
): SelectionChange | undefined => {
  const before = Array.from(selectionState.getSelectedIds())
  const beforeSet = new Set(before)
  if (
    before.length === after.length &&
    after.every((selectionId) => beforeSet.has(selectionId))
  ) {
    return undefined
  }
  const action = selectionState.getSelectAction()
  return {
    selectionType: selectionState.getSelectionType(),
    action,
    eventName: selectionState.getEventName(),
    before,
    after,
    options
  }
}

// Strictly resolves a selection channel by action name.
// We fail fast instead of using fallback channels so selection flow stays registration-driven.
const getRequiredChannelByAction = (
  selection: Pick<SelectionManager, 'getChannelByAction'>,
  action: string
): string => {
  const channel = selection.getChannelByAction(action)
  if (!channel) {
    throw new Error(
      `[Core] Selection channel is not registered for action "${action}". Register selection definitions before invoking selection APIs.`
    )
  }
  return channel
}

export const createElementSelectionAPIs = (
  selection: Pick<SelectionManager, 'get' | 'getChannelByAction'>
): ElementSelectionActionAPIs => {
  return {
    // Low-level API: caller provides the concrete selection channel directly.
    selectByChannel(channel: string, ids: string[], options?: EVENT_OPTIONS) {
      const selectionState = selection.get(channel)
      if (!selectionState) {
        return
      }
      const change = buildSelectionChange(selectionState, ids, options)
      if (!change) {
        return
      }

      publishSelectionChange(change, options)
    },
    // Convenience wrappers: resolve channel from registration metadata, then delegate.
    selectElements(elementIds: string[], options?: EVENT_OPTIONS) {
      const channel = getRequiredChannelByAction(
        selection,
        WrapperSelectionActionNames.ELEMENT
      )
      this.selectByChannel(channel, elementIds, options)
    },
    selectVectorPoints(pointIds: string[], options?: EVENT_OPTIONS) {
      const channel = getRequiredChannelByAction(
        selection,
        WrapperSelectionActionNames.VECTOR_POINT
      )
      this.selectByChannel(channel, pointIds, options)
    },
    selectVectorSegments(segmentIds: string[], options?: EVENT_OPTIONS) {
      const channel = getRequiredChannelByAction(
        selection,
        WrapperSelectionActionNames.VECTOR_SEGMENT
      )
      this.selectByChannel(channel, segmentIds, options)
    }
  }
}
