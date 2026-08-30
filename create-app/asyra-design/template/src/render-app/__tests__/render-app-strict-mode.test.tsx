import React, { StrictMode, act } from 'react'
import { createRoot } from 'react-dom/client'
import type {
  CoreCollaborationBridge,
  CoreCollaborationSession
} from '@asyra/core'
import { providers } from '@asyra/reactive-events'
import type { ProviderStatus } from '@asyra/collaboration'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import core from '../../contexts'
import { documentInteractionLock } from '../../ai/document-interaction-lock'
import * as collaborationLifecycle from '../../collaboration/lifecycle'
import type {
  CollaborationDebugHandle,
  CollaborationSessionState
} from '../../collaboration/lifecycle'
import RenderApp from '../index'

const COLLABORATION_ENDPOINT = 'ws://127.0.0.1:4101/collaboration'
const ACTOR_UUID = '12345678-1234-4123-8123-123456789abc'
const EMPTY_DOCUMENT = {
  version: '1.0.0',
  sceneTree: { workspace: '', workspaceList: [], elements: {} },
  props: {}
} as const
let collaborationSessionState: CollaborationSessionState
let collaborationSessionStateSubscriber:
  ((state: CollaborationSessionState) => void) | undefined
const releaseInteractionLock = vi.fn()
const collaborationHandle = {
  identity: Object.freeze({
    documentId: 'file-1',
    roomId: 'file-1',
    actorId: `actor-${ACTOR_UUID}`
  }),
  getStatus: () => 'connected' as const,
  onStatusChange: (_subscriber: (status: ProviderStatus) => void) => () =>
    undefined,
  getSessionState: () => collaborationSessionState,
  onSessionStateChange: (
    subscriber: (state: CollaborationSessionState) => void
  ) => {
    collaborationSessionStateSubscriber = subscriber
    return () => {
      collaborationSessionStateSubscriber = undefined
    }
  },
  disconnect: async () => undefined,
  reconnect: async () => undefined,
  whenIdle: async () => undefined,
  observePublicationOutcomes: () => () => undefined,
  dispose: async () => undefined
} satisfies CollaborationDebugHandle
const coreCollaborationSession = {
  prepare: vi.fn(async (_bridge: CoreCollaborationBridge) => ({
    loadSource: {
      name: 'SocketDocumentSession',
      load: async () => EMPTY_DOCUMENT
    }
  })),
  activate: vi.fn(async () => undefined),
  dispose: vi.fn(async () => undefined)
} satisfies CoreCollaborationSession

