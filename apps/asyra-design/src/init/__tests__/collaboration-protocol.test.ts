import type { SharedPublication } from '@asyra/factory'
import { Buffer } from 'node:buffer'
import { describe, expect, it, vi } from 'vitest'
import {
  createCompactBinaryEncodePlan,
  decodeCompactBinary,
  encodeCompactBinary,
  encodeCompactBinaryPlan
} from '../../collaboration/compact-binary'
import {
  CollaborationMessageTypes,
  PUBLICATION_FRAME_VERSION_OFFSET,
  decodeCollaborationMessage,
  decodePublicationMessageFrames,
  encodeCollaborationMessage,
  encodePublicationMessageFrames,
  inspectPublicationFrameHeader,
  isJsonTransportValue,
  parseCollaborationClientMessage,
  parseCollaborationServerMessage,
  type CollaborationRequestMessage,
  type CollaborationServerMessage
} from '../../collaboration/protocol'
import { decodeProfiledWebSocketFrame } from '../../collaboration/websocket-profile-frame'

interface PublicationFixtureOptions {
  readonly channel?: string
  readonly eventName?: string
  readonly payload?: object
  readonly suffix?: string
  readonly transactionId?: number
}

const createPublication = ({
  channel = 'sceneTree',
  eventName = 'updateComputedData',
  payload = { value: 1 },
  suffix = 'a',
  transactionId = 1
}: PublicationFixtureOptions = {}): SharedPublication => {
  const artifactId = `${transactionId}:artifact`
  const batchId = `${transactionId}:batch:${suffix}`
  const deliveryId = `${transactionId}:delivery:${suffix}`
  const recordId = `${transactionId}:record:${suffix}`
  const sliceId = `${transactionId}:slice:${suffix}`
  const record = {
    recordId,
    deliveryId,
    occurrence: 0,
    orderedIds: [`element-${suffix}`],
    payload,
    inverseEvents: []
  }
  const delivery = {
    deliveryId,
    artifactId,
    batchId,
    transactionId,
    origin: 'action' as const,
    kind: 'forward' as const,
    channel,
    eventName,
    payload,
    recordId,
    record,
    sharedDelivery: 'immediate' as const
  }
  return {
    publicationId: `publication-${suffix}`,
    artifactId,
    transactionId,
    origin: 'action',
    deliveries: [delivery],
    batches: [
      {
        batchId,
        sliceId,
        artifactId,
        transactionId,
        origin: 'action',
        kind: 'forward',
        channel,
        sharedDelivery: 'immediate',
        deliveries: [delivery],
        records: [record],
        changes: [payload]
      }
    ],
    deliveryPlan: {
      mode: 'progressive',
      slices: [{ sliceId, orderedIds: [deliveryId] }]
    }
  }
}

const publication = createPublication()

const createTwoBatchPublication = (): SharedPublication => {
  const first = createPublication({ suffix: 'first', transactionId: 4 })
  const second = createPublication({ suffix: 'second', transactionId: 4 })
  return {
    ...first,
    publicationId: 'publication-two-batches',
    deliveries: [...first.deliveries, ...second.deliveries],
    batches: [...first.batches, ...second.batches],
    deliveryPlan: {
      mode: 'progressive',
      slices: [...first.deliveryPlan.slices, ...second.deliveryPlan.slices]
    }
  }
}

const createMultiRecordPublication = (
  payloads: readonly object[]
): SharedPublication => {
  const artifactId = '3:artifact'
  const batchId = '3:batch:multi'
  const sliceId = '3:slice:multi'
  const records = payloads.map((payload, index) => {
    const deliveryId = `3:delivery:${index}`
    return {
      recordId: `3:record:${index}`,
      deliveryId,
      occurrence: index,
      orderedIds: [`element-${index}`],
      payload,
      inverseEvents: []
    }
  })
  const deliveries = records.map((record, index) => ({
    deliveryId: record.deliveryId,
    artifactId,
    batchId,
    transactionId: 3,
    origin: 'action' as const,
    kind: 'forward' as const,
    channel: 'sceneTree',
    eventName: 'updateComputedData',
    payload: payloads[index] as object,
    recordId: record.recordId,
    record,
    sharedDelivery: 'immediate' as const
  }))
  return {
    publicationId: 'publication-multi',
    artifactId,
    transactionId: 3,
    origin: 'action',
    deliveries,
    batches: [
      {
        batchId,
        sliceId,
        artifactId,
        transactionId: 3,
        origin: 'action',
        kind: 'forward',
        channel: 'sceneTree',
        sharedDelivery: 'immediate',
        deliveries,
        records,
        changes: payloads
      }
    ],
    deliveryPlan: {
      mode: 'progressive',
      slices: [
        {
          sliceId,
          orderedIds: deliveries.map(({ deliveryId }) => deliveryId)
        }
      ]
    }
  }
}

