import { afterEach, describe, expect, it, vi } from 'vitest'
import { getCollaborationMode } from '../collaboration-mode'

const ACTOR_UUID = '12345678-1234-4123-8123-123456789abc'
const COLLABORATION_ENDPOINT = 'ws://127.0.0.1:4101/asyra-design-collaboration'

describe('collaboration public file identity', () => {
  afterEach(() => {
    window.history.replaceState({}, '', '/')
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('requires one public fileId and always prepares the page collaboration identity', () => {
    vi.stubEnv('VITE_ASYRA_DESIGN_COLLABORATION_WS_URL', COLLABORATION_ENDPOINT)
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(ACTOR_UUID)
    window.history.replaceState({}, '', '/?fileId=public-crdt-file')

    const mode = getCollaborationMode()
    expect(mode).toMatchObject({
      fileId: 'public-crdt-file',
      actorId: `actor-${ACTOR_UUID}`,
      endpoint: COLLABORATION_ENDPOINT
    })
    expect(mode).not.toHaveProperty('documentId')
    expect(mode).not.toHaveProperty('roomId')
    expect(mode).not.toHaveProperty('accessToken')
  })

  it('uses fileId as document identity rather than a collaboration toggle', () => {
    vi.stubEnv('VITE_ASYRA_DESIGN_COLLABORATION_WS_URL', COLLABORATION_ENDPOINT)
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(ACTOR_UUID)
    window.history.replaceState(
      {},
      '',
      '/?fileId=public-crdt-file&collaboration=0&document=legacy&room=legacy&actor=legacy-a'
    )

    expect(getCollaborationMode()).toMatchObject({
      fileId: 'public-crdt-file',
      actorId: `actor-${ACTOR_UUID}`,
      endpoint: COLLABORATION_ENDPOINT
    })
  })

  it('rejects a URL that cannot identify the document', () => {
    expect(() => getCollaborationMode()).toThrow(
      '[collaboration] missing required fileId'
    )
    window.history.replaceState({}, '', '/?fileId=%20%20')
    expect(() => getCollaborationMode()).toThrow(
      '[collaboration] missing required fileId'
    )
  })
})
