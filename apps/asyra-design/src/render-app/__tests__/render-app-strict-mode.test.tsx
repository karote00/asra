import React, { StrictMode, act } from 'react'
import { createRoot } from 'react-dom/client'
import { providers } from '@asyra/reactive-events'
import { ProviderFailure, type ProviderStatus } from '@asyra/collaboration'
import { gzipSync } from 'node:zlib'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import core from '../../contexts'
import * as collaborationLifecycle from '../../collaboration/lifecycle'
import type { CollaborationDebugHandle } from '../../collaboration/lifecycle'
import RenderApp from '../index'

const COLLABORATION_ENDPOINT = 'ws://127.0.0.1:4101/collaboration'
const ACTOR_UUID = '12345678-1234-4123-8123-123456789abc'
const EMPTY_DOCUMENT = {
  version: '1.0.0',
  sceneTree: { workspace: '', workspaceList: [], elements: {} },
  props: {}
} as const
const SAMPLE_DOCUMENT = {
  version: '1.0.0',
  sceneTree: {
    workspace: 'sample-workspace',
    workspaceList: ['sample-workspace'],
    elements: {}
  },
  props: {}
} as const
let collaborationStatusSubscriber:
  | ((status: ProviderStatus) => void)
  | undefined
const collaborationHandle = {
  identity: Object.freeze({
    documentId: 'file-1',
    roomId: 'file-1',
    actorId: `actor-${ACTOR_UUID}`
  }),
  getStatus: () => 'connected' as const,
  onStatusChange: (subscriber: (status: ProviderStatus) => void) => {
    collaborationStatusSubscriber = subscriber
    return () => {
      collaborationStatusSubscriber = undefined
    }
  },
  disconnect: async () => undefined,
  reconnect: async () => undefined,
  whenIdle: async () => undefined,
  observePublicationOutcomes: () => () => undefined,
  dispose: async () => undefined
} satisfies CollaborationDebugHandle

const setReactActEnvironment = (active: boolean) => {
  ;(
    globalThis as typeof globalThis & {
      IS_REACT_ACT_ENVIRONMENT: boolean
    }
  ).IS_REACT_ACT_ENVIRONMENT = active
}