describe('collaboration wire protocol', () => {
  it('keeps control messages as ordinary JSON while every publication uses a versioned binary frame', () => {
    const hello = {
      type: CollaborationMessageTypes.HELLO,
      identity: {
        actorId: 'actor-a',
        documentId: 'document-a',
        roomId: 'room-a'
      }
    }
    const encodedHello = encodeCollaborationMessage(hello)
    expect(typeof encodedHello).toBe('string')
    expect(JSON.parse(encodedHello as string)).toEqual(hello)

    const request: CollaborationRequestMessage = {
      type: CollaborationMessageTypes.SEND_PUBLICATION,
      requestId: 'request-small',
      publication
    }
    const encoded = encodeCollaborationMessage(request)

    expect(encoded).toBeInstanceOf(Uint8Array)
    if (!(encoded instanceof Uint8Array)) {
      throw new Error('Publication messages must use binary frames')
    }
    expect(decodeCollaborationMessage(encoded)).toEqual(request)
  })

  it('keeps every control shape as JSON without entering the publication codec', () => {
    const controls = [
      {
        type: CollaborationMessageTypes.SEND_AWARENESS,
        requestId: 'request-awareness',
        message: {
          actorId: 'actor-a',
          clock: 1,
          state: { selection: 'x'.repeat(40_000) }
        }
      },
      {
        type: CollaborationMessageTypes.FRAME_CONSUMED,
        requestId: 'request-credit',
        frameId: 'frame-a',
        publicationId: 'publication-a',
        frameByteLength: 1_024
      },
      { type: CollaborationMessageTypes.READY },
      {
        type: CollaborationMessageTypes.RESPONSE,
        requestId: 'request-ok',
        ok: true
      },
      {
        type: CollaborationMessageTypes.RESPONSE,
        requestId: 'request-failed',
        ok: false,
        error: { code: 'rejected', message: 'rejected' }
      },
      {
        type: CollaborationMessageTypes.AWARENESS,
        actorId: 'actor-b',
        clock: 2,
        state: { cursor: null }
      },
      {
        type: CollaborationMessageTypes.AWARENESS_DISCONNECT,
        actorId: 'actor-b'
      },
      {
        type: CollaborationMessageTypes.FAILURE,
        code: 'transport-failed',
        message: 'failed'
      },
      {
        type: CollaborationMessageTypes.CONNECTION_ERROR,
        code: 'connection-rejected',
        message: 'rejected'
      }
    ] as const

    for (const control of controls) {
      const encoded = encodeCollaborationMessage(control)
      expect(typeof encoded).toBe('string')
      expect(JSON.parse(encoded as string)).toEqual(control)
    }
  })

  it('rejects binary control frames at the collaboration boundary', () => {
    for (const control of [
      { type: CollaborationMessageTypes.READY },
      {
        type: CollaborationMessageTypes.AWARENESS,
        actorId: 'actor-b',
        clock: 1,
        state: { cursor: null }
      }
    ]) {
      expect(() =>
        decodeCollaborationMessage(encodeCompactBinary(control))
      ).toThrow(/publication frame/)
    }
  })

  it('does not JSON stringify publication data before binary encoding', () => {
    const sentinel = new Error('stringify sentinel')
    const guardedPublication = new Proxy(publication, {
      get: (target, key, receiver) => {
        if (key === 'toJSON') throw sentinel
        return Reflect.get(target, key, receiver)
      }
    })
    const request: CollaborationRequestMessage = {
      type: CollaborationMessageTypes.SEND_PUBLICATION,
      requestId: 'request-with-guard',
      publication: guardedPublication
    }

    expect(() => encodeCollaborationMessage(request)).not.toThrow()
    expect(
      decodeCollaborationMessage(encodeCollaborationMessage(request))
    ).toEqual(request)
  })

  it('decodes text and base64 binary CDP WebSocket profile frames with exact wire bytes', () => {
    const text = JSON.stringify({ type: 'ready' })
    const textFrame = decodeProfiledWebSocketFrame({
      opcode: 1,
      payloadData: text
    })
    expect(textFrame).toEqual({
      value: { type: 'ready' },
      wireByteLength: new TextEncoder().encode(text).byteLength
    })

    const binaryValue = { payload: 'binary-profile-value'.repeat(2_048) }
    const binary = encodeCompactBinary(binaryValue)
    const binaryFrame = decodeProfiledWebSocketFrame({
      opcode: 2,
      payloadData: Buffer.from(binary).toString('base64')
    })
    expect(binaryFrame).toEqual({
      value: binaryValue,
      wireByteLength: binary.byteLength
    })
    expect(
      decodeProfiledWebSocketFrame({ opcode: 8, payloadData: '' })
    ).toBeNull()
  })

  it('losslessly encodes large numeric publication snapshots as compact binary', () => {
    const pointIds = Array.from(
      { length: 1024 },
      (_, index) => `vector-point-${String(index).padStart(6, '0')}`
    )
    const payload = {
      action: 'addProperty',
      data: pointIds.map((id, index) => ({
        id,
        type: 'vectorSegment',
        startId: id,
        endId: pointIds[(index + 1) % pointIds.length],
        networkId: 'vector-network-shared',
        position: {
          x: index * 0.123456789,
          y: Math.sin(index) * 987.654321
        }
      })),
      eventName: 'addProperty',
      undoAction: 'removeProperty',
      undoType: 'removeProperty'
    }
    const request: CollaborationRequestMessage = {
      type: CollaborationMessageTypes.SEND_PUBLICATION,
      requestId: 'request-large',
      publication: createPublication({
        channel: 'props',
        eventName: 'addProperty',
        payload,
        suffix: 'large'
      })
    }
    const plain = JSON.stringify(request)
    const encoded = encodeCollaborationMessage(request)
    const decoded = decodeCollaborationMessage(encoded)

    expect(encoded).toBeInstanceOf(Uint8Array)
    if (!(encoded instanceof Uint8Array)) {
      throw new Error('Large collaboration messages must use binary encoding')
    }
    expect(encoded.byteLength).toBeLessThan(plain.length * 0.6)
    expect(decoded).toEqual(request)
    expect(parseCollaborationClientMessage(decoded)).toEqual(request)

    expect(() =>
      decodeCollaborationMessage(encoded.subarray(0, encoded.byteLength - 1))
    ).toThrow(TypeError)
  })

  it('round-trips ordered publication chunks and exposes relay-readable headers', () => {
    const secondPublication = createPublication({
      payload: { value: 'x'.repeat(8_192) },
      suffix: 'b',
      transactionId: 2
    })
    const request: CollaborationRequestMessage = {
      type: CollaborationMessageTypes.SEND_PUBLICATIONS,
      requestId: 'request-chunked',
      publications: [publication, secondPublication]
    }

    const frames = encodePublicationMessageFrames(request, {
      softTargetBytes: 512
    })

    expect(frames.length).toBeGreaterThanOrEqual(2)
    frames.forEach((frame, index) => {
      expect(frame).toBeInstanceOf(ArrayBuffer)
      expect(inspectPublicationFrameHeader(frame)).toMatchObject({
        requestId: 'request-chunked',
        publicationCount: 2,
        publicationIndex: index === 0 ? 0 : expect.any(Number)
      })
    })
    expect(decodePublicationMessageFrames(frames)).toEqual(request)
  })

  it('preserves every UTF-16 code unit in publication frame identities', () => {
    const publicationId = '\ud800-publication'
    const requestId = '\udfff-request'
    const fromActorId = '\ud800-actor'
    const identifiedPublication = {
      ...publication,
      publicationId
    }
    const request: CollaborationRequestMessage = {
      type: CollaborationMessageTypes.SEND_PUBLICATION,
      requestId,
      publication: identifiedPublication
    }
    const relay: CollaborationServerMessage = {
      type: CollaborationMessageTypes.PUBLICATION,
      publication: identifiedPublication,
      fromActorId
    }

    const requestFrames = encodePublicationMessageFrames(request)
    const relayFrames = encodePublicationMessageFrames(relay)

    expect(
      inspectPublicationFrameHeader(requestFrames[0] as ArrayBuffer)
    ).toMatchObject({ publicationId, requestId })
    expect(
      inspectPublicationFrameHeader(relayFrames[0] as ArrayBuffer)
    ).toMatchObject({ fromActorId, publicationId })
    expect(decodePublicationMessageFrames(requestFrames)).toEqual(request)
    expect(decodePublicationMessageFrames(relayFrames)).toEqual(relay)
  })

  it('keeps frame credit identities unambiguous when canonical IDs contain colons', () => {
    const first = encodePublicationMessageFrames({
      type: CollaborationMessageTypes.SEND_PUBLICATION,
      requestId: 'a:b',
      publication: { ...publication, publicationId: 'c' }
    })[0]
    const second = encodePublicationMessageFrames({
      type: CollaborationMessageTypes.SEND_PUBLICATION,
      requestId: 'a',
      publication: { ...publication, publicationId: 'b:c' }
    })[0]
    if (!first || !second) throw new Error('Expected publication frames')

    expect(inspectPublicationFrameHeader(first).frameId).not.toBe(
      inspectPublicationFrameHeader(second).frameId
    )
  })

  it('rejects duplicate publication identities before framing', () => {
    const duplicate = {
      ...createPublication({ suffix: 'b', transactionId: 2 }),
      publicationId: publication.publicationId
    }

    expect(() =>
      encodePublicationMessageFrames({
        type: CollaborationMessageTypes.SEND_PUBLICATIONS,
        requestId: 'request-duplicate-publication',
        publications: [publication, duplicate]
      })
    ).toThrow(/duplicate publication identity/)
  })

  it('rejects duplicate batch, delivery, and record identities before framing', () => {
    const base = createTwoBatchPublication()
    const firstBatch = base.batches[0]
    const secondBatch = base.batches[1]
    const firstDelivery = firstBatch?.deliveries[0]
    const secondDelivery = secondBatch?.deliveries[0]
    if (!firstBatch || !secondBatch || !firstDelivery || !secondDelivery) {
      throw new Error('Expected a two-batch publication fixture')
    }

    const duplicateBatchDelivery = {
      ...secondDelivery,
      batchId: firstBatch.batchId
    }
    const duplicateBatchId: SharedPublication = {
      ...base,
      deliveries: [firstDelivery, duplicateBatchDelivery],
      batches: [
        firstBatch,
        {
          ...secondBatch,
          batchId: firstBatch.batchId,
          deliveries: [duplicateBatchDelivery]
        }
      ]
    }

    const duplicateDeliveryRecord = {
      ...secondDelivery.record,
      deliveryId: firstDelivery.deliveryId
    }
    const duplicateDelivery = {
      ...secondDelivery,
      deliveryId: firstDelivery.deliveryId,
      record: duplicateDeliveryRecord
    }
    const duplicateDeliveryId: SharedPublication = {
      ...base,
      deliveries: [firstDelivery, duplicateDelivery],
      batches: [
        firstBatch,
        {
          ...secondBatch,
          deliveries: [duplicateDelivery],
          records: [duplicateDeliveryRecord]
        }
      ]
    }

    const duplicateRecord = {
      ...secondDelivery.record,
      recordId: firstDelivery.recordId
    }
    const duplicateRecordDelivery = {
      ...secondDelivery,
      recordId: firstDelivery.recordId,
      record: duplicateRecord
    }
    const duplicateRecordId: SharedPublication = {
      ...base,
      deliveries: [firstDelivery, duplicateRecordDelivery],
      batches: [
        firstBatch,
        {
          ...secondBatch,
          deliveries: [duplicateRecordDelivery],
          records: [duplicateRecord]
        }
      ]
    }

    for (const candidate of [
      duplicateBatchId,
      duplicateDeliveryId,
      duplicateRecordId
    ]) {
      expect(() =>
        encodePublicationMessageFrames({
          type: CollaborationMessageTypes.SEND_PUBLICATION,
          requestId: 'request-duplicate-canonical-id',
          publication: candidate
        })
      ).toThrow(/invalid shared publication/)
    }
  })

  it('splits a multi-record publication only at canonical record boundaries', () => {
    const publicationWithRecords = createMultiRecordPublication(
      Array.from({ length: 12 }, (_, index) => ({
        id: `element-${index}`,
        source: `${String(index).padStart(2, '0')}:${'x'.repeat(768)}`
      }))
    )
    const request: CollaborationRequestMessage = {
      type: CollaborationMessageTypes.SEND_PUBLICATION,
      requestId: 'request-record-chunks',
      publication: publicationWithRecords
    }

    const frames = encodePublicationMessageFrames(request, {
      softTargetBytes: 4_096
    })

    expect(frames.length).toBeGreaterThan(1)
    expect(frames.every(({ byteLength }) => byteLength <= 4_096)).toBe(true)
    expect(decodePublicationMessageFrames(frames)).toEqual(request)
  })

  it('does not re-encode discarded record ranges while planning chunks', () => {
    let descriptorReadCount = 0
    const payloads = Array.from(
      { length: 16 },
      (_, index) =>
        new Proxy(
          {
            id: `element-${index}`,
            source: `${String(index).padStart(2, '0')}:${'x'.repeat(768)}`
          },
          {
            getOwnPropertyDescriptor(target, key) {
              descriptorReadCount += 1
              return Reflect.getOwnPropertyDescriptor(target, key)
            }
          }
        )
    )
    const request: CollaborationRequestMessage = {
      type: CollaborationMessageTypes.SEND_PUBLICATION,
      requestId: 'request-linear-record-plan',
      publication: createMultiRecordPublication(payloads)
    }

    encodePublicationMessageFrames(request, {
      softTargetBytes: Number.MAX_SAFE_INTEGER
    })
    const unsplitDescriptorReads = descriptorReadCount
    descriptorReadCount = 0

    const splitFrames = encodePublicationMessageFrames(request, {
      softTargetBytes: 4_096
    })

    expect(splitFrames.length).toBeGreaterThan(1)
    expect(descriptorReadCount).toBe(unsplitDescriptorReads)
  })

  it('treats 1 MiB as a soft frame target and accepts one oversized indivisible record', () => {
    const oversizedPublication = createPublication({
      payload: { source: 'x'.repeat(1_100_000) },
      suffix: 'oversized'
    })
    const request: CollaborationRequestMessage = {
      type: CollaborationMessageTypes.SEND_PUBLICATION,
      requestId: 'request-oversized',
      publication: oversizedPublication
    }

    const frames = encodePublicationMessageFrames(request)

    expect(frames).toHaveLength(1)
    expect(frames[0]?.byteLength).toBeGreaterThan(1_048_576)
    expect(decodePublicationMessageFrames(frames)).toEqual(request)
  })

  it('keeps one oversized record indivisible beside other canonical records', () => {
    const request: CollaborationRequestMessage = {
      type: CollaborationMessageTypes.SEND_PUBLICATION,
      requestId: 'request-oversized-among-records',
      publication: createMultiRecordPublication([
        {
          id: 'oversized-record',
          source: 'unique-oversized-record-value'.repeat(48_000)
        },
        { id: 'tail-record', source: 'tail' }
      ])
    }

    const frames = encodePublicationMessageFrames(request)
    const oversizedFrames = frames.filter(
      ({ byteLength }) => byteLength > 1_048_576
    )

    expect(frames.length).toBeGreaterThan(1)
    expect(oversizedFrames).toHaveLength(1)
    expect(decodePublicationMessageFrames(frames)).toEqual(request)
  })

  it('rejects unsupported versions and truncated publication frames', () => {
    const request: CollaborationRequestMessage = {
      type: CollaborationMessageTypes.SEND_PUBLICATION,
      requestId: 'request-invalid-frame',
      publication
    }
    const frame = encodePublicationMessageFrames(request)[0]
    if (!frame) throw new Error('Expected one publication frame')
    const unsupported = frame.slice(0)
    new Uint8Array(unsupported)[PUBLICATION_FRAME_VERSION_OFFSET] = 0xff

    expect(() => decodePublicationMessageFrames([unsupported])).toThrow(
      /unsupported publication frame version/
    )
    expect(() =>
      decodePublicationMessageFrames([frame.slice(0, frame.byteLength - 1)])
    ).toThrow(/truncated publication frame payload/)
  })

  it('preserves every UTF-16 code unit and prototype-shaped own key', () => {
    const input: Record<string, unknown> = {
      values: [
        '\ud800-value',
        '\ud800-value',
        '\udfff-value',
        '\ufeffinline-value',
        '\ufeffdictionary-value',
        '\ufeffdictionary-value'
      ],
      constructor: 'own-constructor',
      prototype: 'own-prototype'
    }
    Object.defineProperty(input, '__proto__', {
      configurable: true,
      enumerable: true,
      value: { polluted: false },
      writable: true
    })

    const decoded = decodeCompactBinary(encodeCompactBinary(input)) as Record<
      string,
      unknown
    >

    expect(decoded).toEqual(input)
    expect(Object.getPrototypeOf(decoded)).toBe(Object.prototype)
    expect(Object.hasOwn(decoded, '__proto__')).toBe(true)
    expect(Object.hasOwn(decoded, 'constructor')).toBe(true)
    expect(Object.hasOwn(decoded, 'prototype')).toBe(true)
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
  })

  it('builds one exact reusable binary plan without a second measurement pass', () => {
    const metadata = {
      artifactId: 'artifact-shared-prefix',
      mode: 'progressive'
    }
    const items = Array.from({ length: 140 }, (_, index) => ({
      id: `element-shared-prefix-${String(index).padStart(4, '0')}`,
      relationshipId: `relationship-shared-prefix-${String(index).padStart(
        4,
        '0'
      )}`,
      repeated: 'dictionary-shared-value'
    }))

    const value = [metadata, items]
    const plan = createCompactBinaryEncodePlan(value)
    const encoded = encodeCompactBinaryPlan(plan)

    expect(plan.byteLength).toBe(encoded.byteLength)
    expect(decodeCompactBinary(encoded)).toEqual(value)
  })

  it('rejects non-canonical varints and decodes deeply nested finite arrays', () => {
    const marker = [0x41, 0x53, 0x59, 0x52, 0x41, 0x01]
    expect(() =>
      decodeCompactBinary(new Uint8Array([...marker, 0x80, 0x00, 0x00]))
    ).toThrow(TypeError)

    const depth = 20_000
    const nested = new Uint8Array(marker.length + 1 + depth * 2 + 1)
    nested.set(marker)
    let offset = marker.length
    nested[offset] = 0
    offset += 1
    for (let index = 0; index < depth; index += 1) {
      nested[offset] = 7
      nested[offset + 1] = 1
      offset += 2
    }
    nested[offset] = 0

    let decoded = decodeCompactBinary(nested)
    for (let index = 0; index < depth; index += 1) {
      expect(Array.isArray(decoded)).toBe(true)
      decoded = (decoded as unknown[])[0]
    }
    expect(decoded).toBeNull()
  })

  it('round-trips a deeply nested finite publication without a call-stack ceiling', () => {
    const depth = 20_000
    let payload: unknown = null
    const wrappers: ('array' | 'object')[] = []
    for (let index = 0; index < depth; index += 1) {
      const wrapper = index % 2 === 0 ? 'array' : 'object'
      wrappers.push(wrapper)
      payload = wrapper === 'array' ? [payload] : { next: payload }
    }
    const request: CollaborationRequestMessage = {
      type: CollaborationMessageTypes.SEND_PUBLICATION,
      requestId: 'request-deep',
      publication: createPublication({
        payload: payload as object,
        suffix: 'deep'
      })
    }

    const encoded = encodeCollaborationMessage(request)
    const decoded = parseCollaborationClientMessage(
      decodeCollaborationMessage(encoded)
    )
    if (decoded.type !== CollaborationMessageTypes.SEND_PUBLICATION) {
      throw new Error('Deep collaboration request changed message type')
    }
    let decodedPayload = decoded.publication.deliveries[0]?.payload
    for (let index = wrappers.length - 1; index >= 0; index -= 1) {
      if (wrappers[index] === 'array') {
        expect(Array.isArray(decodedPayload)).toBe(true)
        decodedPayload = (decodedPayload as unknown[])[0]
      } else {
        expect(decodedPayload).not.toBeNull()
        expect(Array.isArray(decodedPayload)).toBe(false)
        decodedPayload = (decodedPayload as { next: unknown }).next
      }
    }
    expect(decodedPayload).toBeNull()
  })

  it('accepts shared aliases while rejecting cycles and non-data array shapes without invoking getters', () => {
    const shared = { value: 1 }
    const aliases = { first: shared, second: shared }
    expect(isJsonTransportValue(aliases)).toBe(true)
    expect(decodeCompactBinary(encodeCompactBinary(aliases))).toEqual(aliases)

    const cycle: { self?: unknown } = {}
    cycle.self = cycle
    expect(isJsonTransportValue(cycle)).toBe(false)
    expect(() => encodeCollaborationMessage(cycle)).toThrow(TypeError)

    const sparse = new Array<unknown>(2)
    sparse[0] = 'present'
    expect(isJsonTransportValue(sparse)).toBe(false)

    const extraKey = ['value'] as unknown[] & { extra?: string }
    extraKey.extra = 'not-json-array-shape'
    expect(isJsonTransportValue(extraKey)).toBe(false)

    const symbolKey = ['value']
    Object.defineProperty(symbolKey, Symbol('extra'), {
      enumerable: true,
      value: 'not-json-array-shape'
    })
    expect(isJsonTransportValue(symbolKey)).toBe(false)

    const getter = vi.fn(() => 'not-readable')
    const accessor: Record<string, unknown> = {}
    Object.defineProperty(accessor, 'value', {
      enumerable: true,
      get: getter
    })
    expect(isJsonTransportValue(accessor)).toBe(false)
    expect(getter).not.toHaveBeenCalled()
  })

  it('keeps a finite deep transport value when optional compact JSON exceeds its call stack', () => {
    const depth = 3_000
    const leaf = 'x'.repeat(33_000)
    let value: unknown = leaf
    for (let index = 0; index < depth; index += 1) {
      value = [value]
    }

    const encoded = encodeCompactBinary(value)
    let decodedValue = decodeCompactBinary(encoded)
    for (let index = 0; index < depth; index += 1) {
      expect(Array.isArray(decodedValue)).toBe(true)
      decodedValue = (decodedValue as unknown[])[0]
    }
    expect(decodedValue).toBe(leaf)
  })

  it('rejects a dictionary prefix chain that crosses a bounded checkpoint', () => {
    const marker = [0x41, 0x53, 0x59, 0x52, 0x41, 0x01]
    const dictionary: number[] = [65]
    for (let index = 0; index < 65; index += 1) {
      dictionary.push(index, 0, 1, 0x61)
    }

    expect(() =>
      decodeCompactBinary(new Uint8Array([...marker, ...dictionary, 0]))
    ).toThrow(TypeError)
  })

  it('preserves safe integers beyond 32 bits and rejects malformed binary values', () => {
    const marker = [0x41, 0x53, 0x59, 0x52, 0x41, 0x01]
    const integers = {
      positive: 2 ** 32 + 123,
      negative: -(2 ** 32 + 123),
      largestCompact: 2 ** 52 - 1
    }

    expect(decodeCompactBinary(encodeCompactBinary(integers))).toEqual(integers)

    const malformed = [
      new Uint8Array([0, ...marker.slice(1), 0, 0]),
      new Uint8Array([...marker, 0, 0xff]),
      new Uint8Array([...marker, 0, 0, 0]),
      new Uint8Array([
        ...marker,
        ...Array.from({ length: 8 }, () => 0xff),
        0x7f,
        0
      ]),
      new Uint8Array([...marker, 0, 5, 2, 0]),
      new Uint8Array([...marker, 0, 5, 0, 1, 0xff]),
      new Uint8Array([...marker, 0, 5, 1, 2, 0x41, 0]),
      new Uint8Array([...marker, 0, 6, 0])
    ]

    malformed.forEach((value) => {
      expect(() => decodeCompactBinary(value)).toThrow(TypeError)
    })
  })

  it('prefix-compacts ordered dictionary strings without changing canonical values', () => {
    const ids = Array.from(
      { length: 4_096 },
      (_, index) => `canonical-vector-point-${String(index).padStart(8, '0')}`
    )
    const input = ids.map((id, index) => ({
      id,
      startId: id,
      endId: ids[(index + 1) % ids.length],
      networkId: 'canonical-vector-network-shared',
      type: 'vectorSegment'
    }))
    const plain = JSON.stringify(input)
    const encoded = encodeCompactBinary(input)

    expect(encoded.byteLength).toBeLessThan(plain.length * 0.18)
    expect(decodeCompactBinary(encoded)).toEqual(input)
  })

  it('parses a detached publication request as its named variant', () => {
    const request: CollaborationRequestMessage = {
      type: CollaborationMessageTypes.SEND_PUBLICATION,
      requestId: 'request-1',
      publication
    }

    expect(parseCollaborationClientMessage(request)).toEqual(request)
  })

  it('parses an ordered non-empty publication batch in both directions', () => {
    const secondPublication = createPublication({
      suffix: 'b',
      transactionId: 2
    })
    const request = {
      type: 'send-publications',
      requestId: 'request-batch-1',
      publications: [publication, secondPublication]
    }
    const inbound = {
      type: 'publications',
      publications: [publication, secondPublication],
      fromActorId: 'actor-a'
    }

    expect(parseCollaborationClientMessage(request)).toEqual(request)
    expect(parseCollaborationServerMessage(inbound)).toEqual(inbound)
    expect(
      parseCollaborationClientMessage({
        ...request,
        publications: []
      })
    ).toBeUndefined()
    expect(
      parseCollaborationServerMessage({
        ...inbound,
        publications: [publication, { ...secondPublication, deliveries: null }]
      })
    ).toBeUndefined()
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
        publication: { ...publication, deliveries: 'not-an-array' }
      })
    ).toBeUndefined()
    expect(
      parseCollaborationClientMessage({
        type: CollaborationMessageTypes.SEND_PUBLICATION,
        requestId: 'request-1',
        publication: createPublication({
          channel: 'app-specific-channel',
          eventName: 'app-specific-event',
          suffix: 'app-specific'
        })
      })
    ).toBeDefined()

    const incompletePublications = [
      { publicationId: 'publication-a', deliveries: publication.deliveries },
      { ...publication, origin: 'unsupported-origin' },
      {
        ...publication,
        deliveries: [
          {
            transactionId: 1,
            origin: 'action',
            kind: 'forward',
            channel: 'sceneTree',
            eventName: 'updateComputedData',
            payload: { value: 1 },
            sharedDelivery: 'immediate'
          }
        ]
      },
      {
        ...publication,
        deliveries: [
          {
            ...publication.deliveries[0],
            sharedDelivery: 'unsupported-delivery-mode'
          }
        ]
      },
      {
        ...publication,
        batches: [
          {
            ...publication.batches[0],
            artifactId: 'different-artifact'
          }
        ]
      },
      {
        ...publication,
        deliveryPlan: {
          mode: 'progressive',
          slices: [
            {
              sliceId: 'different-slice',
              orderedIds: ['element-a']
            }
          ]
        }
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
