import { describe, expect, it } from 'vitest'
import {
  createCollaboratingCounter,
  createMemoryCollaborationServer
} from '../../../../docs/examples/yjs-network-collaboration.mjs'

describe('Yjs collaboration documentation example', () => {
  it('connects two explicit clients, converges canonical state, and projects awareness', async () => {
    const hub = createMemoryCollaborationServer()
    const first = await createCollaboratingCounter({
      hub,
      documentId: 'document-a',
      roomId: 'room-a',
      actorId: 'actor-a'
    })
    const second = await createCollaboratingCounter({
      hub,
      documentId: 'document-a',
      roomId: 'room-a',
      actorId: 'actor-b'
    })

    first.setValue(7)
    await first.collaboration.whenIdle()
    await second.collaboration.whenIdle()
    await first.updatePresence({ tool: 'select' })
    await second.collaboration.whenIdle()

    expect(second.getValue()).toBe(7)
    expect(second.remotePresence.get('actor-a')).toEqual(
      expect.objectContaining({ tool: 'select' })
    )

    await first.dispose()
    await second.dispose()
  })
})
