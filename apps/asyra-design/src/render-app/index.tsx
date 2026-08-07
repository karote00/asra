import React, { useEffect, useRef, useState } from 'react'
import core from '../contexts'
import {
  AiDocumentInteractionTargetProps,
  CANVAS_BACKGROUND_COLOR
} from '../constants'
import type { CollaborationSessionNotification } from '../collaboration/lifecycle'
import { getCollaborationMode } from './collaboration-mode'
import AiDrawingProgressIndicator from './ai-drawing-progress-indicator'
import { StatusToastStack } from './status-toast-stack'

export interface CanvasContextMenuInvocation {
  clientX: number
  clientY: number
  invoker: HTMLDivElement
}

interface RenderAppProps {
  onContextMenuRequest?: (invocation: CanvasContextMenuInvocation) => void
  onCanvasHostTeardown?: () => void
}

const RenderApp: React.FC<RenderAppProps> = ({
  onContextMenuRequest,
  onCanvasHostTeardown
}) => {
  const renderContainerRef = useRef<HTMLDivElement>(null)
  const lifecycleRef = useRef<Promise<void>>(Promise.resolve())
  const [collaborationNotification, setCollaborationNotification] =
    useState<CollaborationSessionNotification>()

  const handleContextMenu = (event: React.MouseEvent<HTMLDivElement>) => {
    if (
      !onContextMenuRequest ||
      !(event.target instanceof HTMLCanvasElement) ||
      !event.currentTarget.contains(event.target)
    ) {
      return
    }

    event.preventDefault()
    onContextMenuRequest({
      clientX: event.clientX,
      clientY: event.clientY,
      invoker: event.currentTarget
    })
  }

  useEffect(() => {
    let active = true
    let collaborationDisposer: (() => Promise<void>) | undefined
    let collaborationDisposePromise: Promise<void> | undefined
    let unsubscribeCollaborationState: (() => void) | undefined
    const disposeCollaboration = (): Promise<void> => {
      if (!collaborationDisposer) return Promise.resolve()
      collaborationDisposePromise ??= collaborationDisposer()
      return collaborationDisposePromise
    }

    const lifecycle = lifecycleRef.current
      .catch(() => undefined)
      .then(async () => {
        if (!active) {
          return
        }
        const container = renderContainerRef.current
        if (!container) {
          return
        }
        const collaborationMode = getCollaborationMode()
        const collaborationLifecycle = await import(
          '../collaboration/lifecycle'
        )
        collaborationDisposer = collaborationLifecycle.disposeCollaboration
        const preparedCollaboration =
          await collaborationLifecycle.prepareCollaborationDocumentSession(
            collaborationMode
          )
        core.setLoadSource({
          name: 'SocketDocumentSession',
          load: async () => preparedCollaboration.bootstrap.checkpoint
        })

        await core.start(container, {
          width: window.innerWidth,
          height: window.innerHeight,
          backgroundColor: CANVAS_BACKGROUND_COLOR,
          backgroundColorAlpha: 1
        })
        if (!active) {
          core.destroyRenderer()
          return
        }

        const handle = await preparedCollaboration.activate()
        if (!active) {
          await disposeCollaboration()
          return
        }
        setCollaborationNotification(handle.getSessionState().notification)
        unsubscribeCollaborationState = handle.onSessionStateChange((state) => {
          if (active) {
            setCollaborationNotification(state.notification)
          }
        })
        if (!active) await disposeCollaboration()
      })
    lifecycleRef.current = lifecycle
    void lifecycle.catch((error: unknown) => {
      if (active) {
        console.error('[RenderApp] Render startup failed:', error)
      }
    })

    return () => {
      active = false
      unsubscribeCollaborationState?.()
      core.destroyRenderer()
      void disposeCollaboration().catch((error: unknown) => {
        console.error('[RenderApp] collaboration teardown failed:', error)
      })
    }
  }, [])

  useEffect(
    () => () => {
      onCanvasHostTeardown?.()
    },
    [onCanvasHostTeardown]
  )

  return (
    <div
      {...AiDocumentInteractionTargetProps.VIEWPORT_NAVIGATION}
      className="absolute inset-0"
      data-testid="canvas-host"
      tabIndex={-1}
      onContextMenu={handleContextMenu}
    >
      <div
        ref={renderContainerRef}
        className="absolute inset-0"
        data-testid="canvas-render-container"
      />
      <StatusToastStack
        toasts={[
          ...(collaborationNotification
            ? [
                {
                  id: collaborationNotification.id,
                  message: collaborationNotification.message
                }
              ]
            : [])
        ]}
      />
      <AiDrawingProgressIndicator />
    </div>
  )
}

export default RenderApp
