import { describe, expect, it, vi } from 'vitest'
import { EventTypes, type AllEvent } from '@asyra/reactive-events'
import { SCENE_TREE_ACTIONS, SharedDataChannelNames } from '@asyra/utils'
import { createAsyraDesignPublicationProcessor } from '../../collaboration/operations'
import { createDocumentCollaborationFactory } from '../../collaboration/factory-adapter'
import * as aiDrawingPerformance from '../performance/ai-drawing-performance-profile'

describe('Asyra Design collaboration composition', () => {
  it('forwards only app-owned document channels', () => {
    let publicationSubscriber:
      | ((publication: {
          publicationId: string
          deliveries: { channel: string }[]
          batches: {
            batchId: string
            sliceId: string
            channel: string
            deliveries: { channel: string }[]
          }[]
          deliveryPlan: {
            mode: 'atomic'
            slices: { sliceId: string; orderedIds: string[] }[]
          }
        }) => void)
      | undefined
    const owner = {
      subscribeToSharedPublication: vi.fn((subscriber) => {
        publicationSubscriber = subscriber
        return () => undefined
      })
    }
    const filtered = createDocumentCollaborationFactory(owner as never)
    const received = vi.fn()
    const selectionDelivery = { channel: 'selection' }
    const sceneDelivery = { channel: 'sceneTree' }
    const propsDelivery = { channel: 'props' }
    const selectionBatch = {
      batchId: 'selection-batch',
      sliceId: 'selection-slice',
      channel: 'selection',
      deliveries: [selectionDelivery]
    }
    const sceneBatch = {
      batchId: 'scene-batch',
      sliceId: 'document-slice',
      channel: 'sceneTree',
      deliveries: [sceneDelivery]
    }
    const propsBatch = {
      batchId: 'props-batch',
      sliceId: 'document-slice',
      channel: 'props',
      deliveries: [propsDelivery]
    }

    filtered.subscribeToSharedPublication(received as never)
    publicationSubscriber?.({
      publicationId: 'selection-only',
      deliveries: [selectionDelivery],
      batches: [selectionBatch],
      deliveryPlan: {
        mode: 'atomic',
        slices: [
          { sliceId: 'selection-slice', orderedIds: ['selection-delivery'] }
        ]
      }
    })
    publicationSubscriber?.({
      publicationId: 'mixed-action',
      deliveries: [selectionDelivery, sceneDelivery, propsDelivery],
      batches: [selectionBatch, sceneBatch, propsBatch],
      deliveryPlan: {
        mode: 'atomic',
        slices: [
          { sliceId: 'selection-slice', orderedIds: ['selection-delivery'] },
          {
            sliceId: 'document-slice',
            orderedIds: ['scene-delivery', 'props-delivery']
          }
        ]
      }
    })

    expect(received).toHaveBeenCalledTimes(1)
    expect(received).toHaveBeenCalledWith({
      publicationId: 'mixed-action',
      deliveries: [sceneDelivery, propsDelivery],
      batches: [sceneBatch, propsBatch],
      deliveryPlan: {
        mode: 'atomic',
        slices: [
          {
            sliceId: 'document-slice',
            orderedIds: ['scene-delivery', 'props-delivery']
          }
        ]
      }
    })
    expect('runRemoteTransaction' in filtered).toBe(false)
    expect('isRemoteAsyncHandlerError' in filtered).toBe(false)
  })

  it('records profiling evidence from the existing document publication clone without affecting transport', () => {
    let publicationSubscriber:
      | ((publication: {
          publicationId: string
          deliveries: { channel: string }[]
        }) => void)
      | undefined
    const owner = {
      subscribeToSharedPublication: vi.fn((subscriber) => {
        publicationSubscriber = subscriber
        return () => undefined
      })
    }
    const profile = {} as NonNullable<Window['__AsyraAiDrawingPerformance__']>
    window.__AsyraAiDrawingPerformance__ = profile
    const recordPublication = vi
      .spyOn(aiDrawingPerformance, 'recordAiDrawingPerformancePublication')
      .mockImplementation(() => {
        throw new Error('diagnostic failure')
      })
    const filtered = createDocumentCollaborationFactory(owner as never)
    const received = vi.fn()

    filtered.subscribeToSharedPublication(received as never)
    publicationSubscriber?.({
      publicationId: 'selection-only',
      deliveries: [{ channel: 'selection' }]
    })
    publicationSubscriber?.({
      publicationId: 'document-action',
      deliveries: [
        { channel: 'selection' },
        { channel: 'sceneTree' },
        { channel: 'props' }
      ]
    })

    expect(owner.subscribeToSharedPublication).toHaveBeenCalledOnce()
    expect(recordPublication).toHaveBeenCalledOnce()
    expect(recordPublication).toHaveBeenCalledWith(profile, {
      deliveryCount: 2,
      publicationId: 'document-action'
    })
    expect(received).toHaveBeenCalledOnce()
    expect(received).toHaveBeenCalledWith({
      publicationId: 'document-action',
      deliveries: [{ channel: 'sceneTree' }, { channel: 'props' }]
    })

    delete window.__AsyraAiDrawingPerformance__
  })

  it('applies accepted Group hierarchy deliveries once without remote selection takeover', () => {
    let publicationSubscriber:
      | ((publication: {
          publicationId: string
          transactionId: number
          origin: 'action'
          deliveries: {
            deliveryId: string
            transactionId: number
            origin: 'action'
            kind: 'forward'
            channel: string
            eventName: string
            payload: unknown
            sharedDelivery: 'transaction-end'
          }[]
        }) => void)
      | undefined
    const owner = {
      subscribeToSharedPublication: vi.fn((subscriber) => {
        publicationSubscriber = subscriber
        return () => undefined
      })
    }
    const filtered = createDocumentCollaborationFactory(owner as never)
    const runRemoteTransaction = vi.fn(<T>(mutate: () => T): T => mutate())
    const process = vi.fn((_event: AllEvent) => true)
    const processPublication = createAsyraDesignPublicationProcessor(
      runRemoteTransaction,
      process
    )
    filtered.subscribeToSharedPublication(processPublication)

    publicationSubscriber?.({
      publicationId: 'group-command',
      transactionId: 1,
      origin: 'action',
      deliveries: [
        {
          deliveryId: 'selection-local-only',
          transactionId: 1,
          origin: 'action',
          kind: 'forward',
          channel: 'selection',
          eventName: 'selection.change',
          payload: { selectedIds: ['group-a'] },
          sharedDelivery: 'transaction-end'
        },
        {
          deliveryId: 'group-created',
          transactionId: 1,
          origin: 'action',
          kind: 'forward',
          channel: SharedDataChannelNames.SCENE_TREE,
          eventName: EventTypes.ADD_ELEMENT,
          payload: {
            action: SCENE_TREE_ACTIONS.ADD_ELEMENT,
            eventName: EventTypes.ADD_ELEMENT,
            data: {
              id: 'group-a',
              type: 'group',
              parentId: 'workspace-a',
              children: []
            },
            parentId: 'workspace-a',
            index: 0
          },
          sharedDelivery: 'transaction-end'
        },
        {
          deliveryId: 'children-moved',
          transactionId: 1,
          origin: 'action',
          kind: 'forward',
          channel: SharedDataChannelNames.SCENE_TREE,
          eventName: EventTypes.MOVE_ELEMENTS,
          payload: {
            action: SCENE_TREE_ACTIONS.MOVE_ELEMENTS,
            eventName: EventTypes.MOVE_ELEMENTS,
            moves: [
              {
                elementId: 'rect-a',
                before: { parentId: 'workspace-a', index: 1 },
                after: { parentId: 'group-a', index: 0 }
              }
            ]
          },
          sharedDelivery: 'transaction-end'
        }
      ]
    })

    expect(runRemoteTransaction).toHaveBeenCalledOnce()
    expect(process).toHaveBeenCalledTimes(2)
    expect(process.mock.calls.map(([event]) => event.type)).toEqual([
      EventTypes.ADD_ELEMENT,
      EventTypes.MOVE_ELEMENTS
    ])
    expect(
      process.mock.calls.some(
        ([event]) =>
          (event as unknown as { type: string }).type === 'selection.change'
      )
    ).toBe(false)
  })
})
