import { describe, expect, it, vi } from 'vitest'
import { createProviderIdentitySnapshot, ProviderFailure } from '../provider'
import { MemoryHub, MemoryProvider } from '../providers/memory'

const identity = {
  documentId: 'document-a',
  roomId: 'room-a',
  actorId: 'actor-a',
  connectionMetadata: { accessToken: 'secret-token' }
}

describe('collaboration provider lifecycle', () => {
  it('creates one immutable provider identity snapshot contract', () => {
    const snapshot = createProviderIdentitySnapshot(identity)

    expect(snapshot).toEqual(identity)
    expect(snapshot).not.toBe(identity)
    expect(Object.isFrozen(snapshot)).toBe(true)
    expect(Object.isFrozen(snapshot.connectionMetadata)).toBe(true)
  })

  it('does not connect during construction and exposes ordered lifecycle status', async () => {
    const authorizeConnection = vi.fn(() => true)
    const hub = new MemoryHub({ authorizeConnection })
    const provider = new MemoryProvider(hub, identity)
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
    const hub = new MemoryHub({
      authorizeConnection: () => false
    })
    const provider = new MemoryProvider(hub, identity)
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
    const hub = new MemoryHub()
    const provider = new MemoryProvider(hub, identity)

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
    const hub = new MemoryHub()
    const provider = new MemoryProvider(hub, identity)
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

  it('cannot revive or remain joined when authorization resolves after disposal', async () => {
    let resolveAuthorization: ((allowed: boolean) => void) | undefined
    const hub = new MemoryHub({
      authorizeConnection: () =>
        new Promise<boolean>((resolve) => {
          resolveAuthorization = resolve
        })
    })
    const provider = new MemoryProvider(hub, identity)
    const connection = provider.connect().catch((error) => error)
    await vi.waitFor(() => expect(provider.getStatus()).toBe('connecting'))

    await provider.destroy()
    resolveAuthorization?.(true)
    const outcome = await connection

    expect(outcome).toEqual(
      expect.objectContaining<Partial<ProviderFailure>>({ code: 'disposed' })
    )
    expect(provider.getStatus()).toBe('disposed')
  })

  it('cannot revive a connection after disconnect cancels pending authorization', async () => {
    let resolveAuthorization: ((allowed: boolean) => void) | undefined
    const hub = new MemoryHub({
      authorizeConnection: () =>
        new Promise<boolean>((resolve) => {
          resolveAuthorization = resolve
        })
    })
    const provider = new MemoryProvider(hub, identity)
    const connection = provider.connect().catch((error) => error)
    await vi.waitFor(() => expect(provider.getStatus()).toBe('connecting'))

    await provider.disconnect()
    resolveAuthorization?.(true)
    const outcome = await connection

    expect(outcome).toEqual(
      expect.objectContaining<Partial<ProviderFailure>>({
        code: 'not-connected'
      })
    )
    expect(provider.getStatus()).toBe('disconnected')
  })

  it('coalesces concurrent connect calls into one authorization and room join', async () => {
    let resolveAuthorization: ((allowed: boolean) => void) | undefined
    let authorizationCount = 0
    const authorizeConnection = () => {
      authorizationCount += 1
      return new Promise<boolean>((resolve) => {
        resolveAuthorization = resolve
      })
    }
    const hub = new MemoryHub({ authorizeConnection })
    const provider = new MemoryProvider(hub, identity)

    const first = provider.connect()
    const second = provider.connect()
    expect(authorizationCount).toBe(1)
    resolveAuthorization?.(true)
    await Promise.all([first, second])

    expect(provider.getStatus()).toBe('connected')
    await expect(
      provider.sendUpdate({
        operationId: 'empty-update',
        update: new Uint8Array()
      })
    ).resolves.toBeUndefined()
  })

  it('settles a pending connection immediately when destroyed', async () => {
    const hub = new MemoryHub({
      authorizeConnection: () => new Promise<boolean>(() => undefined)
    })
    const provider = new MemoryProvider(hub, identity)
    const connection = provider.connect().catch((error) => error)

    await provider.destroy()
    const outcome = await Promise.race([
      connection,
      new Promise<'still-pending'>((resolve) =>
        setTimeout(() => resolve('still-pending'), 25)
      )
    ])

    expect(outcome).toEqual(
      expect.objectContaining<Partial<ProviderFailure>>({ code: 'disposed' })
    )
  })
})
