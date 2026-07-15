import React, { useEffect, useRef } from 'react'
import core from '../contexts'
import { RenderAdapter } from '@asyra/render'
import { providers } from '@asyra/reactive-events'
import { CANVAS_BACKGROUND_COLOR } from '../constants'

const RenderApp: React.FC = () => {
  const renderContainerRef = useRef<HTMLDivElement>(null)
  const lifecycleRef = useRef<Promise<void>>(Promise.resolve())

  useEffect(() => {
    let active = true
    const renderer = new RenderAdapter()

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

        // Phase 1: Configure renderer and persistence
        core.setRenderer(renderer)
        core.setPersistence(providers.localStorage)

        // Phase 3: Single startup call
        await core.start(container, {
          width: window.innerWidth,
          height: window.innerHeight,
          backgroundColor: CANVAS_BACKGROUND_COLOR,
          backgroundColorAlpha: 1
        })
      })
    lifecycleRef.current = lifecycle
    void lifecycle.catch(() => undefined)

    return () => {
      active = false
      renderer.destroy()
    }
  }, [])

  return <div className="absolute top-0 left-0" ref={renderContainerRef} />
}

export default RenderApp
