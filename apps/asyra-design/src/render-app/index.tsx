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

const RenderApp: React.FC = () => {
  const renderContainerRef = useRef<HTMLDivElement>(null)
  const lifecycleRef = useRef<Promise<void>>(Promise.resolve())

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

  return <div className="absolute top-0 left-0" ref={renderContainerRef} />
}

export default RenderApp
