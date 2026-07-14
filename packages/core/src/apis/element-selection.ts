import {
  acknowledgeTransactionReplayApplied,
  EventTypes,
  runTransaction,
  runWithTransactionOwner,
  updateTransaction,
  type AllEvent,
  type TransactionReplayMode
} from '@asyra/reactive-events'
import type { Factory } from '@asyra/factory'
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

const BuiltInSelectionEventNames = new Set<string>([
  EventTypes.SELECT_ELEMENTS,
  EventTypes.SELECT_VECTOR_POINTS,
  EventTypes.SELECT_VECTOR_SEGMENTS
])

// Publishes one selection mutation as a transaction-bounded shared update.
const publishSelectionChange = (
  selectionState: SelectionRuntime,
  change: SelectionChange,
  options?: EVENT_OPTIONS,
  factory?: Factory
) => {
  const mutate = () =>
    runTransaction(() => {
      updateTransaction(
        change.eventName,
        change,
        toSharedSelectionOptions(options)
      )
      selectionState.select(change.after, options)
      selectionState.cleanChanges()
    })

  if (factory) {
    return runWithTransactionOwner(factory.getTransactionOwner(), mutate)
  }

  return mutate()
}

const applySelectionReplay = (
  selection: Pick<SelectionManager, 'get'>,
  apis: ElementSelectionActionAPIs,
  event: AllEvent,
  mode: TransactionReplayMode
): boolean => {
  const change = (event as AllEvent & { payload: SelectionChange }).payload
  const selectionState = selection.get(change.selectionType)
  if (!selectionState) {
    throw new Error(
      `Selection replay channel is not registered: ${change.selectionType}`
    )
  }

  const before = [...selectionState.getSelectedIds()]
  const didSelectionChange = () => {
    const after = selectionState.getSelectedIds()
    return before.length !== after.size || before.some((id) => !after.has(id))
  }

  try {
    if (mode === 'rollback') {
      selectionState.select(change.after, change.options)
      if (didSelectionChange()) {
        acknowledgeTransactionReplayApplied()
      }
      selectionState.cleanChanges()
    } else {
      apis.selectByChannel(change.selectionType, change.after, change.options)
    }
  } catch (failure) {
    if (didSelectionChange()) {
      acknowledgeTransactionReplayApplied()
    }
    throw failure
  }

  const applied = didSelectionChange()
  if (applied) {
    acknowledgeTransactionReplayApplied()
  }
  return applied
}

const invertSelectionEvent = (event: AllEvent): AllEvent => {
  const change = (event as AllEvent & { payload: SelectionChange }).payload
  return {
    ...event,
    payload: {
      ...change,
      before: [...change.after],
      after: [...change.before]
    }
  } as AllEvent
}

const createSelectionReplayRegistrar = (
  selection: Pick<SelectionManager, 'get'>,
  factory: Factory,
  apis: ElementSelectionActionAPIs
) => {
  const registeredEventNames = new Set<string>()

  return (eventName: string) => {
    if (registeredEventNames.has(eventName)) {
      return
    }
    if (!BuiltInSelectionEventNames.has(eventName)) {
      factory.registerTransactionInverter(eventName, invertSelectionEvent)
    }
    factory.registerTransactionReplayHandler(eventName, (event, mode) => {
      return applySelectionReplay(selection, apis, event, mode)
    })
    registeredEventNames.add(eventName)
  }
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
  selection: Pick<SelectionManager, 'get' | 'getChannelByAction'>,
  factory?: Factory
): ElementSelectionActionAPIs => {
  let ensureSelectionReplayContract: (eventName: string) => void = () =>
    undefined
  const apis: ElementSelectionActionAPIs = {
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

      ensureSelectionReplayContract(change.eventName)
      publishSelectionChange(selectionState, change, options, factory)
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

  if (factory) {
    ensureSelectionReplayContract = createSelectionReplayRegistrar(
      selection,
      factory,
      apis
    )
    BuiltInSelectionEventNames.forEach(ensureSelectionReplayContract)
  }

  return apis
}
