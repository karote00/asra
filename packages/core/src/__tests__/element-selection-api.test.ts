import { describe, expect, it, vi } from 'vitest'
import {
  EventTypes,
  subscribeToUpdateTransaction
} from '@asyra/reactive-events'
import { SharedDataChannelNames } from '@asyra/utils'
import { BaseSelection } from '@asyra/selection'
import { Factory, TransactionValidationError } from '@asyra/factory'
import { createElementSelectionAPIs } from '../apis/element-selection'

describe('createElementSelectionAPIs.selectElements', () => {
  const channels = {
    element: 'element',
    vectorPoint: 'vectorPoint',
    vectorSegment: 'vectorSegment'
  } as const

  const createSelectionDeps = () => {
    const selections = new Map<string, BaseSelection>([
      [
        channels.element,
        new BaseSelection({
          selectionType: channels.element,
          selectAction: 'selectElements',
          eventName: 'selectElements'
        })
      ],
      [
        channels.vectorPoint,
        new BaseSelection({
          selectionType: channels.vectorPoint,
          selectAction: 'selectVectorPoints',
          eventName: 'selectVectorPoints'
        })
      ],
      [
        channels.vectorSegment,
        new BaseSelection({
          selectionType: channels.vectorSegment,
          selectAction: 'selectVectorSegments',
          eventName: 'selectVectorSegments'
        })
      ]
    ])
    return {
      get: (type: string) => selections.get(type),
      getChannelByAction: (action: string) => {
        if (action === 'selectElements') return channels.element
        if (action === 'selectVectorPoints') return channels.vectorPoint
        if (action === 'selectVectorSegments') return channels.vectorSegment
        return undefined
      }
    }
  }

  it('propagates options to selection events', () => {
    const apis = createElementSelectionAPIs(createSelectionDeps())
    const subscriber = vi.fn()
    const subscription = subscribeToUpdateTransaction(subscriber)

    subscriber.mockClear()
    apis.selectElements(['element-1'], { undoable: false })

    expect(subscriber).toHaveBeenCalledTimes(1)
    expect(subscriber).toHaveBeenCalledWith({
      type: EventTypes.UPDATE_TRANSACTION,
      eventName: 'selectElements',
      payload: expect.objectContaining({
        selectionType: channels.element,
        action: 'selectElements',
        eventName: 'selectElements',
        after: ['element-1']
      }),
      options: {
        undoable: false,
        shared: SharedDataChannelNames.SELECTION
      }
    })

    subscription.unsubscribe()
  })

  it('applies canonical selection before the transaction boundary closes', () => {
    const deps = createSelectionDeps()
    const apis = createElementSelectionAPIs(deps)

    apis.selectElements(['element-1'])

    expect([...(deps.get(channels.element)?.getSelectedIds() ?? [])]).toEqual([
      'element-1'
    ])
  })

  it('exposes canonical selection to commit validators and rolls it back on failure', () => {
    const deps = createSelectionDeps()
    const factory = new Factory()
    const apis = createElementSelectionAPIs(deps, factory)
    factory.registerTransactionValidator('selection-references', () => {
      const selectedIds = [
        ...(deps.get(channels.element)?.getSelectedIds() ?? [])
      ]
      return selectedIds.every((id) => id === 'element-1')
        ? undefined
        : {
            valid: false,
            code: 'dangling-selection',
            message: 'Selection references an unavailable element'
          }
    })

    expect(() => apis.selectElements(['missing-element'])).toThrow(
      TransactionValidationError
    )
    expect([...(deps.get(channels.element)?.getSelectedIds() ?? [])]).toEqual(
      []
    )
  })

  it('keeps selection rollback isolated between consumer-owned factories', () => {
    const firstDeps = createSelectionDeps()
    const secondDeps = createSelectionDeps()
    const firstFactory = new Factory()
    const secondFactory = new Factory()
    const firstApis = createElementSelectionAPIs(firstDeps, firstFactory)
    const secondApis = createElementSelectionAPIs(secondDeps, secondFactory)
    firstFactory.registerTransactionValidator('reject-first-selection', () => ({
      valid: false,
      code: 'invalid-selection',
      message: 'Reject first runtime selection'
    }))

    secondApis.selectElements(['element-1'])
    expect(() => firstApis.selectElements(['missing-element'])).toThrow(
      TransactionValidationError
    )

    expect([
      ...(firstDeps.get(channels.element)?.getSelectedIds() ?? [])
    ]).toEqual([])
    expect([
      ...(secondDeps.get(channels.element)?.getSelectedIds() ?? [])
    ]).toEqual(['element-1'])
  })

  it('undoes and redoes selection through the owning factory without preset wiring', () => {
    const deps = createSelectionDeps()
    const factory = new Factory()
    const apis = createElementSelectionAPIs(deps, factory)

    apis.selectElements(['element-1'])
    factory.undo()
    expect([...(deps.get(channels.element)?.getSelectedIds() ?? [])]).toEqual(
      []
    )

    factory.redo()
    expect([...(deps.get(channels.element)?.getSelectedIds() ?? [])]).toEqual([
      'element-1'
    ])
  })

  it('does not over-restore a no-op nested selection undo', () => {
    const deps = createSelectionDeps()
    const factory = new Factory()
    const apis = createElementSelectionAPIs(deps, factory)

    apis.selectElements(['element-1'])
    apis.selectElements([], { undoable: false, rollbackable: false })

    factory.startTransaction()
    factory.undo()
    expect([...(deps.get(channels.element)?.getSelectedIds() ?? [])]).toEqual(
      []
    )
    factory.endTransaction({ outcome: 'rollback' })

    expect([...(deps.get(channels.element)?.getSelectedIds() ?? [])]).toEqual(
      []
    )
  })

  it('supports rollback, undo, and redo for a custom selection event name', () => {
    const customChannel = 'custom'
    const customSelection = new BaseSelection({
      selectionType: customChannel,
      selectAction: 'selectCustom',
      eventName: 'customSelect'
    })
    const deps = {
      get: (type: string) =>
        type === customChannel ? customSelection : undefined,
      getChannelByAction: (action: string) =>
        action === 'selectCustom' ? customChannel : undefined
    }
    const factory = new Factory()
    const apis = createElementSelectionAPIs(deps, factory)

    apis.selectByChannel(customChannel, ['custom-1'])
    expect([...customSelection.getSelectedIds()]).toEqual(['custom-1'])

    factory.undo()
    expect([...customSelection.getSelectedIds()]).toEqual([])

    factory.redo()
    expect([...customSelection.getSelectedIds()]).toEqual(['custom-1'])

    factory.registerTransactionValidator('reject-custom-selection', () => ({
      valid: false,
      code: 'invalid-custom-selection',
      message: 'Reject custom selection'
    }))
    expect(() =>
      apis.selectByChannel(customChannel, ['missing-custom'])
    ).toThrow(TransactionValidationError)
    expect([...customSelection.getSelectedIds()]).toEqual(['custom-1'])
  })

  it('publishes vector-point selection events with options', () => {
    const apis = createElementSelectionAPIs(createSelectionDeps())
    const subscriber = vi.fn()
    const subscription = subscribeToUpdateTransaction(subscriber)

    subscriber.mockClear()
    apis.selectVectorPoints(['vector-1:point-1:anchor'], { undoable: false })

    expect(subscriber).toHaveBeenCalledTimes(1)
    expect(subscriber).toHaveBeenCalledWith({
      type: EventTypes.UPDATE_TRANSACTION,
      eventName: 'selectVectorPoints',
      payload: expect.objectContaining({
        selectionType: channels.vectorPoint,
        action: 'selectVectorPoints',
        eventName: 'selectVectorPoints',
        after: ['vector-1:point-1:anchor']
      }),
      options: {
        undoable: false,
        shared: SharedDataChannelNames.SELECTION
      }
    })

    subscription.unsubscribe()
  })

  it('publishes vector-segment selection events with options', () => {
    const apis = createElementSelectionAPIs(createSelectionDeps())
    const subscriber = vi.fn()
    const subscription = subscribeToUpdateTransaction(subscriber)

    subscriber.mockClear()
    apis.selectVectorSegments(['vector-1:segment-1'], { undoable: false })

    expect(subscriber).toHaveBeenCalledTimes(1)
    expect(subscriber).toHaveBeenCalledWith({
      type: EventTypes.UPDATE_TRANSACTION,
      eventName: 'selectVectorSegments',
      payload: expect.objectContaining({
        selectionType: channels.vectorSegment,
        action: 'selectVectorSegments',
        eventName: 'selectVectorSegments',
        after: ['vector-1:segment-1']
      }),
      options: {
        undoable: false,
        shared: SharedDataChannelNames.SELECTION
      }
    })

    subscription.unsubscribe()
  })

  it('does not publish a transaction when selection ids are unchanged', () => {
    const deps = createSelectionDeps()
    const apis = createElementSelectionAPIs(deps)
    const subscriber = vi.fn()
    const subscription = subscribeToUpdateTransaction(subscriber)

    deps.get(channels.vectorPoint)?.select(['vector-1:point-1:anchor'])
    subscriber.mockClear()

    apis.selectVectorPoints(['vector-1:point-1:anchor'])

    expect(subscriber).not.toHaveBeenCalled()

    subscription.unsubscribe()
  })

  it('throws when wrapper action channel is not registered', () => {
    const apis = createElementSelectionAPIs({
      get: () => undefined,
      getChannelByAction: () => undefined
    })

    expect(() => apis.selectElements(['element-1'])).toThrow(
      'Selection channel is not registered for action "selectElements"'
    )
  })
})
