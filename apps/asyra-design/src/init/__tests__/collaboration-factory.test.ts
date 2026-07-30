import { describe, expect, it, vi } from 'vitest'
import { EventTypes } from '@asyra/reactive-events'
import { SharedDataChannelNames } from '@asyra/utils'
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
          deliverySequence: {
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
      deliverySequence: {
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
      deliverySequence: {
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
      deliverySequence: {
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

  it('records profiling evidence from retained Factory batches without affecting transport', () => {
    let publicationSubscriber:
      | ((publication: {
          publicationId: string
          deliveries: { channel: string; eventName?: string }[]
          batches: {
            batchId: string
            sliceId: string
            channel: string
            deliveries: { channel: string; eventName?: string }[]
          }[]
          deliverySequence: {
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
    const profile = {} as NonNullable<Window['__AsyraAiDrawingPerformance__']>
    window.__AsyraAiDrawingPerformance__ = profile
    const recordPublication = vi
      .spyOn(aiDrawingPerformance, 'recordAiDrawingPerformancePublication')
      .mockImplementation(() => {
        throw new Error('diagnostic failure')
      })
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
      deliverySequence: {
        mode: 'atomic',
        slices: [
          { sliceId: 'selection-slice', orderedIds: ['selection-delivery'] }
        ]
      }
    })
    publicationSubscriber?.({
      publicationId: 'document-action',
      deliveries: [selectionDelivery, sceneDelivery, propsDelivery],
      batches: [selectionBatch, sceneBatch, propsBatch],
      deliverySequence: {
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

    expect(owner.subscribeToSharedPublication).toHaveBeenCalledOnce()
    expect(recordPublication).toHaveBeenCalledOnce()
    expect(recordPublication).toHaveBeenCalledWith(profile, {
      deliveryCount: 2,
      publicationId: 'document-action'
    })
    expect(received).toHaveBeenCalledOnce()
    expect(received).toHaveBeenCalledWith({
      publicationId: 'document-action',
      deliveries: [sceneDelivery, propsDelivery],
      batches: [sceneBatch, propsBatch],
      deliverySequence: {
        mode: 'atomic',
        slices: [
          {
            sliceId: 'document-slice',
            orderedIds: ['scene-delivery', 'props-delivery']
          }
        ]
      }
    })

    delete window.__AsyraAiDrawingPerformance__
  })

  it('rejects local-only computed evidence before the adapter publishes a document batch', () => {
    let publicationSubscriber:
      | ((publication: {
          publicationId: string
          deliveries: { channel: string; eventName: string }[]
          batches: {
            batchId: string
            sliceId: string
            channel: string
            deliveries: { channel: string; eventName: string }[]
          }[]
          deliverySequence: {
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

    filtered.subscribeToSharedPublication(received as never)

    for (const eventName of [
      EventTypes.UPDATE_COMPUTED_DATA,
      EventTypes.UPDATE_COMPUTED_DATA_PATCH
    ]) {
      const delivery = {
        channel: SharedDataChannelNames.SCENE_TREE,
        eventName
      }
      expect(() =>
        publicationSubscriber?.({
          publicationId: `computed-${eventName}`,
          deliveries: [delivery],
          batches: [
            {
              batchId: `computed-batch-${eventName}`,
              sliceId: `computed-slice-${eventName}`,
              channel: SharedDataChannelNames.SCENE_TREE,
              deliveries: [delivery]
            }
          ],
          deliverySequence: {
            mode: 'atomic',
            slices: [
              {
                sliceId: `computed-slice-${eventName}`,
                orderedIds: [`computed-delivery-${eventName}`]
              }
            ]
          }
        })
      ).toThrow(/local-only computed projection/i)
    }

    expect(received).not.toHaveBeenCalled()
  })
})
