import * as Y from 'yjs'
import { describe, expect, it, vi } from 'vitest'
import type { SharedOperationEnvelope } from '../operation-envelope'
import {
  CollaborationDurabilityRuntime,
  MemoryCollaborationUpdatePersistence
} from '../persistence'
import {
  MemoryCollaborationHub,
  MemoryCollaborationProvider
} from '../providers/memory-provider'
import {
  appendOperationToYDoc,
  applyInboundYjsUpdate,
  readOperationLog
} from '../yjs-document'

const identity = (actorId: string) => ({
  documentId: 'document-a',
  roomId: 'room-a',
  actorId
})

const envelope = (
  actorId: string,
  sequence: number
): SharedOperationEnvelope => ({
  operationId: `${actorId}:session:${sequence}:forward`,
  transactionId: `${actorId}:session:${sequence}`,
  documentId: 'document-a',
  actorId,
  protocolVersion: 1,
  schemaVersion: 1,
  origin: 'action',
  channel: 'scene',
  eventName: 'set-value',
  payload: { actorId, sequence }
})

describe('collaboration update persistence and durability states', () => {
  it('keeps runtime commit, local persistence, network send, and durable acknowledgement distinct', async () => {
    const document = new Y.Doc()
    const binary = appendOperationToYDoc(document, envelope('actor-a', 1))
    const persistence = new MemoryCollaborationUpdatePersistence()
    const provider = new MemoryCollaborationProvider(
      new MemoryCollaborationHub(),
      identity('actor-a')
    )
    await provider.connect()
    const runtime = new CollaborationDurabilityRuntime({
      document,
      documentId: 'document-a',
      persistence,
      provider
    })
    const events = vi.fn()
    runtime.observe(events)

    const outcome = await runtime.settleLocalUpdate(binary)

    expect(outcome.phases).toEqual([
      'runtime-committed',
      'locally-persisted',
      'network-sent',
      'durable-acknowledged'
    ])
    expect(events.mock.calls.map(([event]) => event.phase)).toEqual(
      outcome.phases
    )
    const persisted = await persistence.load('document-a')
    expect(persisted).toHaveLength(1)
    expect(persisted[0]?.operationId).toBe(binary.operationId)
    expect(persisted[0]?.update).toEqual(binary.update)
  })

  it('continues independent network settlement after persistence failure without rolling back canonical state', async () => {
    const document = new Y.Doc()
    const binary = appendOperationToYDoc(document, envelope('actor-a', 1))
    const persistenceFailure = new Error('local persistence failed')
    const persistence = new MemoryCollaborationUpdatePersistence({
      appendFailure: persistenceFailure
    })
    const provider = new MemoryCollaborationProvider(
      new MemoryCollaborationHub(),
      identity('actor-a')
    )
    await provider.connect()
    const canonicalState = { value: 1 }
    const runtime = new CollaborationDurabilityRuntime({
      document,
      documentId: 'document-a',
      persistence,
      provider
    })

    const outcome = await runtime.settleLocalUpdate(binary)

    expect(outcome.phases).toEqual([
      'runtime-committed',
      'persistence-failed',
      'network-sent',
      'durable-acknowledged'
    ])
    expect(outcome.events[1]).toEqual(
      expect.objectContaining({ error: persistenceFailure })
    )
    expect(canonicalState.value).toBe(1)
  })

  it('reports durable acknowledgement failure after network delivery without rolling back runtime state', async () => {
    const document = new Y.Doc()
    const binary = appendOperationToYDoc(document, envelope('actor-a', 1))
    const acknowledgementFailure = new Error('durable store unavailable')
    const provider = new MemoryCollaborationProvider(
      new MemoryCollaborationHub({
        acknowledgeUpdate: () => {
          throw acknowledgementFailure
        }
      }),
      identity('actor-a')
    )
    await provider.connect()
    const canonicalState = { value: 1 }
    const runtime = new CollaborationDurabilityRuntime({
      document,
      documentId: 'document-a',
      provider
    })

    const outcome = await runtime.settleLocalUpdate(binary)

    expect(outcome.phases).toEqual([
      'runtime-committed',
      'persistence-skipped',
      'network-sent',
      'acknowledgement-failed'
    ])
    expect(outcome.events.at(-1)).toEqual(
      expect.objectContaining({ error: acknowledgementFailure })
    )
    expect(canonicalState.value).toBe(1)
  })

  it('uses explicit skipped states when persistence and provider are absent', async () => {
    const document = new Y.Doc()
    const binary = appendOperationToYDoc(document, envelope('actor-a', 1))
    const runtime = new CollaborationDurabilityRuntime({
      document,
      documentId: 'document-a'
    })

    const outcome = await runtime.settleLocalUpdate(binary)

    expect(outcome.phases).toEqual([
      'runtime-committed',
      'persistence-skipped',
      'network-skipped'
    ])
  })

  it('recovers persisted binary document updates without an awareness record', async () => {
    const source = new Y.Doc()
    const binary = appendOperationToYDoc(source, envelope('actor-a', 1))
    const persistence = new MemoryCollaborationUpdatePersistence()
    await persistence.append({
      documentId: 'document-a',
      operationId: binary.operationId,
      update: binary.update
    })
    const recovered = new Y.Doc()
    const runtime = new CollaborationDurabilityRuntime({
      document: recovered,
      documentId: 'document-a',
      persistence
    })

    const operations = await runtime.recoverFromPersistence()

    expect(operations).toEqual([envelope('actor-a', 1)])
    expect(readOperationLog(recovered)).toEqual([envelope('actor-a', 1)])
    expect(await persistence.load('other-document')).toEqual([])
    expect(JSON.stringify(await persistence.load('document-a'))).not.toContain(
      'awareness'
    )
  })
})

describe('state-vector reconnect convergence', () => {
  it('pulls and pushes only missing updates so offline peers converge in both directions', async () => {
    const hub = new MemoryCollaborationHub()
    const providerA = new MemoryCollaborationProvider(hub, identity('actor-a'))
    const providerB = new MemoryCollaborationProvider(hub, identity('actor-b'))
    await providerA.connect()
    const documentA = new Y.Doc()
    const operationA = appendOperationToYDoc(
      documentA,
      envelope('actor-a', 1)
    )
    await providerA.sendUpdate(operationA)

    const documentB = new Y.Doc()
    appendOperationToYDoc(documentB, envelope('actor-b', 1))
    providerA.onUpdate((binary) => {
      applyInboundYjsUpdate(documentA, binary.update, 'provider')
    })
    await providerB.connect()
    const runtimeB = new CollaborationDurabilityRuntime({
      document: documentB,
      documentId: 'document-a',
      provider: providerB
    })

    const firstSync = await runtimeB.synchronizeWithProvider()

    expect(firstSync.receivedOperationCount).toBe(1)
    expect(readOperationLog(documentA)).toEqual(readOperationLog(documentB))
    expect(
      new Set(readOperationLog(documentB).map((item) => item.operationId))
    ).toEqual(
      new Set([
        'actor-a:session:1:forward',
        'actor-b:session:1:forward'
      ])
    )

    const secondSync = await runtimeB.synchronizeWithProvider()
    expect(secondSync.receivedOperationCount).toBe(0)
    expect(secondSync.sentUpdateByteLength).toBeLessThanOrEqual(2)
    expect(readOperationLog(documentA)).toEqual(readOperationLog(documentB))
  })
})
