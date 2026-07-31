import { describe, expect, it, vi } from 'vitest'
import type { SharedPublication, SharedPublicationBatch } from '@asyra/factory'
import { EventTypes } from '@asyra/reactive-events'
import { SCENE_TREE_ACTIONS, SharedDataChannelNames } from '@asyra/utils'
import { createAsyraDesignPublicationProcessor } from '../../collaboration/operations'
import { createDocumentCollaborationFactory } from '../../collaboration/factory-adapter'

const batch = (
  channel: string,
  deliveryId: string,
  eventName: string,
  payload: unknown
): SharedPublicationBatch => ({
  batchId: `batch-${deliveryId}`,
  channel,
  deliveries: [{ deliveryId, eventName, orderedIds: [deliveryId], payload }]
})

const publication = (
  publicationId: string,
  batches: readonly SharedPublicationBatch[]
): SharedPublication => ({
  publicationId,
  artifactId: `artifact-${publicationId}`,
  transactionId: 1,
  origin: 'action',
  mode: 'atomic',
  slices: [
    {
      sliceId: `slice-${publicationId}`,
      orderedIds: batches.flatMap(({ deliveries }) =>
        deliveries.map(({ deliveryId }) => deliveryId)
      ),
      batches
    }
  ]
})

describe('Asyra Design collaboration composition', () => {
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

    filtered.subscribeToSharedPublication(received as never)
    publicationSubscriber?.(
      publication('selection-only', [
        batch('selection', 'selection-only', 'selection.change', {})
      ])
    )
    const mixed = publication('mixed-action', [
      batch('selection', 'selection-local', 'selection.change', {}),
      batch('sceneTree', 'scene-document', 'scene.change', {}),
      batch('props', 'props-document', 'props.change', {})
    ])
    publicationSubscriber?.(mixed)

    expect(received).toHaveBeenCalledTimes(1)
    expect(received).toHaveBeenCalledWith({
      ...mixed,
      slices: [
        {
          ...mixed.slices[0],
          orderedIds: ['scene-document', 'props-document'],
          batches: mixed.slices[0]?.batches.slice(1)
        }
      ]
    })
    expect('runRemoteTransaction' in filtered).toBe(false)
    expect('isRemoteAsyncHandlerError' in filtered).toBe(false)
  })

  it('applies accepted Group hierarchy deliveries once without remote selection takeover', () => {
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
    const runRemoteTransaction = vi.fn(<T>(mutate: () => T): T => mutate())
    const process = vi.fn(() => true)
    const processPublication = createAsyraDesignPublicationProcessor(
      runRemoteTransaction,
      process
    )
    filtered.subscribeToSharedPublication(processPublication)

    publicationSubscriber?.(
      publication('group-command', [
        batch('selection', 'selection-local-only', 'selection.change', {
          selectedIds: ['group-a']
        }),
        batch(
          SharedDataChannelNames.SCENE_TREE,
          'group-created',
          EventTypes.ADD_ELEMENT,
          {
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
          }
        ),
        batch(
          SharedDataChannelNames.SCENE_TREE,
          'children-moved',
          EventTypes.MOVE_ELEMENTS,
          {
            action: SCENE_TREE_ACTIONS.MOVE_ELEMENTS,
            eventName: EventTypes.MOVE_ELEMENTS,
            moves: [
              {
                elementId: 'rect-a',
                before: { parentId: 'workspace-a', index: 1 },
                after: { parentId: 'group-a', index: 0 }
              }
            ]
          }
        )
      ])
    )

    expect(runRemoteTransaction).toHaveBeenCalledOnce()
    expect(process).toHaveBeenCalledTimes(2)
    expect(process.mock.calls.map(([event]) => event.type)).toEqual([
      EventTypes.ADD_ELEMENT,
      EventTypes.MOVE_ELEMENTS
    ])
    expect(
      process.mock.calls.some(([event]) => event.type === 'selection.change')
    ).toBe(false)
  })
})
