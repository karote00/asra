import React, { useEffect, useRef, useState } from 'react'
import core from '../contexts'
import {
  AiDocumentInteractionTargetProps,
  CANVAS_BACKGROUND_COLOR
} from '../constants'
import type { CollaborationSessionNotification } from '../collaboration/lifecycle'
import { createEmptyDocument } from '../config/empty-document'
import { getConfiguredCollaborationMode } from './collaboration-mode'
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
    let runtimeDestroyPromise: Promise<void> | undefined
    let unsubscribeCollaborationState: (() => void) | undefined
    const destroyRuntime = (): Promise<void> => {
      runtimeDestroyPromise ??= core.destroy()
      return runtimeDestroyPromise
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
        const collaborationMode = getConfiguredCollaborationMode()
        let collaborationLifecycle:
          typeof import('../collaboration/lifecycle') | undefined
        if (collaborationMode) {
          collaborationLifecycle = await import('../collaboration/lifecycle')
          core.registerCollaborationSession(
            collaborationLifecycle.createCollaborationDocumentSession(
              collaborationMode
            )
          )
        } else {
          core.setLoadSource({
            name: 'LocalOnlyDocument',
            load: async () => createEmptyDocument()
          })
        }

        await core.start(container, {
          width: window.innerWidth,
          height: window.innerHeight,
          backgroundColor: CANVAS_BACKGROUND_COLOR,
          backgroundColorAlpha: 1
        })
        if (!active) {
          await destroyRuntime()
          return
        }

        const handle = collaborationLifecycle?.getActiveCollaborationHandle()
        if (collaborationMode && !handle) {
          throw new Error(
            '[RenderApp] collaboration session did not activate through Core'
          )
        }
        if (handle) {
          setCollaborationNotification(handle.getSessionState().notification)
          unsubscribeCollaborationState = handle.onSessionStateChange(
            (state) => {
              if (active) {
                setCollaborationNotification(state.notification)
              }
            }
          )
        }
        if (!active) await destroyRuntime()
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
      void destroyRuntime().catch((error: unknown) => {
        console.error('[RenderApp] runtime teardown failed:', error)
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
