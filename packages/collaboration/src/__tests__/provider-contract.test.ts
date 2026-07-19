import * as Y from 'yjs'
import { describe, expect, it, vi } from 'vitest'
import { appendOperationToYDoc, readOperationLog } from '../yjs-document'
import type { SharedOperationEnvelope } from '../operation-envelope'
import { providerStatus } from '../provider'
import {
  MemoryCollaborationHub,
  MemoryCollaborationProvider
} from '../providers/memory-provider'

const identity = (actorId: string, roomId = 'room-a') => ({
  documentId: 'document-a',
  roomId,
  actorId,
  connectionMetadata: { token: `token-for-${actorId}` }
})

const envelope = (
  operationId: string,
  payload: unknown
): SharedOperationEnvelope => ({
  operationId,
  transactionId: operationId.replace(/:[^:]+$/, ''),
  documentId: 'document-a',
  actorId: 'actor-a',
  protocolVersion: 1,
  schemaVersion: 1,
  origin: 'action',
  channel: 'scene',
  eventName: 'set-value',
  payload
})

describe('replaceable collaboration provider contract', () => {
  it('transports binary updates to room peers, excludes sender echo, and acknowledges independently', async () => {
    const hub = new MemoryCollaborationHub()
    const first = new MemoryCollaborationProvider(hub, identity('actor-a'))
    const second = new MemoryCollaborationProvider(hub, identity('actor-b'))
    const firstInbound = vi.fn()
    const secondInbound = vi.fn()
    const acknowledgements = vi.fn()
    first.onUpdate(firstInbound)
    second.onUpdate((inbound) => inbound.update.fill(0))
    second.onUpdate(secondInbound)
    first.onAcknowledgement(acknowledgements)
    await first.connect()
    await second.connect()
    const source = new Y.Doc()
    const binary = appendOperationToYDoc(
      source,
      envelope('actor-a:session-a:1:forward', { value: 1 })
    )

    await first.sendUpdate(binary)

    expect(firstInbound).not.toHaveBeenCalled()
    expect(secondInbound).toHaveBeenCalledTimes(1)
    expect(secondInbound.mock.calls[0]?.[0]).toEqual({
      operationId: binary.operationId,
      update: binary.update,
      fromActorId: 'actor-a'
    })
    expect(acknowledgements).toHaveBeenCalledWith(
      expect.objectContaining({
        operationId: binary.operationId,
        durability: 'durable'
      })
    )
  })

  it('isolates document rooms and returns only state-vector-missing updates', async () => {
    const hub = new MemoryCollaborationHub()
    const sender = new MemoryCollaborationProvider(hub, identity('actor-a'))
    const otherRoom = new MemoryCollaborationProvider(
      hub,
      identity('actor-b', 'room-b')
    )
    const otherRoomInbound = vi.fn()
    otherRoom.onUpdate(otherRoomInbound)
    await sender.connect()
    await otherRoom.connect()
    const source = new Y.Doc()
    const firstEnvelope = envelope('actor-a:session-a:1:forward', {
      value: 1
    })
    const first = appendOperationToYDoc(source, firstEnvelope)
    await sender.sendUpdate(first)
    const secondEnvelope = envelope('actor-a:session-a:2:forward', {
      value: 2
    })
    const second = appendOperationToYDoc(source, secondEnvelope)
    await sender.sendUpdate(second)

    expect(otherRoomInbound).not.toHaveBeenCalled()

    const partiallySynced = new Y.Doc()
    Y.applyUpdate(partiallySynced, first.update)
    const missing = await sender.requestSync(
      Y.encodeStateVector(partiallySynced)
    )
    Y.applyUpdate(partiallySynced, missing)
    expect(readOperationLog(partiallySynced)).toEqual([
      firstEnvelope,
      secondEnvelope
    ])
    expect(missing.byteLength).toBeLessThan(
      (await sender.requestSync(new Uint8Array())).byteLength
    )
  })

  it('transports opaque awareness and emits disconnect cleanup without granting authority', async () => {
    const hub = new MemoryCollaborationHub()
    const sender = new MemoryCollaborationProvider(hub, identity('actor-a'))
    const receiver = new MemoryCollaborationProvider(hub, identity('actor-b'))
    const awareness = vi.fn()
    const disconnect = vi.fn()
    receiver.onAwareness((message) => {
      ;(message.state as { cursor: number[] }).cursor[0] = 999
    })
    receiver.onAwareness(awareness)
    receiver.onAwarenessDisconnect(disconnect)
    await sender.connect()
    await receiver.connect()

    await sender.sendAwareness({
      actorId: 'actor-a',
      clock: 1,
      state: { cursor: [10, 20], claimedRole: 'admin' }
    })
    await sender.disconnect()

    expect(awareness).toHaveBeenCalledWith({
      actorId: 'actor-a',
      clock: 1,
      state: { cursor: [10, 20], claimedRole: 'admin' }
    })
    expect(disconnect).toHaveBeenCalledWith({
      actorId: 'actor-a',
      reason: 'disconnect'
    })
  })

  it('reports offline without constructing a provider', () => {
    expect(providerStatus(undefined)).toBe('offline')
  })
})
