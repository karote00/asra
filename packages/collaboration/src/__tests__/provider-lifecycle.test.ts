import { describe, expect, it, vi } from 'vitest'
import { ProviderFailure } from '../provider'
import {
  MemoryCollaborationHub,
  MemoryCollaborationProvider
} from '../providers/memory-provider'

const identity = {
  documentId: 'document-a',
  roomId: 'room-a',
  actorId: 'actor-a',
  connectionMetadata: { accessToken: 'secret-token' }
}

describe('collaboration provider lifecycle', () => {
  it('does not connect during construction and exposes ordered lifecycle status', async () => {
    const authorizeConnection = vi.fn(() => true)
    const hub = new MemoryCollaborationHub({ authorizeConnection })
    const provider = new MemoryCollaborationProvider(hub, identity)
    const statuses: string[] = []
    provider.onStatusChange((status) => statuses.push(status))

    expect(provider.getStatus()).toBe('idle')
    expect(authorizeConnection).not.toHaveBeenCalled()
    await provider.connect()
    await provider.disconnect()
    await provider.reconnect()

    expect(statuses).toEqual([
      'connecting',
      'connected',
      'disconnected',
      'connecting',
      'connected'
    ])
    expect(authorizeConnection).toHaveBeenCalledWith(identity)
  })

  it('owns connection failure reporting without mutating any product owner', async () => {
    const hub = new MemoryCollaborationHub({
      authorizeConnection: () => false
    })
    const provider = new MemoryCollaborationProvider(hub, identity)
    const failures = vi.fn()
    provider.onFailure(failures)

    await expect(provider.connect()).rejects.toEqual(
      expect.objectContaining<Partial<ProviderFailure>>({
        code: 'connection-rejected'
      })
    )
    expect(provider.getStatus()).toBe('failed')
    expect(failures).toHaveBeenCalledTimes(1)
  })

  it('rejects transport while disconnected and resumes after reconnect', async () => {
    const hub = new MemoryCollaborationHub()
    const provider = new MemoryCollaborationProvider(hub, identity)

    await expect(
      provider.sendUpdate({
        operationId: 'operation-a',
        update: new Uint8Array()
      })
    ).rejects.toEqual(
      expect.objectContaining<Partial<ProviderFailure>>({
        code: 'not-connected'
      })
    )
    await provider.connect()
    await provider.disconnect()
    await provider.reconnect()
    await expect(
      provider.sendUpdate({
        operationId: 'operation-a',
        update: new Uint8Array()
      })
    ).resolves.toBeUndefined()
  })

  it('disposes idempotently, detaches observers, and prevents reuse', async () => {
    const hub = new MemoryCollaborationHub()
    const provider = new MemoryCollaborationProvider(hub, identity)
    const statuses = vi.fn()
    provider.onStatusChange(statuses)
    await provider.connect()

    await provider.destroy()
    await provider.destroy()

    expect(provider.getStatus()).toBe('disposed')
    expect(statuses).toHaveBeenCalledWith('disposed')
    await expect(provider.connect()).rejects.toEqual(
      expect.objectContaining<Partial<ProviderFailure>>({ code: 'disposed' })
    )
    expect(statuses).toHaveBeenCalledTimes(3)
  })
})
