import React, { StrictMode, act } from 'react'
import { createRoot } from 'react-dom/client'
import { providers } from '@asyra/reactive-events'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import core from '../../contexts'
import * as collaborationLifecycle from '../../collaboration/lifecycle'
import RenderApp from '../index'

const COLLABORATION_ENDPOINT = 'ws://127.0.0.1:4101/asyra-design-collaboration'
const ACTOR_UUID = '12345678-1234-4123-8123-123456789abc'
const EMPTY_DOCUMENT = {
  version: '1.0.0',
  sceneTree: { workspace: '', workspaceList: [], elements: {} },
  props: {}
} as const
const collaborationHandle = {
  identity: Object.freeze({
    documentId: 'file-1',
    roomId: 'file-1',
    actorId: `actor-${ACTOR_UUID}`
  }),
  getStatus: () => 'connected' as const,
  disconnect: async () => undefined,
  reconnect: async () => undefined,
  whenIdle: async () => undefined,
  dispose: async () => undefined
} satisfies NonNullable<Window['__AsyraCollaboration__']>

const setReactActEnvironment = (active: boolean) => {
  ;(
    globalThis as typeof globalThis & {
      IS_REACT_ACT_ENVIRONMENT: boolean
    }
  ).IS_REACT_ACT_ENVIRONMENT = active
}

describe('RenderApp StrictMode lifecycle', () => {
  beforeEach(async () => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
    window.history.replaceState({}, '', '/')
    localStorage.clear()
    await providers.memory.clear()

    vi.spyOn(core, 'setPersistence').mockImplementation(() => undefined)
    vi.spyOn(core, 'start').mockResolvedValue(undefined)
    vi.spyOn(core, 'destroyRenderer').mockImplementation(() => undefined)
    vi.spyOn(providers.memory, 'save')
    vi.spyOn(collaborationLifecycle, 'startCollaboration').mockResolvedValue(
      collaborationHandle
    )
    vi.spyOn(collaborationLifecycle, 'disposeCollaboration').mockResolvedValue(
      undefined
    )
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(ACTOR_UUID)

    document.body.replaceChildren()
    setReactActEnvironment(true)
  })

  afterEach(async () => {
    document.body.replaceChildren()
    setReactActEnvironment(false)
    window.history.replaceState({}, '', '/')
    localStorage.clear()
    await providers.memory.clear()
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('starts only the live Core lifetime and delegates StrictMode teardown', async () => {
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)

    await act(async () => {
      root.render(
        <StrictMode>
          <RenderApp />
        </StrictMode>
      )
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(core.destroyRenderer).toHaveBeenCalledTimes(1)
    expect(core.setPersistence).toHaveBeenCalledWith(providers.localStorage)
    expect(core.start).toHaveBeenCalledTimes(1)
    expect(core.start).toHaveBeenCalledWith(
      expect.any(HTMLDivElement),
      expect.objectContaining({
        width: window.innerWidth,
        height: window.innerHeight
      })
    )

    await act(async () => {
      root.unmount()
    })

    expect(core.destroyRenderer).toHaveBeenCalledTimes(2)
  })

  it('initializes an absent localStorage document before collaboration starts', async () => {
    vi.stubEnv('VITE_ASYRA_DESIGN_COLLABORATION_WS_URL', COLLABORATION_ENDPOINT)
    window.history.replaceState({}, '', '/?fileId=file-1')
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)

    await act(async () => {
      root.render(
        <StrictMode>
          <RenderApp />
        </StrictMode>
      )
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(providers.memory.save).not.toHaveBeenCalled()
    expect(localStorage.getItem('FILE:file-1')).toBe(
      JSON.stringify(EMPTY_DOCUMENT)
    )
    expect(localStorage.getItem('FILE')).toBeNull()
    expect(vi.mocked(core.setPersistence).mock.calls[0]?.[0]).not.toBe(
      providers.localStorage
    )
    expect(core.setPersistence).not.toHaveBeenCalledWith(providers.memory)
    expect(collaborationLifecycle.startCollaboration).toHaveBeenCalledWith({
      fileId: 'file-1',
      actorId: `actor-${ACTOR_UUID}`,
      endpoint: COLLABORATION_ENDPOINT
    })

    await act(async () => root.unmount())
    expect(collaborationLifecycle.disposeCollaboration).toHaveBeenCalledTimes(1)
  })

  it('preserves an existing localStorage document when collaboration starts', async () => {
    vi.stubEnv('VITE_ASYRA_DESIGN_COLLABORATION_WS_URL', COLLABORATION_ENDPOINT)
    window.history.replaceState({}, '', '/?fileId=file-1')
    const existingDocument = {
      version: '1.0.0',
      sceneTree: {
        workspace: 'workspace-1',
        workspaceList: ['workspace-1'],
        elements: {}
      },
      props: {}
    }
    localStorage.setItem('FILE:file-1', JSON.stringify(existingDocument))
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)

    await act(async () => {
      root.render(<RenderApp />)
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(JSON.parse(localStorage.getItem('FILE:file-1') ?? '')).toEqual(
      existingDocument
    )
    expect(localStorage.getItem('FILE')).toBeNull()
    expect(vi.mocked(core.setPersistence).mock.calls[0]?.[0]).not.toBe(
      providers.localStorage
    )
    expect(collaborationLifecycle.startCollaboration).toHaveBeenCalledTimes(1)

    await act(async () => root.unmount())
  })

  it('does not activate collaboration after unmount aborts startup', async () => {
    vi.stubEnv('VITE_ASYRA_DESIGN_COLLABORATION_WS_URL', COLLABORATION_ENDPOINT)
    window.history.replaceState({}, '', '/?fileId=file-aborted')
    let finishCoreStart: (() => void) | undefined
    vi.mocked(core.start).mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishCoreStart = resolve
        })
    )
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)

    await act(async () => {
      root.render(<RenderApp />)
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(core.start).toHaveBeenCalledTimes(1)

    await act(async () => root.unmount())
    await act(async () => {
      finishCoreStart?.()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(collaborationLifecycle.startCollaboration).not.toHaveBeenCalled()
  })
})