describe('RenderApp StrictMode lifecycle', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
    vi.stubEnv('VITE_COLLABORATION_WS_URL', COLLABORATION_ENDPOINT)
    window.history.replaceState({}, '', '/?fileId=file-1')
    localStorage.clear()

    vi.spyOn(core, 'setPersistence').mockImplementation(() => undefined)
    vi.spyOn(core, 'load').mockImplementation(() => undefined)
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
    collaborationStatusSubscriber = undefined

    document.body.replaceChildren()
    setReactActEnvironment(true)
  })

  afterEach(() => {
    document.body.replaceChildren()
    setReactActEnvironment(false)
    window.history.replaceState({}, '', '/')
    localStorage.clear()
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('starts one live Core and Collaboration lifetime and delegates StrictMode teardown', async () => {
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

    await vi.waitFor(() =>
      expect(collaborationLifecycle.startCollaboration).toHaveBeenCalledTimes(1)
    )
    expect(core.setPersistence).toHaveBeenCalledOnce()
    expect(core.destroyRenderer).toHaveBeenCalledTimes(1)
    expect(core.start).toHaveBeenCalledTimes(1)
    expect(core.start).toHaveBeenCalledWith(
      expect.any(HTMLDivElement),
      expect.objectContaining({
        width: window.innerWidth,
        height: window.innerHeight
      })
    )
    expect(
      vi.mocked(core.setPersistence).mock.invocationCallOrder[0]
    ).toBeLessThan(vi.mocked(core.start).mock.invocationCallOrder[0] ?? 0)
    expect(vi.mocked(core.start).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(collaborationLifecycle.startCollaboration).mock
        .invocationCallOrder[0] ?? 0
    )
    expect(core.load).not.toHaveBeenCalled()

    await act(async () => {
      root.unmount()
    })

    expect(core.destroyRenderer).toHaveBeenCalledTimes(2)
  })

  it('injects the selected file provider before Core and always starts Collaboration after Core', async () => {
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)

    await act(async () => {
      root.render(<RenderApp />)
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    await vi.waitFor(() =>
      expect(collaborationLifecycle.startCollaboration).toHaveBeenCalledTimes(1)
    )
    expect(core.setPersistence).toHaveBeenCalledOnce()
    expect(localStorage.getItem('FILE')).toBeNull()
    expect(core.start).toHaveBeenCalledTimes(1)
    expect(
      vi.mocked(core.setPersistence).mock.invocationCallOrder[0]
    ).toBeLessThan(vi.mocked(core.start).mock.invocationCallOrder[0] ?? 0)
    expect(vi.mocked(core.start).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(collaborationLifecycle.startCollaboration).mock
        .invocationCallOrder[0] ?? 0
    )
    expect(core.load).not.toHaveBeenCalled()

    await act(async () => root.unmount())
  })

  it('creates an independent empty document for every startup lifetime', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('document database unavailable')
      })
    )
    const firstHost = document.createElement('div')
    document.body.append(firstHost)
    const firstRoot = createRoot(firstHost)

    await act(async () => {
      firstRoot.render(<RenderApp />)
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })
    await vi.waitFor(() => expect(core.setPersistence).toHaveBeenCalledTimes(1))
    await act(async () => firstRoot.unmount())

    const secondHost = document.createElement('div')
    document.body.append(secondHost)
    const secondRoot = createRoot(secondHost)
    await act(async () => {
      secondRoot.render(<RenderApp />)
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })
    await vi.waitFor(() => expect(core.setPersistence).toHaveBeenCalledTimes(2))

    const firstProvider = vi.mocked(core.setPersistence).mock.calls[0]?.[0]
    const secondProvider = vi.mocked(core.setPersistence).mock.calls[1]?.[0]
    let firstDocument: unknown
    let secondDocument: unknown
    await act(async () => {
      firstDocument = await firstProvider?.load()
      secondDocument = await secondProvider?.load()
    })
    expect(firstDocument).toEqual(EMPTY_DOCUMENT)
    expect(secondDocument).toEqual(EMPTY_DOCUMENT)
    expect(firstDocument).not.toBe(secondDocument)
    expect(firstDocument?.sceneTree).not.toBe(secondDocument?.sceneTree)
    expect(firstDocument?.props).not.toBe(secondDocument?.props)

    await act(async () => secondRoot.unmount())
  })

  it('does not open a document when fileId is missing', async () => {
    window.history.replaceState({}, '', '/')
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)

    await act(async () => {
      root.render(<RenderApp />)
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    await vi.waitFor(() =>
      expect(consoleError).toHaveBeenCalledWith(
        '[RenderApp] Render startup failed:',
        expect.objectContaining({
          message: '[collaboration] missing required fileId'
        })
      )
    )
    expect(core.start).not.toHaveBeenCalled()
    expect(core.load).not.toHaveBeenCalled()
    expect(collaborationLifecycle.startCollaboration).not.toHaveBeenCalled()

    await act(async () => root.unmount())
  })

  it('loads the bundled demo after database failure without starting CRDT or crashing the App', async () => {
    vi.stubEnv('VITE_COLLABORATION_WS_URL', '')
    window.history.replaceState({}, '', '/?fileId=crdt-7076-sample')
    const fetch = vi.fn(async (input: string) => {
      if (input.startsWith('/api/documents/')) {
        throw new Error('database unavailable')
      }
      return new Response(gzipSync(JSON.stringify(SAMPLE_DOCUMENT)), {
        status: 200
      })
    })
    vi.stubGlobal('fetch', fetch)
    let loadedDocument: unknown
    vi.mocked(core.start).mockImplementationOnce(async () => {
      const provider = vi.mocked(core.setPersistence).mock.calls[0]?.[0]
      loadedDocument = await provider?.load()
    })
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)

    await act(async () => {
      root.render(<RenderApp />)
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    await vi.waitFor(() =>
      expect(host.querySelector('[role="alert"]')?.textContent).toBe(
        'Document database is unavailable. You can keep using the app, but changes cannot be saved.'
      )
    )
    expect(loadedDocument).toEqual(SAMPLE_DOCUMENT)
    expect(core.start).toHaveBeenCalledOnce()
    expect(collaborationLifecycle.startCollaboration).not.toHaveBeenCalled()

    await act(async () => root.unmount())
  })

  it('starts the local CRDT sample from an empty document when the database is unavailable', async () => {
    window.history.replaceState({}, '', '/?fileId=crdt-7076-sample')
    const fetch = vi.fn(async () => {
      throw new Error('database unavailable')
    })
    vi.stubGlobal('fetch', fetch)
    let loadedDocument: unknown
    vi.mocked(core.start).mockImplementationOnce(async () => {
      const provider = vi.mocked(core.setPersistence).mock.calls[0]?.[0]
      loadedDocument = await provider?.load()
    })
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)

    await act(async () => {
      root.render(<RenderApp />)
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    await vi.waitFor(() =>
      expect(collaborationLifecycle.startCollaboration).toHaveBeenCalledOnce()
    )
    expect(loadedDocument).toEqual(EMPTY_DOCUMENT)
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(host.querySelector('[role="alert"]')?.textContent).toBe(
      'Document database is unavailable. You can keep using the app, but changes cannot be saved.'
    )

    await act(async () => root.unmount())
  })

  it('starts collaboration with one file-scoped document provider', async () => {
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

    await vi.waitFor(() =>
      expect(collaborationLifecycle.startCollaboration).toHaveBeenCalledTimes(1)
    )
    expect(core.setPersistence).toHaveBeenCalledOnce()
    expect(core.load).not.toHaveBeenCalled()
    expect(
      vi.mocked(core.setPersistence).mock.invocationCallOrder[0]
    ).toBeLessThan(vi.mocked(core.start).mock.invocationCallOrder[0] ?? 0)
    expect(vi.mocked(core.start).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(collaborationLifecycle.startCollaboration).mock
        .invocationCallOrder[0] ?? 0
    )
    expect(providers.memory.save).not.toHaveBeenCalled()
    expect(localStorage.getItem('FILE:file-1')).toBeNull()
    expect(localStorage.getItem('FILE')).toBeNull()
    expect(collaborationLifecycle.startCollaboration).toHaveBeenCalledWith({
      fileId: 'file-1',
      actorId: `actor-${ACTOR_UUID}`,
      endpoint: COLLABORATION_ENDPOINT
    })

    await act(async () => root.unmount())
    expect(collaborationLifecycle.disposeCollaboration).toHaveBeenCalledTimes(1)
  })

  it('leaves collaboration legacy storage untouched during startup', async () => {
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

    await vi.waitFor(() =>
      expect(collaborationLifecycle.startCollaboration).toHaveBeenCalledTimes(1)
    )
    expect(core.setPersistence).toHaveBeenCalledOnce()
    expect(core.load).not.toHaveBeenCalled()
    expect(JSON.parse(localStorage.getItem('FILE:file-1') ?? '')).toEqual(
      existingDocument
    )
    expect(localStorage.getItem('FILE')).toBeNull()
    expect(collaborationLifecycle.startCollaboration).toHaveBeenCalledTimes(1)

    await act(async () => root.unmount())
  })

  it('does not activate collaboration after unmount aborts startup', async () => {
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
    await vi.waitFor(() => expect(core.start).toHaveBeenCalledTimes(1))

    await act(async () => root.unmount())
    await act(async () => {
      finishCoreStart?.()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(collaborationLifecycle.startCollaboration).not.toHaveBeenCalled()
  })

  it('keeps the App running and reports an initial collaboration connection failure', async () => {
    vi.mocked(collaborationLifecycle.startCollaboration).mockRejectedValueOnce(
      new ProviderFailure('connection-failed', 'socket server unavailable')
    )
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)

    await act(async () => {
      root.render(<RenderApp />)
      await Promise.resolve()
      await Promise.resolve()
    })

    await vi.waitFor(() =>
      expect(host.querySelector('[role="alert"]')?.textContent).toBe(
        'Collaboration server is unavailable. You can keep using the app, but this tab will not receive remote changes.'
      )
    )
    expect(core.start).toHaveBeenCalledOnce()
    expect(core.destroyRenderer).not.toHaveBeenCalled()

    await act(async () => root.unmount())
  })

  it('does not disguise an unexpected collaboration composition error as a server disconnect', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    vi.mocked(collaborationLifecycle.startCollaboration).mockRejectedValueOnce(
      new Error('collaboration composition failed')
    )
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)

    await act(async () => {
      root.render(<RenderApp />)
      await Promise.resolve()
      await Promise.resolve()
    })

    await vi.waitFor(() =>
      expect(consoleError).toHaveBeenCalledWith(
        '[RenderApp] Render startup failed:',
        expect.objectContaining({
          message: 'collaboration composition failed'
        })
      )
    )
    expect(host.querySelector('[role="alert"]')).toBeNull()

    await act(async () => root.unmount())
  })

  it('keeps the App running and reports a collaboration disconnect after startup', async () => {
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)

    await act(async () => {
      root.render(<RenderApp />)
      await Promise.resolve()
      await Promise.resolve()
    })
    await vi.waitFor(() =>
      expect(collaborationLifecycle.startCollaboration).toHaveBeenCalledOnce()
    )

    await act(async () => {
      collaborationStatusSubscriber?.('disconnected')
    })

    expect(host.querySelector('[role="alert"]')?.textContent).toBe(
      'Collaboration server is unavailable. You can keep using the app, but this tab will not receive remote changes.'
    )
    expect(core.start).toHaveBeenCalledOnce()
    expect(core.destroyRenderer).not.toHaveBeenCalled()

    await act(async () => root.unmount())
  })
})
