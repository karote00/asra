import type { SharedPublication } from '@asyra/factory'
import { describe, expect, it } from 'vitest'
import {
  CollaborationMessageTypes,
  parseCollaborationClientMessage,
  parseCollaborationServerMessage,
  type CollaborationRequestMessage,
  type CollaborationServerMessage
} from '../../collaboration/protocol'

const publication: SharedPublication = {
  publicationId: 'publication-a',
  artifactId: 'artifact-a',
  transactionId: 1,
  origin: 'action',
  mode: 'atomic',
  slices: [
    {
      sliceId: 'slice-a',
      orderedIds: ['delivery-a'],
      batches: [
        {
          batchId: 'batch-a',
          channel: 'sceneTree',
          deliveries: [
            {
              deliveryId: 'delivery-a',
              eventName: 'updateComputedData',
              orderedIds: ['element-a'],
              payload: { value: 1 }
            }
          ]
        }
      ]
    }
  ]
}

describe('collaboration wire protocol', () => {
  it('parses a detached publication request as its named variant', () => {
    const request: CollaborationRequestMessage = {
      type: CollaborationMessageTypes.SEND_PUBLICATION,
      requestId: 'request-1',
      publication
    }

    expect(parseCollaborationClientMessage(request)).toEqual(request)
  })

  it('parses a live inbound publication with authenticated sender context', () => {
    const message: CollaborationServerMessage = {
      type: CollaborationMessageTypes.PUBLICATION,
      publication,
      fromActorId: 'actor-a'
    }

    expect(parseCollaborationServerMessage(message)).toEqual(message)
  })

  it('rejects blank optional transport identifiers instead of omitting them', () => {
    expect(
      parseCollaborationServerMessage({
        type: CollaborationMessageTypes.PUBLICATION,
        publication,
        fromActorId: ''
      })
    ).toBeUndefined()
    expect(
      parseCollaborationServerMessage({
        type: CollaborationMessageTypes.FAILURE,
        code: 'transport-failed',
        message: 'failed',
        publicationId: '   '
      })
    ).toBeUndefined()
  })

  it('rejects malformed publication structure without app semantic filtering', () => {
    expect(
      parseCollaborationClientMessage({
        type: CollaborationMessageTypes.SEND_PUBLICATION,
        requestId: 'request-1',
        publication: { ...publication, slices: 'not-an-array' }
      })
    ).toBeUndefined()
    expect(
      parseCollaborationClientMessage({
        type: CollaborationMessageTypes.SEND_PUBLICATION,
        requestId: 'request-1',
        publication: {
          ...publication,
          slices: [
            {
              ...publication.slices[0],
              batches: [
                {
                  ...publication.slices[0]?.batches[0],
                  channel: 'app-specific-channel',
                  deliveries: [
                    {
                      ...publication.slices[0]?.batches[0]?.deliveries[0],
                      eventName: 'app-specific-event'
                    }
                  ]
                }
              ]
            }
          ]
        }
      })
    ).toBeDefined()

    const incompletePublications = [
      { publicationId: 'publication-a', slices: publication.slices },
      { ...publication, origin: 'unsupported-origin' },
      {
        ...publication,
        slices: [
          {
            ...publication.slices[0],
            batches: [
              {
                ...publication.slices[0]?.batches[0],
                deliveries: [
                  {
                    eventName: 'updateComputedData',
                    orderedIds: ['element-a'],
                    payload: { value: 1 }
                  }
                ]
              }
            ]
          }
        ]
      },
      {
        ...publication,
        deliveries: publication.slices[0]?.batches[0]?.deliveries
      }
    ]

    incompletePublications.forEach((incompletePublication) => {
      expect(
        parseCollaborationClientMessage({
          type: CollaborationMessageTypes.SEND_PUBLICATION,
          requestId: 'request-1',
          publication: incompletePublication
        })
      ).toBeUndefined()
    })
  })

  it('rejects every removed rich or top-level publication alias', () => {
    const aliases = [
      'deliveries',
      'batches',
      'deliverySequence',
      'records',
      'changes',
      'record',
      'inverseEvents',
      'sharedDelivery',
      'kind'
    ]

    aliases.forEach((alias) => {
      expect(
        parseCollaborationClientMessage({
          type: CollaborationMessageTypes.SEND_PUBLICATION,
          requestId: `request-${alias}`,
          publication: { ...publication, [alias]: [] }
        })
      ).toBeUndefined()
    })
  })

  it('parses failed responses without flattening their failure payload', () => {
    const response: CollaborationServerMessage = {
      type: CollaborationMessageTypes.RESPONSE,
      requestId: 'request-1',
      ok: false,
      error: { code: 'transport-failed', message: 'failed' }
    }

    expect(parseCollaborationServerMessage(response)).toEqual(response)
  })

  it('rejects blank identity fields at the wire boundary', () => {
    expect(
      parseCollaborationClientMessage({
        type: CollaborationMessageTypes.HELLO,
        identity: { documentId: ' ', roomId: 'room', actorId: 'actor' }
      })
    ).toBeUndefined()
  })

  it('does not expose state-vector protocol variants', () => {
    expect('REQUEST_SYNC' in CollaborationMessageTypes).toBe(false)
    expect('EXCHANGE_STATE_VECTOR' in CollaborationMessageTypes).toBe(false)
    expect('SEND_SYNC_UPDATE' in CollaborationMessageTypes).toBe(false)
  })
})
