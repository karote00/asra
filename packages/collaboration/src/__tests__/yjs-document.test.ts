import * as Y from 'yjs'
import { describe, expect, it, vi } from 'vitest'
import type { SharedOperationEnvelope } from '../operations/envelope'
import {
  appendOperationToYDoc,
  LOCAL_YJS_OPERATION_ORIGIN,
  readOperationLog,
  YjsAppendFailure
} from '../yjs-document'

const envelope = (
  overrides: Partial<SharedOperationEnvelope> = {}
): SharedOperationEnvelope => ({
  operationId: 'actor-a:session-a:1:0:forward',
  transactionId: 'actor-a:session-a:1',
  documentId: 'document-a',
  actorId: 'actor-a',
  protocolVersion: 1,
  schemaVersion: 1,
  origin: 'action',
  channel: 'scene',
  eventName: 'move-node',
  payload: { id: 'node-a', x: 10 },
  ...overrides
})

describe('Yjs semantic operation document', () => {
  it('appends through a local-origin transaction and returns an independent binary diff', () => {
    const source = new Y.Doc()
    const updateObserver = vi.fn()
    source.on('update', updateObserver)

    const result = appendOperationToYDoc(source, envelope())

    expect(result.operationId).toBe('actor-a:session-a:1:0:forward')
    expect(result.update).toBeInstanceOf(Uint8Array)
    expect(result.update.byteLength).toBeGreaterThan(0)
    expect(Object.isFrozen(result)).toBe(true)
    expect(updateObserver).toHaveBeenCalledTimes(1)
    expect(updateObserver.mock.calls[0]?.[1]).toBe(LOCAL_YJS_OPERATION_ORIGIN)
    expect(readOperationLog(source)).toEqual([envelope()])

    const remote = new Y.Doc()
    Y.applyUpdate(remote, result.update)
    expect(readOperationLog(remote)).toEqual([envelope()])
  })

  it('produces one missing-update diff per appended operation', () => {
    const source = new Y.Doc()
    const remote = new Y.Doc()
    const first = appendOperationToYDoc(source, envelope())
    Y.applyUpdate(remote, first.update)
    const secondEnvelope = envelope({
      operationId: 'actor-a:session-a:2:0:forward',
      transactionId: 'actor-a:session-a:2',
      payload: { id: 'node-b', x: 20 }
    })

    const second = appendOperationToYDoc(source, secondEnvelope)
    Y.applyUpdate(remote, second.update)

    expect(readOperationLog(source)).toEqual([envelope(), secondEnvelope])
    expect(readOperationLog(remote)).toEqual([envelope(), secondEnvelope])
  })

  it('retains the operation in a provider-less Y.Doc without network behavior', () => {
    const offlineDocument = new Y.Doc()
    const providerSend = vi.fn()

    appendOperationToYDoc(offlineDocument, envelope())

    expect(readOperationLog(offlineDocument)).toEqual([envelope()])
    expect(providerSend).not.toHaveBeenCalled()
  })

  it('rejects non-transport-safe payloads without mutating the Y.Doc', () => {
    const document = new Y.Doc()
    const invalidEnvelope = envelope({
      payload: { id: 'node-a', invalid: () => undefined }
    })

    expect(() => appendOperationToYDoc(document, invalidEnvelope)).toThrowError(
      expect.objectContaining<Partial<YjsAppendFailure>>({
        code: 'unsupported-envelope-value',
        operationId: invalidEnvelope.operationId
      })
    )
    expect(readOperationLog(document)).toEqual([])
  })
})
