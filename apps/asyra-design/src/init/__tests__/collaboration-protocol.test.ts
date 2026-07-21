import { describe, expect, it } from 'vitest'
import {
  CollaborationMessageTypes,
  parseCollaborationClientMessage,
  parseCollaborationServerMessage,
  type CollaborationRequestMessage,
  type CollaborationServerMessage
} from '../../collaboration/protocol'

describe('collaboration wire protocol', () => {
  it('parses every state-vector request as its named discriminated variant', () => {
    const request: CollaborationRequestMessage = {
      type: CollaborationMessageTypes.REQUEST_SYNC,
      requestId: 'request-1',
      stateVector: ''
    }

    expect(parseCollaborationClientMessage(request)).toEqual(request)
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
})
