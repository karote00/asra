import * as Y from 'yjs'
import { describe, expect, it, vi } from 'vitest'
import type { SharedOperationEnvelope } from '../operation-envelope'
import {
  appendOperationToYDoc,
  applyInboundYjsUpdate,
  inboundYjsOrigin,
  InboundYjsDecodeFailure,
  readOperationLog,
  YJS_OPERATION_LOG_NAME
} from '../yjs-document'

const envelope: SharedOperationEnvelope = {
  operationId: 'actor-a:session-a:1:forward',
  transactionId: 'actor-a:session-a:1',
  documentId: 'document-a',
  actorId: 'actor-a',
  protocolVersion: 1,
  schemaVersion: 1,
  origin: 'action',
  channel: 'scene',
  eventName: 'set-value',
  payload: { value: 1 }
}

describe('inbound Yjs update decode', () => {
  it.each(['provider', 'persistence'] as const)(
    'applies a %s update under a non-local origin and extracts only new operations',
    (source) => {
      const outboundDocument = new Y.Doc()
      const binary = appendOperationToYDoc(outboundDocument, envelope)
      const inboundDocument = new Y.Doc()
      const transactionOrigins: unknown[] = []
      inboundDocument.on('afterTransaction', (transaction) => {
        transactionOrigins.push(transaction.origin)
      })
      const canonicalMutation = vi.fn()

      const decoded = applyInboundYjsUpdate(
        inboundDocument,
        binary.update,
        source
      )

      expect(decoded).toEqual({ source, operations: [envelope] })
      expect(Object.isFrozen(decoded)).toBe(true)
      expect(Object.isFrozen(decoded.operations)).toBe(true)
      expect(transactionOrigins).toContain(inboundYjsOrigin(source))
      expect(readOperationLog(inboundDocument)).toEqual([envelope])
      expect(canonicalMutation).not.toHaveBeenCalled()
    }
  )

  it('returns no operation for duplicate and empty state-vector diffs', () => {
    const source = new Y.Doc()
    const binary = appendOperationToYDoc(source, envelope)
    const target = new Y.Doc()

    expect(
      applyInboundYjsUpdate(target, binary.update, 'provider').operations
    ).toEqual([envelope])
    expect(
      applyInboundYjsUpdate(target, binary.update, 'provider').operations
    ).toEqual([])
    const emptyDiff = Y.encodeStateAsUpdate(source, Y.encodeStateVector(source))
    expect(
      applyInboundYjsUpdate(target, emptyDiff, 'provider').operations
    ).toEqual([])
  })

  it('rejects malformed binary without changing the operation log', () => {
    const target = new Y.Doc()

    expect(() =>
      applyInboundYjsUpdate(target, new Uint8Array([255, 255, 255]), 'provider')
    ).toThrowError(
      expect.objectContaining<Partial<InboundYjsDecodeFailure>>({
        code: 'malformed-binary',
        source: 'provider'
      })
    )
    expect(readOperationLog(target)).toEqual([])
  })

  it('terminates a binary update that changes a non-operation Yjs root', () => {
    const source = new Y.Doc()
    source.getMap('intruder').set('canonical-looking-value', 1)
    const update = Y.encodeStateAsUpdate(source)
    const target = new Y.Doc()

    expect(() =>
      applyInboundYjsUpdate(target, update, 'provider')
    ).toThrowError(
      expect.objectContaining<Partial<InboundYjsDecodeFailure>>({
        code: 'non-operation-content'
      })
    )
    expect(target.share.has('intruder')).toBe(false)
    expect(readOperationLog(target)).toEqual([])
  })

  it('terminates an unparseable operation entry before downstream validation', () => {
    const source = new Y.Doc()
    source.getArray<string>(YJS_OPERATION_LOG_NAME).push(['not-json'])
    const update = Y.encodeStateAsUpdate(source)
    const target = new Y.Doc()

    expect(() =>
      applyInboundYjsUpdate(target, update, 'persistence')
    ).toThrowError(
      expect.objectContaining<Partial<InboundYjsDecodeFailure>>({
        code: 'malformed-operation-entry',
        source: 'persistence'
      })
    )
    expect(readOperationLog(target)).toEqual([])
  })

  it('rejects an operation-log deletion without changing the owned document', () => {
    const source = new Y.Doc()
    appendOperationToYDoc(source, envelope)
    const target = new Y.Doc()
    Y.applyUpdate(target, Y.encodeStateAsUpdate(source))
    const targetState = Y.encodeStateVector(target)
    source.getArray<string>(YJS_OPERATION_LOG_NAME).delete(0, 1)
    const deletion = Y.encodeStateAsUpdate(source, targetState)

    expect(() =>
      applyInboundYjsUpdate(target, deletion, 'provider')
    ).toThrowError(
      expect.objectContaining<Partial<InboundYjsDecodeFailure>>({
        code: 'non-append-update'
      })
    )
    expect(readOperationLog(target)).toEqual([envelope])
  })
})
