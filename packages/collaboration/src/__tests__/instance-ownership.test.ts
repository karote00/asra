import * as Y from 'yjs'
import { describe, expect, it, vi } from 'vitest'
import {
  AwarenessRuntime,
  CollaborationDisposalError,
  createCollaboration,
  type CollaborationInstanceCompositionInput
} from '..'

const createFactory = () => ({
  subscribeToSharedDelivery: vi.fn(() => () => undefined)
})

const input = (
  overrides: Partial<CollaborationInstanceCompositionInput> = {}
): CollaborationInstanceCompositionInput => ({
  documentId: 'document-a',
  roomId: 'room-a',
  actorId: 'actor-a',
  factory: createFactory(),
  operationDefinitions: [],
  permissionPolicy: () => true,
  ...overrides
})

describe('CollaborationInstance ownership and disposal', () => {
  it('creates isolated Y.Doc and awareness resources only for explicit instances', () => {
    const first = createCollaboration(input())
    const second = createCollaboration(
      input({ documentId: 'document-b', roomId: 'room-b', actorId: 'actor-b' })
    )

    expect(first.yDoc).toBeInstanceOf(Y.Doc)
    expect(second.yDoc).toBeInstanceOf(Y.Doc)
    expect(first.yDoc).not.toBe(second.yDoc)
    expect(first.awareness).toBeInstanceOf(AwarenessRuntime)
    expect(first.awareness).not.toBe(second.awareness)
    expect(first.provider).toBeUndefined()
    expect(first.identity).toEqual({
      documentId: 'document-a',
      roomId: 'room-a',
      actorId: 'actor-a'
    })
  })

  it('receives intentional shared wiring without creating fallback resources', () => {
    const sharedDoc = new Y.Doc()
    const sharedAwareness = new AwarenessRuntime()
    const factory = createFactory()
    const first = createCollaboration(
      input({ factory, yDoc: sharedDoc, awareness: sharedAwareness })
    )
    const second = createCollaboration(
      input({
        factory,
        documentId: 'document-a',
        actorId: 'actor-b',
        yDoc: sharedDoc,
        awareness: sharedAwareness
      })
    )

    expect(first.yDoc).toBe(sharedDoc)
    expect(second.yDoc).toBe(sharedDoc)
    expect(first.awareness).toBe(sharedAwareness)
    expect(second.awareness).toBe(sharedAwareness)
    expect(first.factory).toBe(factory)
    expect(second.factory).toBe(factory)
  })

  it('does not connect an injected provider during construction', () => {
    const provider = { connect: vi.fn(), destroy: vi.fn() }
    const instance = createCollaboration(input({ provider }))

    expect(instance.provider).toBe(provider)
    expect(provider.connect).not.toHaveBeenCalled()
  })

  it('destroys owned resources once and detaches all instance disposers', async () => {
    const yDoc = new Y.Doc()
    const awareness = new AwarenessRuntime()
    const provider = { destroy: vi.fn() }
    const persistence = { dispose: vi.fn() }
    const destroyDoc = vi.fn()
    const disposeAwareness = vi.fn()
    yDoc.destroy = destroyDoc
    awareness.dispose = disposeAwareness
    const instance = createCollaboration(
      input({
        yDoc,
        awareness,
        provider,
        persistence,
        resourceOwnership: {
          yDoc: 'owned',
          awareness: 'owned',
          provider: 'owned',
          persistence: 'owned'
        }
      })
    )
    const detachFirst = vi.fn()
    const detachSecond = vi.fn()
    instance.ownDisposer(detachFirst)
    instance.ownDisposer(detachSecond)

    await instance.dispose()
    await instance.dispose()

    expect(detachSecond).toHaveBeenCalledTimes(1)
    expect(detachFirst).toHaveBeenCalledTimes(1)
    expect(provider.destroy).toHaveBeenCalledTimes(1)
    expect(persistence.dispose).toHaveBeenCalledTimes(1)
    expect(disposeAwareness).toHaveBeenCalledTimes(1)
    expect(destroyDoc).toHaveBeenCalledTimes(1)
    expect(instance.isDisposed()).toBe(true)
  })

  it('does not destroy borrowed resources or affect another shared instance', async () => {
    const sharedDoc = new Y.Doc()
    const sharedAwareness = new AwarenessRuntime()
    const provider = { destroy: vi.fn() }
    const persistence = { dispose: vi.fn() }
    const destroyDoc = vi.fn()
    const disposeAwareness = vi.fn()
    sharedDoc.destroy = destroyDoc
    sharedAwareness.dispose = disposeAwareness
    const first = createCollaboration(
      input({
        yDoc: sharedDoc,
        awareness: sharedAwareness,
        provider,
        persistence
      })
    )
    const second = createCollaboration(
      input({
        actorId: 'actor-b',
        yDoc: sharedDoc,
        awareness: sharedAwareness,
        provider,
        persistence
      })
    )

    await first.dispose()
    sharedDoc.getMap('still-alive').set('value', 1)

    expect(destroyDoc).not.toHaveBeenCalled()
    expect(disposeAwareness).not.toHaveBeenCalled()
    expect(provider.destroy).not.toHaveBeenCalled()
    expect(persistence.dispose).not.toHaveBeenCalled()
    expect(second.yDoc.getMap('still-alive').get('value')).toBe(1)
    expect(second.isDisposed()).toBe(false)
  })

  it('attempts every cleanup and reports one aggregate disposal failure', async () => {
    const firstFailure = new Error('provider destroy failed')
    const secondFailure = new Error('awareness dispose failed')
    const yDoc = new Y.Doc()
    const destroyDoc = vi.fn()
    yDoc.destroy = destroyDoc
    const instance = createCollaboration(
      input({
        yDoc,
        provider: {
          destroy: vi.fn(() => {
            throw firstFailure
          })
        },
        awareness: {
          dispose: vi.fn(() => {
            throw secondFailure
          })
        },
        resourceOwnership: {
          provider: 'owned',
          awareness: 'owned',
          yDoc: 'owned'
        }
      })
    )
    const detached = vi.fn()
    instance.ownDisposer(detached)

    const rejection = await instance.dispose().catch((error) => error)

    expect(rejection).toBeInstanceOf(CollaborationDisposalError)
    expect(rejection.failures).toEqual([firstFailure, secondFailure])
    expect(detached).toHaveBeenCalledTimes(1)
    expect(destroyDoc).toHaveBeenCalledTimes(1)
    expect(instance.isDisposed()).toBe(true)
  })
})
