import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProviderStatus } from '@asyra/collaboration'
import core from '../../contexts'
import * as collaborationLifecycle from '../../collaboration/lifecycle'
import type { CollaborationDebugHandle } from '../../collaboration/lifecycle'
import {
  AI_DOCUMENT_INTERACTION_TARGET_ATTRIBUTE,
  AiDocumentInteractionTargets
} from '../../constants'
import RenderApp, { type CanvasContextMenuInvocation } from '../index'

const COLLABORATION_ENDPOINT = 'ws://127.0.0.1:4101/collaboration'
const collaborationHandle = {
  identity: Object.freeze({
    actorId: 'actor-canvas-context-menu',
    documentId: 'canvas-context-menu',
    roomId: 'canvas-context-menu'
  }),
  getStatus: () => 'connected' as const,
  onStatusChange: (_subscriber: (status: ProviderStatus) => void) => () =>
    undefined,
  getSessionState: () => ({
    connection: 'connected' as const,
    sync: 'synced' as const,
    pendingCount: 0,
    disconnectedEpoch: 0
  }),
  onSessionStateChange: () => () => undefined,
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

describe('Render canvas context-menu intake', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_COLLABORATION_WS_URL', COLLABORATION_ENDPOINT)
    window.history.replaceState({}, '', '/?fileId=canvas-context-menu')
    vi.spyOn(core, 'load').mockImplementation(() => undefined)
    vi.spyOn(core, 'start').mockResolvedValue(undefined)
    vi.spyOn(core, 'destroyRenderer').mockImplementation(() => undefined)
    vi.spyOn(collaborationLifecycle, 'startCollaboration').mockResolvedValue(
      collaborationHandle
    )
    vi.spyOn(collaborationLifecycle, 'disposeCollaboration').mockResolvedValue(
      undefined
    )
    document.body.replaceChildren()
    setReactActEnvironment(true)
  })

  afterEach(() => {
    document.body.replaceChildren()
    window.history.replaceState({}, '', '/')
    setReactActEnvironment(false)
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('accepts a canvas context event once with exact client coordinates', async () => {
    const invocations: CanvasContextMenuInvocation[] = []
    const rootHost = document.createElement('div')
    document.body.append(rootHost)
    const root = createRoot(rootHost)

    await act(async () => {
      root.render(
        <RenderApp
          onContextMenuRequest={(invocation) => invocations.push(invocation)}
        />
      )
      await Promise.resolve()
    })
    await vi.waitFor(() => expect(core.start).toHaveBeenCalledTimes(1))

    const canvasHost = rootHost.querySelector(
      '[data-testid="asyra-canvas-host"]'
    )
    expect(canvasHost).toBeInstanceOf(HTMLDivElement)
    expect(
      canvasHost?.getAttribute(AI_DOCUMENT_INTERACTION_TARGET_ATTRIBUTE)
    ).toBe(AiDocumentInteractionTargets.VIEWPORT_NAVIGATION)
    const canvas = document.createElement('canvas')
    canvasHost?.append(canvas)
    const event = new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: 312,
      clientY: 184
    })

    canvas.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(true)
    expect(invocations).toEqual([
      {
        clientX: 312,
        clientY: 184,
        invoker: canvasHost
      }
    ])

    await act(async () => root.unmount())
  })

  it('bypasses non-canvas targets and an unhandled canvas invocation', async () => {
    const onContextMenuRequest = vi.fn()
    const rootHost = document.createElement('div')
    document.body.append(rootHost)
    const root = createRoot(rootHost)

    await act(async () => {
      root.render(<RenderApp onContextMenuRequest={onContextMenuRequest} />)
      await Promise.resolve()
    })
    await vi.waitFor(() => expect(core.start).toHaveBeenCalledTimes(1))

    const canvasHost = rootHost.querySelector(
      '[data-testid="asyra-canvas-host"]'
    )
    const editable = document.createElement('input')
    canvasHost?.append(editable)
    const editableEvent = new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true
    })
    editable.dispatchEvent(editableEvent)

    expect(editableEvent.defaultPrevented).toBe(false)
    expect(onContextMenuRequest).not.toHaveBeenCalled()

    await act(async () => {
      root.render(<RenderApp />)
      await Promise.resolve()
    })
    const canvas = document.createElement('canvas')
    canvasHost?.append(canvas)
    const unhandledEvent = new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true
    })
    canvas.dispatchEvent(unhandledEvent)

    expect(unhandledEvent.defaultPrevented).toBe(false)
    expect(onContextMenuRequest).not.toHaveBeenCalled()

    await act(async () => root.unmount())
  })

  it('announces canvas-host teardown exactly once on unmount', async () => {
    const onCanvasHostTeardown = vi.fn()
    const rootHost = document.createElement('div')
    document.body.append(rootHost)
    const root = createRoot(rootHost)

    await act(async () => {
      root.render(<RenderApp onCanvasHostTeardown={onCanvasHostTeardown} />)
      await Promise.resolve()
    })
    await vi.waitFor(() => expect(core.start).toHaveBeenCalledTimes(1))
    expect(onCanvasHostTeardown).not.toHaveBeenCalled()

    await act(async () => {
      root.render(<RenderApp onCanvasHostTeardown={onCanvasHostTeardown} />)
      await Promise.resolve()
    })
    expect(onCanvasHostTeardown).not.toHaveBeenCalled()

    await act(async () => root.unmount())
    expect(onCanvasHostTeardown).toHaveBeenCalledTimes(1)
  })
})
