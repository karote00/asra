import type { SharedPublication } from '@asyra/factory'
import { Buffer } from 'node:buffer'
import { describe, expect, it, vi } from 'vitest'
import {
  decodeCompactBinary,
  encodeCompactBinary
} from '../../collaboration/compact-binary'
import {
  CollaborationMessageTypes,
  decodeCollaborationMessage,
  encodeCollaborationMessage,
  isJsonTransportValue,
  parseCollaborationClientMessage,
  parseCollaborationServerMessage,
  type CollaborationRequestMessage,
  type CollaborationServerMessage
} from '../../collaboration/protocol'
import { decodeProfiledWebSocketFrame } from '../../collaboration/websocket-profile-frame'

const publication: SharedPublication = {
  publicationId: 'publication-a',
  transactionId: 1,
  origin: 'action',
  deliveries: [
    {
      deliveryId: 'delivery-a',
      transactionId: 1,
      origin: 'action',
      kind: 'forward',
      channel: 'sceneTree',
      eventName: 'updateComputedData',
      payload: { value: 1 },
      sharedDelivery: 'immediate'
    }
  ]
}

const publicationDelivery = (): SharedPublication['deliveries'][number] => {
  const delivery = publication.deliveries[0]
  if (!delivery) throw new Error('Fixture publication delivery is unavailable')
  return delivery
}

describe('collaboration wire protocol', () => {
  it('keeps small messages as ordinary JSON', () => {
    const request: CollaborationRequestMessage = {
      type: CollaborationMessageTypes.SEND_PUBLICATION,
      requestId: 'request-small',
      publication
    }
    const encoded = encodeCollaborationMessage(request)

    expect(typeof encoded).toBe('string')
    if (typeof encoded !== 'string') {
      throw new Error('Small collaboration messages must remain text JSON')
    }
    expect(JSON.parse(encoded)).toEqual(request)
    expect(decodeCollaborationMessage(encoded)).toEqual(request)
  })

  it('does not hide a stringify failure behind the binary fallback', () => {
    const sentinel = new Error('stringify sentinel')
    const value = new Proxy(
      { payload: 'x'.repeat(40_000) },
      {
        get: (target, key, receiver) => {
          if (key === 'toJSON') throw sentinel
          return Reflect.get(target, key, receiver)
        }
      }
    )

    expect(() => encodeCollaborationMessage(value)).toThrow(sentinel)
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
    const request: CollaborationRequestMessage = {
      type: CollaborationMessageTypes.SEND_PUBLICATION,
      requestId: 'request-large',
      publication: {
        ...publication,
        deliveries: [
          {
            ...publicationDelivery(),
            channel: 'props',
            eventName: 'addProperty',
            payload: {
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
          }
        ]
      }
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
      publication: {
        ...publication,
        deliveries: [
          {
            ...publicationDelivery(),
            payload
          }
        ]
      }
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
    expect(
      decodeCollaborationMessage(encodeCollaborationMessage(aliases))
    ).toEqual(aliases)

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

    const encoded = encodeCollaborationMessage(value)
    let decodedValue = decodeCollaborationMessage(encoded)
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
    const secondPublication: SharedPublication = {
      ...publication,
      publicationId: 'publication-b',
      transactionId: 2,
      deliveries: [
        {
          ...publicationDelivery(),
          deliveryId: 'delivery-b',
          transactionId: 2
        }
      ]
    }
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
        publication: {
          ...publication,
          deliveries: [
            {
              ...publication.deliveries[0],
              channel: 'app-specific-channel',
              eventName: 'app-specific-event'
            }
          ]
        }
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
