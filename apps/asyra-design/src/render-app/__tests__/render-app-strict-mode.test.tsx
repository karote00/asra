import React, { StrictMode, act } from 'react'
import { createRoot } from 'react-dom/client'
import { IndexedDbPersistence, providers } from '@asyra/reactive-events'
import { indexedDB } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import core from '../../contexts'
import * as collaborationLifecycle from '../../collaboration/lifecycle'
import * as documentPersistence from '../../document-persistence'
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

const clearTestDocuments = async () => {
  await Promise.all(
    ['FILE', 'FILE:file-1', 'FILE:file-aborted'].map((key) =>
      new IndexedDbPersistence(key, { factory: indexedDB }).clear()
    )
  )
}

describe('RenderApp StrictMode lifecycle', () => {
  beforeEach(async () => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
    vi.stubGlobal('indexedDB', indexedDB)
    window.history.replaceState({}, '', '/')
    localStorage.clear()
    await clearTestDocuments()
    await providers.memory.clear()

    vi.spyOn(core, 'setPersistence').mockImplementation(() => undefined)
    vi.spyOn(core, 'load').mockImplementation(() => undefined)
    vi.spyOn(core, 'start').mockResolvedValue(undefined)
    vi.spyOn(core, 'destroyRenderer').mockImplementation(() => undefined)
    vi.spyOn(documentPersistence, 'createDocumentPersistence')
    vi.spyOn(documentPersistence, 'initializeDocumentPersistence')
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
    await clearTestDocuments()
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

    await vi.waitFor(() =>
      expect(core.load).toHaveBeenCalledWith(EMPTY_DOCUMENT)
    )
    expect(documentPersistence.createDocumentPersistence).not.toHaveBeenCalled()
    expect(
      documentPersistence.initializeDocumentPersistence
    ).not.toHaveBeenCalled()
    expect(core.setPersistence).not.toHaveBeenCalled()
    expect(core.destroyRenderer).toHaveBeenCalledTimes(1)
    expect(core.start).toHaveBeenCalledTimes(1)
    expect(core.start).toHaveBeenCalledWith(
      expect.any(HTMLDivElement),
      expect.objectContaining({
        width: window.innerWidth,
        height: window.innerHeight
      })
    )
    expect(vi.mocked(core.start).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(core.load).mock.invocationCallOrder[0] ?? 0
    )

    await act(async () => {
      root.unmount()
    })

    expect(core.destroyRenderer).toHaveBeenCalledTimes(2)
  })

  it('loads an empty ordinary document after Core starts without client persistence', async () => {
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
      expect(core.load).toHaveBeenCalledWith(EMPTY_DOCUMENT)
    )
    expect(documentPersistence.createDocumentPersistence).not.toHaveBeenCalled()
    expect(
      documentPersistence.initializeDocumentPersistence
    ).not.toHaveBeenCalled()
    expect(core.setPersistence).not.toHaveBeenCalled()
    await expect(providers.indexedDB.load()).resolves.toBeNull()
    expect(localStorage.getItem('FILE')).toBeNull()
    expect(core.start).toHaveBeenCalledTimes(1)
    expect(vi.mocked(core.start).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(core.load).mock.invocationCallOrder[0] ?? 0
    )

    await act(async () => root.unmount())
  })

  it('loads an empty collaboration document without creating or injecting client persistence', async () => {
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

    await vi.waitFor(() =>
      expect(collaborationLifecycle.startCollaboration).toHaveBeenCalledTimes(1)
    )
    expect(documentPersistence.createDocumentPersistence).not.toHaveBeenCalled()
    expect(
      documentPersistence.initializeDocumentPersistence
    ).not.toHaveBeenCalled()
    expect(core.setPersistence).not.toHaveBeenCalled()
    expect(core.load).toHaveBeenCalledOnce()
    expect(core.load).toHaveBeenCalledWith(EMPTY_DOCUMENT)
    expect(vi.mocked(core.start).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(core.load).mock.invocationCallOrder[0] ?? 0
    )
    expect(vi.mocked(core.load).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(collaborationLifecycle.startCollaboration).mock
        .invocationCallOrder[0] ?? 0
    )
    expect(providers.memory.save).not.toHaveBeenCalled()
    await expect(
      new IndexedDbPersistence('FILE:file-1', {
        factory: indexedDB
      }).load()
    ).resolves.toBeNull()
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

    await vi.waitFor(() =>
      expect(collaborationLifecycle.startCollaboration).toHaveBeenCalledTimes(1)
    )
    expect(documentPersistence.createDocumentPersistence).not.toHaveBeenCalled()
    expect(
      documentPersistence.initializeDocumentPersistence
    ).not.toHaveBeenCalled()
    expect(core.setPersistence).not.toHaveBeenCalled()
    expect(core.load).toHaveBeenCalledWith(EMPTY_DOCUMENT)
    await expect(
      new IndexedDbPersistence('FILE:file-1', {
        factory: indexedDB
      }).load()
    ).resolves.toBeNull()
    expect(JSON.parse(localStorage.getItem('FILE:file-1') ?? '')).toEqual(
      existingDocument
    )
    expect(localStorage.getItem('FILE')).toBeNull()
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
    await vi.waitFor(() => expect(core.start).toHaveBeenCalledTimes(1))

    await act(async () => root.unmount())
    await act(async () => {
      finishCoreStart?.()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(collaborationLifecycle.startCollaboration).not.toHaveBeenCalled()
  })
})
