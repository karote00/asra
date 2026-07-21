import { afterEach, describe, expect, it, vi } from 'vitest'
import { getCollaborationMode } from '../collaboration-mode'

const ACTOR_UUID = '12345678-1234-4123-8123-123456789abc'

describe('collaboration public file identity', () => {
  afterEach(() => {
    window.history.replaceState({}, '', '/')
    vi.restoreAllMocks()
  })

  it('activates from one public fileId and generates the page actor', () => {
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(ACTOR_UUID)
    window.history.replaceState({}, '', '/?fileId=public-crdt-file')

    const mode = getCollaborationMode()
    expect(mode).toMatchObject({
      fileId: 'public-crdt-file',
      actorId: `actor-${ACTOR_UUID}`,
      endpoint: 'ws://127.0.0.1:4101/asyra-design-collaboration'
    })
    expect(mode).not.toHaveProperty('documentId')
    expect(mode).not.toHaveProperty('roomId')
    expect(mode).not.toHaveProperty('accessToken')
  })

  it('does not activate from legacy document, room, or actor parameters', () => {
    window.history.replaceState(
      {},
      '',
      '/?collaboration=1&document=legacy&room=legacy&actor=legacy-a'
    )

    expect(getCollaborationMode()).toBeUndefined()
  })

  it('keeps an ordinary URL collaboration-free', () => {
    expect(getCollaborationMode()).toBeUndefined()
  })
})
