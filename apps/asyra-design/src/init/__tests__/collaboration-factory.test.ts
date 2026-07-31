import type { SharedPublication } from '@asyra/factory'
import { describe, expect, it, vi } from 'vitest'
import { EventTypes } from '@asyra/reactive-events'
import { SharedDataChannelNames } from '@asyra/utils'
import { createDocumentCollaborationFactory } from '../../collaboration/factory-adapter'
import * as aiDrawingPerformance from '../performance/ai-drawing-performance-profile'

const createPublication = (
  publicationId: string,
  slices: SharedPublication['slices']
): SharedPublication => ({
  publicationId,
  artifactId: `artifact-${publicationId}`,
  transactionId: 1,
  origin: 'action',
  mode: 'atomic',
  slices
})

const createDelivery = (
  deliveryId: string,
  eventName: string,
  orderedIds: readonly string[]
) => ({
  deliveryId,
  eventName,
  orderedIds,
  payload: { id: orderedIds[0] }
})

describe('Asyra Design collaboration composition', () => {
  it('forwards an already document-only minimal publication by identity', () => {
    let publicationSubscriber: ((publication: unknown) => void) | undefined
    const owner = {
      subscribeToSharedPublication: vi.fn((subscriber) => {
        publicationSubscriber = subscriber
        return () => undefined
      })
    }
    const filtered = createDocumentCollaborationFactory(owner as never)
    const received = vi.fn()
    const documentPublication = Object.freeze({
      publicationId: 'document-only',
      artifactId: 'artifact-document-only',
      transactionId: 1,
      origin: 'action' as const,
      mode: 'atomic' as const,
      slices: Object.freeze([
        Object.freeze({
          sliceId: 'slice-document-only',
          orderedIds: Object.freeze(['element-a']),
          batches: Object.freeze([
            Object.freeze({
              batchId: 'batch-document-only',
              channel: SharedDataChannelNames.SCENE_TREE,
              deliveries: Object.freeze([
                Object.freeze({
                  deliveryId: 'delivery-document-only',
                  eventName: EventTypes.UPDATE_ELEMENT_DATA,
                  orderedIds: Object.freeze(['element-a']),
                  payload: Object.freeze({ id: 'element-a' })
                })
              ])
            })
          ])
        })
      ])
    })

    filtered.subscribeToSharedPublication(received as never)
    publicationSubscriber?.(documentPublication)

    expect(received).toHaveBeenCalledOnce()
    expect(received).toHaveBeenCalledWith(documentPublication)
  })

  it('forwards only app-owned document channels', () => {
    let publicationSubscriber:
      | ((publication: SharedPublication) => void)
      | undefined
    const owner = {
      subscribeToSharedPublication: vi.fn((subscriber) => {
        publicationSubscriber = subscriber
        return () => undefined
      })
    }
    const filtered = createDocumentCollaborationFactory(owner as never)
    const received = vi.fn()
    const selectionDelivery = createDelivery(
      'selection-delivery',
      'updateSelection',
      ['selection-a']
    )
    const sceneDelivery = createDelivery(
      'scene-delivery',
      EventTypes.UPDATE_ELEMENT_DATA,
      ['element-a']
    )
    const propsDelivery = createDelivery(
      'props-delivery',
      EventTypes.UPDATE_PROPERTY,
      ['element-a']
    )

    filtered.subscribeToSharedPublication(received as never)
    publicationSubscriber?.(
      createPublication('selection-only', [
        {
          sliceId: 'selection-slice',
          orderedIds: ['selection-delivery'],
          batches: [
            {
              batchId: 'selection-batch',
              channel: 'selection',
              deliveries: [selectionDelivery]
            }
          ]
        }
      ])
    )
    publicationSubscriber?.(
      createPublication('mixed-action', [
        {
          sliceId: 'selection-slice',
          orderedIds: ['selection-delivery'],
          batches: [
            {
              batchId: 'selection-batch',
              channel: 'selection',
              deliveries: [selectionDelivery]
            }
          ]
        },
        {
          sliceId: 'document-slice',
          orderedIds: ['scene-delivery', 'props-delivery'],
          batches: [
            {
              batchId: 'scene-batch',
              channel: SharedDataChannelNames.SCENE_TREE,
              deliveries: [sceneDelivery]
            },
            {
              batchId: 'props-batch',
              channel: SharedDataChannelNames.PROPS,
              deliveries: [propsDelivery]
            }
          ]
        }
      ])
    )

    expect(received).toHaveBeenCalledTimes(1)
    expect(received).toHaveBeenCalledWith(
      createPublication('mixed-action', [
        {
          sliceId: 'document-slice',
          orderedIds: ['scene-delivery', 'props-delivery'],
          batches: [
            {
              batchId: 'scene-batch',
              channel: SharedDataChannelNames.SCENE_TREE,
              deliveries: [sceneDelivery]
            },
            {
              batchId: 'props-batch',
              channel: SharedDataChannelNames.PROPS,
              deliveries: [propsDelivery]
            }
          ]
        }
      ])
    )
    expect('runRemoteTransaction' in filtered).toBe(false)
    expect('isRemoteAsyncHandlerError' in filtered).toBe(false)
  })

  it('records profiling evidence from retained Factory batches without affecting transport', () => {
    let publicationSubscriber:
      | ((publication: SharedPublication) => void)
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
    const selectionDelivery = createDelivery(
      'selection-delivery',
      'updateSelection',
      ['selection-a']
    )
    const sceneDelivery = createDelivery(
      'scene-delivery',
      EventTypes.UPDATE_ELEMENT_DATA,
      ['element-a']
    )
    const propsDelivery = createDelivery(
      'props-delivery',
      EventTypes.UPDATE_PROPERTY,
      ['element-a']
    )

    filtered.subscribeToSharedPublication(received as never)
    publicationSubscriber?.(
      createPublication('selection-only', [
        {
          sliceId: 'selection-slice',
          orderedIds: ['selection-delivery'],
          batches: [
            {
              batchId: 'selection-batch',
              channel: 'selection',
              deliveries: [selectionDelivery]
            }
          ]
        }
      ])
    )
    const mixedPublication = createPublication('document-action', [
      {
        sliceId: 'selection-slice',
        orderedIds: ['selection-delivery'],
        batches: [
          {
            batchId: 'selection-batch',
            channel: 'selection',
            deliveries: [selectionDelivery]
          }
        ]
      },
      {
        sliceId: 'document-slice',
        orderedIds: ['scene-delivery', 'props-delivery'],
        batches: [
          {
            batchId: 'scene-batch',
            channel: SharedDataChannelNames.SCENE_TREE,
            deliveries: [sceneDelivery]
          },
          {
            batchId: 'props-batch',
            channel: SharedDataChannelNames.PROPS,
            deliveries: [propsDelivery]
          }
        ]
      }
    ])
    publicationSubscriber?.(mixedPublication)

    expect(owner.subscribeToSharedPublication).toHaveBeenCalledOnce()
    expect(recordPublication).toHaveBeenCalledOnce()
    expect(recordPublication).toHaveBeenCalledWith(profile, {
      deliveryCount: 2,
      publicationId: 'document-action'
    })
    const propsSlice = mixedPublication.slices[1]
    if (!propsSlice) throw new Error('Expected retained Props slice')
    expect(received).toHaveBeenCalledOnce()
    expect(received).toHaveBeenCalledWith(
      createPublication('document-action', [propsSlice])
    )

    delete window.__AsyraAiDrawingPerformance__
  })

  it('rejects local-only computed evidence before the adapter publishes a document batch', () => {
    let publicationSubscriber:
      | ((publication: SharedPublication) => void)
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
      const computedDelivery = createDelivery(
        `computed-delivery-${eventName}`,
        eventName,
        ['element-a']
      )
      expect(() =>
        publicationSubscriber?.(
          createPublication(`computed-${eventName}`, [
            {
              sliceId: `computed-slice-${eventName}`,
              orderedIds: [`computed-delivery-${eventName}`],
              batches: [
                {
                  batchId: `computed-batch-${eventName}`,
                  channel: SharedDataChannelNames.SCENE_TREE,
                  deliveries: [computedDelivery]
                }
              ]
            }
          ])
        )
      ).toThrow(/local-only computed projection/i)
    }

    expect(received).not.toHaveBeenCalled()
  })
})
