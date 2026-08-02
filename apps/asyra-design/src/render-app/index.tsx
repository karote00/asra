import React, { useEffect, useRef, useState } from 'react'
import { ProviderFailure, type ProviderStatus } from '@asyra/collaboration'
import core from '../contexts'
import {
  AiDocumentInteractionTargetProps,
  CANVAS_BACKGROUND_COLOR
} from '../constants'
import {
  activateDocumentPersistence,
  createDocumentPersistence,
  DOCUMENT_DATABASE_UNAVAILABLE_MESSAGE
} from '../document-persistence'
import { createInitialDocumentForFile } from '../config/demo-document'
import { createEmptyDocument } from '../config/empty-document'
import { getCollaborationMode, getRequiredFileId } from './collaboration-mode'
import AiDrawingProgressIndicator from './ai-drawing-progress-indicator'

const COLLABORATION_UNAVAILABLE_MESSAGE =
  'Collaboration server is unavailable. You can keep using the app, but this tab will not receive remote changes.'

const isCollaborationUnavailable = (status: ProviderStatus): boolean =>
  status !== 'connected'

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
  const [documentDatabaseUnavailable, setDocumentDatabaseUnavailable] =
    useState(false)
  const [collaborationUnavailable, setCollaborationUnavailable] =
    useState(false)

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
    let unsubscribeCollaborationStatus: (() => void) | undefined
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
        const fileId = getRequiredFileId()
        const collaborationMode = getCollaborationMode()
        const documentPersistence = createDocumentPersistence(fileId, {
          createInitialDocument: collaborationMode
            ? createEmptyDocument
            : () => createInitialDocumentForFile(fileId),
          onStatusChange: (status) => {
            if (active) {
              setDocumentDatabaseUnavailable(status.status === 'unavailable')
            }
          }
        })
        activateDocumentPersistence(documentPersistence)
        core.setPersistence(documentPersistence.provider)

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

        if (!collaborationMode) {
          return
        }
        const collaborationLifecycle = await import(
          '../collaboration/lifecycle'
        )
        collaborationDisposer = collaborationLifecycle.disposeCollaboration
        if (!active) {
          await disposeCollaboration()
          return
        }
        try {
          const handle =
            await collaborationLifecycle.startCollaboration(collaborationMode)
          if (!active) {
            await disposeCollaboration()
            return
          }
          setCollaborationUnavailable(
            isCollaborationUnavailable(handle.getStatus())
          )
          unsubscribeCollaborationStatus = handle.onStatusChange((status) => {
            if (active) {
              setCollaborationUnavailable(isCollaborationUnavailable(status))
            }
          })
        } catch (error) {
          if (!(error instanceof ProviderFailure)) {
            throw error
          }
          if (active) {
            setCollaborationUnavailable(true)
          }
        }
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
      unsubscribeCollaborationStatus?.()
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
      data-testid="asyra-canvas-host"
      tabIndex={-1}
      onContextMenu={handleContextMenu}
    >
      <div
        ref={renderContainerRef}
        className="absolute inset-0"
        data-testid="asyra-canvas-render-container"
      />
      {documentDatabaseUnavailable ? (
        <div
          className="pointer-events-none absolute left-1/2 top-4 z-50 -translate-x-1/2 rounded bg-red-700 px-3 py-2 text-sm text-white shadow"
          role="alert"
        >
          {DOCUMENT_DATABASE_UNAVAILABLE_MESSAGE}
        </div>
      ) : null}
      {collaborationUnavailable ? (
        <div
          className="pointer-events-none absolute left-1/2 top-16 z-50 -translate-x-1/2 rounded bg-red-700 px-3 py-2 text-sm text-white shadow"
          role="alert"
        >
          {COLLABORATION_UNAVAILABLE_MESSAGE}
        </div>
      ) : null}
      <AiDrawingProgressIndicator />
    </div>
  )
}

export default RenderApp