const collaborationBridge = {
  applyRemoteCanonicalChangeSlices: vi.fn(async () => undefined),
  load: vi.fn(),
  subscribeToSharedPublication: vi.fn(() => () => undefined)
} satisfies CoreCollaborationBridge

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
    vi.spyOn(core, 'setLoadSource').mockImplementation(() => undefined)
    vi.spyOn(core, 'load').mockImplementation(() => undefined)
    vi.spyOn(core, 'registerCollaborationSession').mockImplementation(
      () => undefined
    )
    vi.spyOn(core, 'start').mockImplementation(async () => {
      await coreCollaborationSession.prepare(collaborationBridge)
      await coreCollaborationSession.activate()
    })
    vi.spyOn(core, 'destroy').mockResolvedValue(undefined)
    vi.spyOn(documentInteractionLock, 'acquire').mockReturnValue(
      releaseInteractionLock
    )
    vi.spyOn(providers.memory, 'save')
    vi.spyOn(
      collaborationLifecycle,
      'createCollaborationDocumentSession'
    ).mockReturnValue(coreCollaborationSession)
    vi.spyOn(
      collaborationLifecycle,
      'getActiveCollaborationHandle'
    ).mockImplementation(() =>
      coreCollaborationSession.activate.mock.calls.length > 0
        ? collaborationHandle
        : undefined
    )
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(ACTOR_UUID)
    collaborationSessionState = Object.freeze({
      connection: 'connected',
      sync: 'synced',
      pendingCount: 0,
      disconnectedEpoch: 0
    })
    collaborationSessionStateSubscriber = undefined
    releaseInteractionLock.mockClear()
    coreCollaborationSession.prepare.mockClear()
    coreCollaborationSession.activate.mockClear()
    coreCollaborationSession.dispose.mockClear()

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
      expect(
        collaborationLifecycle.createCollaborationDocumentSession
      ).toHaveBeenCalledTimes(1)
    )
    expect(core.registerCollaborationSession).toHaveBeenCalledOnce()
    expect(core.destroy).toHaveBeenCalledTimes(1)
    expect(core.start).toHaveBeenCalledTimes(1)
    expect(core.start).toHaveBeenCalledWith(
      expect.any(HTMLDivElement),
      expect.objectContaining({
        width: window.innerWidth,
        height: window.innerHeight
      })
    )
    expect(
      vi.mocked(core.registerCollaborationSession).mock.invocationCallOrder[0]
    ).toBeLessThan(vi.mocked(core.start).mock.invocationCallOrder[0] ?? 0)
    expect(vi.mocked(core.start).mock.invocationCallOrder[0]).toBeLessThan(
      coreCollaborationSession.activate.mock.invocationCallOrder[0] ?? 0
    )
    expect(core.load).not.toHaveBeenCalled()

    await act(async () => {
      root.unmount()
    })

    expect(core.destroy).toHaveBeenCalledTimes(2)
  })

  it('opens the socket document session before Core load and activates live delivery after Core hydration', async () => {
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
      expect(
        collaborationLifecycle.createCollaborationDocumentSession
      ).toHaveBeenCalledOnce()
    )
    expect(core.registerCollaborationSession).toHaveBeenCalledWith(
      coreCollaborationSession
    )
    expect(
      vi.mocked(collaborationLifecycle.createCollaborationDocumentSession).mock
        .invocationCallOrder[0]
    ).toBeLessThan(vi.mocked(core.start).mock.invocationCallOrder[0] ?? 0)
    expect(vi.mocked(core.start).mock.invocationCallOrder[0]).toBeLessThan(
      coreCollaborationSession.activate.mock.invocationCallOrder[0] ?? 0
    )

    const preparation =
      await coreCollaborationSession.prepare(collaborationBridge)
    const loadSource = preparation?.loadSource
    await expect(loadSource?.load()).resolves.toEqual(EMPTY_DOCUMENT)

    await act(async () => root.unmount())
  })

  it('injects the selected file load source before Core and activates Collaboration after Core', async () => {
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
      expect(
        collaborationLifecycle.createCollaborationDocumentSession
      ).toHaveBeenCalledTimes(1)
    )
    expect(core.registerCollaborationSession).toHaveBeenCalledOnce()
    expect(core.setPersistence).not.toHaveBeenCalled()
    expect(localStorage.getItem('FILE')).toBeNull()
    expect(core.start).toHaveBeenCalledTimes(1)
    expect(
      vi.mocked(core.registerCollaborationSession).mock.invocationCallOrder[0]
    ).toBeLessThan(vi.mocked(core.start).mock.invocationCallOrder[0] ?? 0)
    expect(vi.mocked(core.start).mock.invocationCallOrder[0]).toBeLessThan(
      coreCollaborationSession.activate.mock.invocationCallOrder[0] ?? 0
    )
    expect(core.load).not.toHaveBeenCalled()

    await act(async () => root.unmount())
  })

  it('starts local-only without server communication when no endpoint is configured', async () => {
    vi.stubEnv('VITE_COLLABORATION_WS_URL', '')
    window.history.replaceState({}, '', '/?fileId=crdt-7076-sample')
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    vi.mocked(core.start).mockResolvedValueOnce(undefined)
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)

    await act(async () => {
      root.render(<RenderApp />)
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    await vi.waitFor(() => expect(core.start).toHaveBeenCalledOnce())
    expect(
      collaborationLifecycle.createCollaborationDocumentSession
    ).not.toHaveBeenCalled()
    expect(core.registerCollaborationSession).not.toHaveBeenCalled()
    expect(coreCollaborationSession.activate).not.toHaveBeenCalled()
    expect(core.setLoadSource).toHaveBeenCalledWith({
      name: 'LocalOnlyDocument',
      load: expect.any(Function)
    })
    await expect(
      vi.mocked(core.setLoadSource).mock.calls[0]?.[0]?.load()
    ).resolves.toEqual(EMPTY_DOCUMENT)
    expect(fetch).not.toHaveBeenCalled()
    expect(core.setPersistence).not.toHaveBeenCalled()

    await act(async () => root.unmount())
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
    expect(
      collaborationLifecycle.createCollaborationDocumentSession
    ).not.toHaveBeenCalled()

    await act(async () => root.unmount())
  })

  it('starts an ordinary full-stack document from the socket checkpoint without browser persistence', async () => {
    window.history.replaceState({}, '', '/?fileId=ordinary-document')
    const fetch = vi.fn(async () => {
      throw new Error('database unavailable')
    })
    vi.stubGlobal('fetch', fetch)
    let loadedDocument: unknown
    vi.mocked(core.start).mockImplementationOnce(async () => {
      const preparation =
        await coreCollaborationSession.prepare(collaborationBridge)
      loadedDocument = await preparation?.loadSource?.load()
      await coreCollaborationSession.activate()
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
      expect(
        collaborationLifecycle.createCollaborationDocumentSession
      ).toHaveBeenCalledOnce()
    )
    expect(loadedDocument).toEqual(EMPTY_DOCUMENT)
    expect(fetch).not.toHaveBeenCalled()
    expect(host.querySelector('[role="alert"]')).toBeNull()
    expect(core.setPersistence).not.toHaveBeenCalled()

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
      expect(
        collaborationLifecycle.createCollaborationDocumentSession
      ).toHaveBeenCalledTimes(1)
    )
    expect(core.registerCollaborationSession).toHaveBeenCalledOnce()
    expect(core.setPersistence).not.toHaveBeenCalled()
    expect(core.load).not.toHaveBeenCalled()
    expect(
      vi.mocked(core.registerCollaborationSession).mock.invocationCallOrder[0]
    ).toBeLessThan(vi.mocked(core.start).mock.invocationCallOrder[0] ?? 0)
    expect(vi.mocked(core.start).mock.invocationCallOrder[0]).toBeLessThan(
      coreCollaborationSession.activate.mock.invocationCallOrder[0] ?? 0
    )
    expect(providers.memory.save).not.toHaveBeenCalled()
    expect(localStorage.getItem('FILE:file-1')).toBeNull()
    expect(localStorage.getItem('FILE')).toBeNull()
    expect(
      collaborationLifecycle.createCollaborationDocumentSession
    ).toHaveBeenCalledWith({
      fileId: 'file-1',
      actorId: `actor-${ACTOR_UUID}`,
      endpoint: COLLABORATION_ENDPOINT
    })

    await act(async () => root.unmount())
    expect(core.destroy).toHaveBeenCalledTimes(2)
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
      expect(
        collaborationLifecycle.createCollaborationDocumentSession
      ).toHaveBeenCalledTimes(1)
    )
    expect(core.registerCollaborationSession).toHaveBeenCalledOnce()
    expect(core.setPersistence).not.toHaveBeenCalled()
    expect(core.load).not.toHaveBeenCalled()
    expect(JSON.parse(localStorage.getItem('FILE:file-1') ?? '')).toEqual(
      existingDocument
    )
    expect(localStorage.getItem('FILE')).toBeNull()
    expect(
      collaborationLifecycle.createCollaborationDocumentSession
    ).toHaveBeenCalledTimes(1)

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

    expect(coreCollaborationSession.activate).not.toHaveBeenCalled()
  })

  it('starts a provisional local document quietly when the socket was never connected', async () => {
    collaborationSessionState = Object.freeze({
      connection: 'disconnected',
      sync: 'synced',
      pendingCount: 0,
      disconnectedEpoch: 0
    })
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)

    await act(async () => {
      root.render(<RenderApp />)
      await Promise.resolve()
      await Promise.resolve()
    })

    await vi.waitFor(() => expect(core.start).toHaveBeenCalledOnce())
    expect(host.querySelector('[role="alert"]')).toBeNull()
    expect(core.start).toHaveBeenCalledOnce()
    expect(core.destroy).not.toHaveBeenCalled()
    expect(documentInteractionLock.acquire).not.toHaveBeenCalled()

    await act(async () => root.unmount())
  })

  it('does not disguise an unexpected collaboration composition error as a server disconnect', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    vi.mocked(
      collaborationLifecycle.createCollaborationDocumentSession
    ).mockImplementationOnce(() => {
      throw new Error('collaboration composition failed')
    })
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
    expect(documentInteractionLock.acquire).not.toHaveBeenCalled()

    await act(async () => root.unmount())
  })

  it('keeps the App editable and emits one transition toast for disconnect and reconnect', async () => {
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)

    await act(async () => {
      root.render(<RenderApp />)
      await Promise.resolve()
      await Promise.resolve()
    })
    await vi.waitFor(() =>
      expect(coreCollaborationSession.activate).toHaveBeenCalledOnce()
    )

    await act(async () => {
      collaborationSessionState = Object.freeze({
        connection: 'disconnected',
        sync: 'pending',
        pendingCount: 1,
        disconnectedEpoch: 1,
        notification: Object.freeze({
          id: 'collaboration-disconnected-1',
          message:
            'The document session is offline. Local editing remains available and changes will sync after reconnection.',
          type: 'disconnected'
        })
      })
      collaborationSessionStateSubscriber?.(collaborationSessionState)
    })

    expect(host.querySelector('[role="alert"]')?.textContent).toBe(
      'The document session is offline. Local editing remains available and changes will sync after reconnection.'
    )
    expect(host.querySelectorAll('[role="alert"]')).toHaveLength(1)

    await act(async () => {
      collaborationSessionStateSubscriber?.(collaborationSessionState)
    })
    expect(host.querySelectorAll('[role="alert"]')).toHaveLength(1)

    await act(async () => {
      collaborationSessionState = Object.freeze({
        connection: 'connected',
        sync: 'synced',
        pendingCount: 0,
        disconnectedEpoch: 1,
        notification: Object.freeze({
          id: 'collaboration-reconnected-1',
          message: 'The document session is connected and changes are syncing.',
          type: 'reconnected'
        })
      })
      collaborationSessionStateSubscriber?.(collaborationSessionState)
    })
    expect(host.textContent).toContain(
      'The document session is connected and changes are syncing.'
    )
    expect(core.start).toHaveBeenCalledOnce()
    expect(core.destroy).not.toHaveBeenCalled()
    expect(documentInteractionLock.acquire).not.toHaveBeenCalled()

    await act(async () => root.unmount())
    expect(releaseInteractionLock).not.toHaveBeenCalled()
  })
})
