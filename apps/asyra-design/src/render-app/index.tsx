import React, { useEffect, useRef } from 'react'
import core from '../contexts'
import { CANVAS_BACKGROUND_COLOR } from '../constants'
import { createDocumentPersistence } from '../document-persistence'
import { getCollaborationMode } from './collaboration-mode'
import type { CoreRawData } from '@asyra/utils'

const EMPTY_DOCUMENT = {
  version: '1.0.0',
  sceneTree: { workspace: '', workspaceList: [], elements: {} },
  props: {}
} as const satisfies CoreRawData

export interface CanvasContextMenuInvocation {
  clientX: number
  clientY: number
  invoker: HTMLDivElement
}

interface RenderAppProps {
  onContextMenuRequest?: (invocation: CanvasContextMenuInvocation) => void
}

const RenderApp: React.FC<RenderAppProps> = ({ onContextMenuRequest }) => {
  const renderContainerRef = useRef<HTMLDivElement>(null)
  const lifecycleRef = useRef<Promise<void>>(Promise.resolve())

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
        const documentPersistence = createDocumentPersistence(
          collaborationMode?.fileId
        )

        // LocalStorage remains the demo database. Initialize an absent
        // document so Core can establish its empty workspace; an existing
        // ordinary or collaboration document must survive refresh unchanged.
        if ((await documentPersistence.load()) === null) {
          if (!active) return
          await documentPersistence.save(EMPTY_DOCUMENT)
        }
        if (!active) return
        core.setPersistence(documentPersistence)

        // Phase 3: Single startup call
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

        if (collaborationMode) {
          const collaborationLifecycle = await import(
            '../collaboration/lifecycle'
          )
          collaborationDisposer = collaborationLifecycle.disposeCollaboration
          if (!active) {
            await disposeCollaboration()
            return
          }
          await collaborationLifecycle.startCollaboration(collaborationMode)
          if (!active) await disposeCollaboration()
        }
      })
    lifecycleRef.current = lifecycle
    void lifecycle.catch((error: unknown) => {
      if (active) {
        console.error('[RenderApp] Render startup failed:', error)
      }
    })

    return () => {
      active = false
      core.destroyRenderer()
      void disposeCollaboration().catch((error: unknown) => {
        console.error('[RenderApp] collaboration teardown failed:', error)
      })
    }
  }, [])

  return (
    <div
      ref={renderContainerRef}
      className="absolute top-0 left-0"
      data-testid="asyra-canvas-host"
      tabIndex={-1}
      onContextMenu={handleContextMenu}
    />
  )
}

export default RenderApp
