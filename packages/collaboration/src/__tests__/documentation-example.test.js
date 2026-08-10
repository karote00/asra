import fs from 'node:fs'
import { URL } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  createCollaboratingCounter,
  createMemoryHub,
  exampleDefinition
} from '../../../../docs/examples/network-collaboration-transport.mjs'

describe('network collaboration documentation example', () => {
  it('declares the supported workspace example runner', () => {
    const manifest = JSON.parse(
      fs.readFileSync(new URL('../../package.json', import.meta.url), 'utf8')
    )

    expect(manifest.scripts?.['example:collaboration']).toBe(
      'vitest run src/__tests__/documentation-example.test.js'
    )
  })

  it('connects two explicit clients, converges canonical state, and projects awareness', async () => {
    expect(exampleDefinition.id).toBe('collaboration-two-memory-actors')
    const hub = createMemoryHub()
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
    const firstOutcomes = []
    const secondOutcomes = []
    first.collaboration.observePublicationOutcomes((outcome) =>
      firstOutcomes.push(outcome)
    )
    second.collaboration.observePublicationOutcomes((outcome) =>
      secondOutcomes.push(outcome)
    )

    first.setValue(7)
    await first.collaboration.whenIdle()
    await second.collaboration.whenIdle()
    await first.updatePresence({ tool: 'select' })
    await second.collaboration.whenIdle()

    expect(second.getValue()).toBe(7)
    expect(firstOutcomes).toEqual([
      expect.objectContaining({ direction: 'local', status: 'sent' })
    ])
    expect(secondOutcomes).toEqual([
      expect.objectContaining({ direction: 'remote', status: 'processed' })
    ])
    expect(second.remotePresence.get('actor-a')).toEqual(
      expect.objectContaining({ tool: 'select' })
    )

    await first.dispose()
    await second.dispose()
  })
})
