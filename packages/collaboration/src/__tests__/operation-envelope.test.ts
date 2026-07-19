import type { SharedDelivery } from '@asyra/factory'
import { describe, expect, it, vi } from 'vitest'
import {
  createOperationIdentitySource,
  createSharedOperationEnvelope,
  LocalOperationRejection
} from '../operation-envelope'
import {
  defineCanonicalOperationApply,
  OperationRegistry,
  type OperationDefinition
} from '../operation-registry'

interface MovePayload {
  id: string
  point: { x: number; y: number }
  tags: string[]
}

const applyMoveImplementation = vi.fn(() => true)
const applyMove = defineCanonicalOperationApply(applyMoveImplementation)

const moveDefinition: OperationDefinition<MovePayload> = {
  channel: 'scene',
  eventName: 'move-node',
  schemaVersion: 3,
  validate: (payload): payload is MovePayload => {
    if (!payload || typeof payload !== 'object') return false
    const candidate = payload as Partial<MovePayload>
    return (
      typeof candidate.id === 'string' &&
      typeof candidate.point?.x === 'number' &&
      typeof candidate.point?.y === 'number' &&
      Array.isArray(candidate.tags) &&
      candidate.tags.every((tag) => typeof tag === 'string')
    )
  },
  apply: applyMove
}

const delivery = (
  overrides: Partial<SharedDelivery<MovePayload>> = {}
): SharedDelivery<MovePayload> => ({
  deliveryId: '7:0:forward',
  transactionId: 7,
  origin: 'action',
  kind: 'forward',
  channel: 'scene',
  eventName: 'move-node',
  payload: {
    id: 'node-a',
    point: { x: 10, y: 20 },
    tags: ['selected']
  },
  sharedDelivery: 'transaction-end',
  ...overrides
})

const createEnvelope = (sharedDelivery = delivery()) =>
  createSharedOperationEnvelope({
    delivery: sharedDelivery,
    identity: {
      documentId: 'document-a',
      actorId: 'actor/a'
    },
    identitySource: createOperationIdentitySource('session:a'),
    registry: new OperationRegistry([moveDefinition])
  })

describe('shared operation envelope', () => {
  it('creates one immutable typed envelope with stable actor-scoped identity', () => {
    const localDelivery = delivery()
    const envelope = createEnvelope(localDelivery)
    const repeated = createEnvelope(localDelivery)

    expect(envelope).toEqual({
      operationId: 'actor%2Fa:session%3Aa:7%3A0%3Aforward',
      transactionId: 'actor%2Fa:session%3Aa:7',
      documentId: 'document-a',
      actorId: 'actor/a',
      protocolVersion: 1,
      schemaVersion: 3,
      origin: 'action',
      channel: 'scene',
      eventName: 'move-node',
      payload: {
        id: 'node-a',
        point: { x: 10, y: 20 },
        tags: ['selected']
      }
    })
    expect(repeated.operationId).toBe(envelope.operationId)
    expect(repeated.transactionId).toBe(envelope.transactionId)
    expect(Object.isFrozen(envelope)).toBe(true)
    expect(Object.isFrozen(envelope.payload)).toBe(true)
    expect(Object.isFrozen(envelope.payload.point)).toBe(true)
    expect(Object.isFrozen(envelope.payload.tags)).toBe(true)

    localDelivery.payload.point.x = 999
    localDelivery.payload.tags.push('mutated')
    expect(envelope.payload.point.x).toBe(10)
    expect(envelope.payload.tags).toEqual(['selected'])
    expect(applyMoveImplementation).not.toHaveBeenCalled()
  })

  it('rejects an unregistered route before creating an envelope', () => {
    expect(() =>
      createEnvelope(delivery({ eventName: 'unknown-event' }))
    ).toThrowError(
      expect.objectContaining<Partial<LocalOperationRejection>>({
        code: 'unregistered-operation',
        channel: 'scene',
        eventName: 'unknown-event'
      })
    )
  })

  it('rejects a payload that fails its registered validator', () => {
    expect(() =>
      createEnvelope(
        delivery({
          payload: {
            id: 'node-a',
            point: { x: 'bad', y: 20 },
            tags: []
          } as unknown as MovePayload
        })
      )
    ).toThrowError(
      expect.objectContaining<Partial<LocalOperationRejection>>({
        code: 'invalid-payload',
        channel: 'scene',
        eventName: 'move-node'
      })
    )
  })

  it('maps a compensation to the exact original operation identity', () => {
    const envelope = createEnvelope(
      delivery({
        deliveryId: '7:0:compensation:0',
        kind: 'compensation',
        origin: 'rollback-compensation',
        compensatesDeliveryId: '7:0:forward',
        sharedDelivery: 'immediate'
      })
    )

    expect(envelope.operationId).toBe(
      'actor%2Fa:session%3Aa:7%3A0%3Acompensation%3A0'
    )
    expect(envelope.compensatesOperationId).toBe(
      'actor%2Fa:session%3Aa:7%3A0%3Aforward'
    )
  })

  it('rejects malformed compensation metadata', () => {
    expect(() =>
      createEnvelope(
        delivery({
          kind: 'compensation',
          origin: 'rollback-compensation',
          compensatesDeliveryId: undefined
        })
      )
    ).toThrowError(
      expect.objectContaining<Partial<LocalOperationRejection>>({
        code: 'invalid-compensation'
      })
    )

    expect(() =>
      createEnvelope(delivery({ compensatesDeliveryId: 'another-delivery' }))
    ).toThrowError(
      expect.objectContaining<Partial<LocalOperationRejection>>({
        code: 'invalid-compensation'
      })
    )
  })
})

describe('operation registry', () => {
  it('rejects duplicate routes and invalid schema versions', () => {
    expect(
      () => new OperationRegistry([moveDefinition, moveDefinition])
    ).toThrow('[collaboration] duplicate operation scene/move-node')
    expect(
      () =>
        new OperationRegistry([
          { ...moveDefinition, schemaVersion: 0 } as OperationDefinition
        ])
    ).toThrow('[collaboration] schemaVersion must be a positive integer')
  })

  it('retains the canonical apply handler without executing it', () => {
    const registry = new OperationRegistry([moveDefinition])

    expect(registry.resolve('scene', 'move-node')?.apply).toBe(applyMove)
    expect(
      () =>
        new OperationRegistry([
          {
            ...moveDefinition,
            apply: 'invalid'
          } as unknown as OperationDefinition
        ])
    ).toThrow(
      '[collaboration] canonical apply handler must use defineCanonicalOperationApply'
    )
  })
})
