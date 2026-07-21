import { describe, expect, it, vi } from 'vitest'
import { createDocumentCollaborationFactory } from '../../collaboration/factory-adapter'

describe('Asyra Design collaboration composition', () => {
  it('forwards only document channels and binds the intended Factory owner', () => {
    let publicationSubscriber:
      | ((publication: {
          publicationId: string
          deliveries: { channel: string }[]
        }) => void)
      | undefined
    const owner = {
      subscribeToSharedPublication: vi.fn((subscriber) => {
        publicationSubscriber = subscriber
        return () => undefined
      }),
      runRemoteTransaction: vi.fn(function (this: unknown) {
        return this
      }),
      isRemoteAsyncHandlerError: vi.fn(function (this: unknown) {
        return this
      })
    }
    const filtered = createDocumentCollaborationFactory(owner as never)
    const received = vi.fn()

    filtered.subscribeToSharedPublication(received as never)
    publicationSubscriber?.({
      publicationId: 'selection-only',
      deliveries: [{ channel: 'selection' }]
    })
    publicationSubscriber?.({
      publicationId: 'mixed-action',
      deliveries: [
        { channel: 'selection' },
        { channel: 'sceneTree' },
        { channel: 'props' }
      ]
    })

    expect(received).toHaveBeenCalledTimes(1)
    expect(received).toHaveBeenCalledWith({
      publicationId: 'mixed-action',
      deliveries: [{ channel: 'sceneTree' }, { channel: 'props' }]
    })
    expect(filtered.runRemoteTransaction?.(() => undefined)).toBe(owner)
    expect(filtered.isRemoteAsyncHandlerError?.(new Error('test'))).toBe(owner)
  })
})
