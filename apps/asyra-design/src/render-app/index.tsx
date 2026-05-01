import React, { useEffect, useRef } from 'react'
import { destroyRenderApp } from '../controllers/app'
import core from '../contexts'
import { PixiJSRenderer } from '@asyra/render'
import { providers } from '@asyra/reactive-events'
import { CANVAS_BACKGROUND_COLOR } from '../constants'
import { waitForExactGeometryBackend } from '../init'

const RenderApp: React.FC = () => {
  const pixiContainerRef = useRef<HTMLDivElement>(null)
  const hasInit = useRef<boolean>(false)

  useEffect(() => {
    const initApp = async () => {
      if (pixiContainerRef.current && !hasInit.current) {
        hasInit.current = true

        // Phase 1: Configure renderer and persistence
        core.setRenderer(new PixiJSRenderer())
        core.setPersistence(providers.localStorage)
        await waitForExactGeometryBackend()

        // Phase 3: Single startup call
        await core.start(pixiContainerRef.current, {
          width: window.innerWidth,
          height: window.innerHeight,
          backgroundColor: CANVAS_BACKGROUND_COLOR,
          backgroundColorAlpha: 1
        })
      }
    }

    initApp()

    return () => {
      if (pixiContainerRef.current) {
        pixiContainerRef.current.innerHTML = ''
        destroyRenderApp()
      }
    }
  }, [])

  return <div className="absolute top-0 left-0" ref={pixiContainerRef} />
}

export default RenderApp
