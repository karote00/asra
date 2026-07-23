import { describe, expect, it, vi } from 'vitest'
import { createDocumentCollaborationFactory } from '../../collaboration/factory-adapter'

describe('Asyra Design collaboration composition', () => {
  it('forwards only app-owned document channels', () => {
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
    expect('runRemoteTransaction' in filtered).toBe(false)
    expect('isRemoteAsyncHandlerError' in filtered).toBe(false)
  })
})
